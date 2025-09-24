import type {
  Graph,
  Edge,
  BusNetwork,
  Point,
  BusChannel,
  Node,
  EdgeId,
} from "@domain/types";
import { portPosition } from "@layout/port/assign";
import { PriorityQueue } from "@utils/priorityQueue";
import { manhattan } from "@utils/math";

/**
 * BusNetwork를 이용해 그래프의 모든 엣지에 대한 직교 경로를 계산
 */
export function routeEdgesOnBus(
  g: Graph,
  network: BusNetwork,
  cfg: any
): Graph {
  const out = { ...g, edges: new Map(g.edges) };

  for (const edge of out.edges.values()) {
    const path = findPathForEdge(edge, out, network, cfg);
    out.edges.set(edge.id, { ...edge, path });
  }

  return out;
}

/**
 * 단일 엣지에 대한 최적의 버스 경로 탐색
 */
function findPathForEdge(
  edge: Edge,
  g: Graph,
  network: BusNetwork,
  cfg: any
): Point[] {
  const sourceNode = g.nodes.get(edge.sourceId)!;
  const targetNode = g.nodes.get(edge.targetId)!;

  // 1. Off-Ramp 후보군을 먼저 탐색
  const offRampCandidates = findRampCandidates(targetNode, network);
  if (offRampCandidates.length === 0)
    return createFallbackPath(sourceNode, targetNode);

  // 2. On-Ramp를 찾을 때, 각 후보에서 Off-Ramp 후보군까지의 총 예상 비용을 계산
  const onRamp = findBestRamp(sourceNode, network, offRampCandidates);
  if (!onRamp) return createFallbackPath(sourceNode, targetNode);

  // 3. 선택된 On-Ramp를 기준으로 최적의 Off-Ramp를 최종 결정
  const offRamp = findBestOffRamp(onRamp, network, offRampCandidates);
  if (!offRamp) return createFallbackPath(sourceNode, targetNode);

  // 4. Highway: 네트워크 그래프에서 A*로 최단 비용 채널 경로 탐색
  const channelPath = findBusRoute(
    onRamp.channel.id,
    offRamp.channel.id,
    network
  );

  // 5. 경로 조합: 찾은 세 조각을 합쳐 최종 직교 경로 생성
  if (channelPath) {
    return stitchPath(onRamp, offRamp, channelPath, network, edge.id, cfg);
  } else {
    return createFallbackPath(sourceNode, targetNode);
  }
}

// --- 타입 및 인터페이스 정의 ---

interface Ramp {
  port: Point;
  channel: BusChannel;
  projection: Point; // 포트에서 채널로 내린 수선의 발
  cost: number; // 노드 포트에서 projection까지의 맨해튼 거리 비용
}

/**
 * 노드에 연결될 수 있는 모든 유효한 Ramp 후보를 찾아 비용과 함께 반환
 * @param node 대상 노드
 * @param network 버스 네트워크
 * @returns Ramp 후보 배열
 */
function findRampCandidates(node: Node, network: BusNetwork): Ramp[] {
  const candidates: Ramp[] = [];
  if (!node.ports || node.ports.length === 0) {
    console.warn(`Node ${node.id} has no ports!`);
    return [];
  }

  for (const portInfo of node.ports) {
    const portPos = portPosition(node, portInfo.side, portInfo.offset);
    for (const channel of network.channels.values()) {
      const isPortHorizontal =
        portInfo.side === "left" || portInfo.side === "right";
      const isChannelHorizontal = channel.direction === "horizontal";
      if (isPortHorizontal === isChannelHorizontal) continue;

      const projection = getProjection(portPos, channel);
      if (projection) {
        const cost = manhattan(portPos, projection);
        candidates.push({ port: portPos, channel, projection, cost });
      }
    }
  }
  return candidates;
}

/**
 * 여러 On-Ramp 후보 중에서, Off-Ramp 후보군까지의 총 예상 비용이 가장 낮은 최적의 On-Ramp 탐색
 * @param node 소스 노드
 * @param network 버스 네트워크
 * @param offRampCandidates 타겟 노드의 모든 Off-Ramp 후보
 * @returns 최적의 On-Ramp
 */
function findBestRamp(
  node: Node,
  network: BusNetwork,
  offRampCandidates: Ramp[]
): Ramp | null {
  const onRampCandidates = findRampCandidates(node, network);
  if (onRampCandidates.length === 0) return null;

  let bestOnRamp: Ramp | null = null;
  let minTotalCost = Infinity;

  for (const onRamp of onRampCandidates) {
    // 이 On-Ramp에서 가장 저렴한 Off-Ramp까지의 예상 비용을 계산
    const { cost: highwayCost } = findCheapestRouteToCandidates(
      onRamp,
      offRampCandidates,
      network
    );
    const totalCost = onRamp.cost + highwayCost;

    if (totalCost < minTotalCost) {
      minTotalCost = totalCost;
      bestOnRamp = onRamp;
    }
  }

  return bestOnRamp;
}

/**
 * 주어진 On-Ramp에 대해, 총 경로 비용이 가장 낮은 최적의 Off-Ramp를 최종 선택
 * @param onRamp 확정된 On-Ramp
 * @param network 버스 네트워크
 * @param offRampCandidates 타겟 노드의 모든 Off-Ramp 후보
 * @returns 최적의 Off-Ramp
 */
function findBestOffRamp(
  onRamp: Ramp,
  network: BusNetwork,
  offRampCandidates: Ramp[]
): Ramp | null {
  const { bestTargetRamp } = findCheapestRouteToCandidates(
    onRamp,
    offRampCandidates,
    network
  );
  return bestTargetRamp;
}

/**
 * 특정 On-Ramp에서 여러 Off-Ramp 후보군까지의 경로 중 가장 저렴한 경로 비용과 해당 Off-Ramp 탐색
 * @param onRamp 출발 Ramp
 * @param offRampCandidates 도착 Ramp 후보군
 * @param network 버스 네트워크
 * @returns 가장 저렴한 경로의 비용과 그 때의 Off-Ramp
 */
function findCheapestRouteToCandidates(
  onRamp: Ramp,
  offRampCandidates: Ramp[],
  network: BusNetwork
): { cost: number; bestTargetRamp: Ramp | null } {
  let minCost = Infinity;
  let bestTargetRamp: Ramp | null = null;

  for (const offRamp of offRampCandidates) {
    const path = findBusRoute(onRamp.channel.id, offRamp.channel.id, network);
    if (path) {
      // 경로의 총 비용 = A* 채널 비용 + 진출로 비용
      const highwayCost = path.reduce(
        (sum, channelId) => sum + (network.channels.get(channelId)!.cost || 0),
        0
      );
      const totalCost = highwayCost + offRamp.cost;
      if (totalCost < minCost) {
        minCost = totalCost;
        bestTargetRamp = offRamp;
      }
    }
  }
  return { cost: minCost, bestTargetRamp };
}

/**
 * 점에서 채널로 내린 수선의 발(projection)을 계산합니다. 점이 채널 범위 내에 있을 때만 유효
 */
function getProjection(point: Point, channel: BusChannel): Point | null {
  const { x, y, w, h } = channel.geometry;
  if (channel.direction === "horizontal") {
    if (point.x >= x && point.x <= x + w) return { x: point.x, y: y + h / 2 };
  } else {
    if (point.y >= y && point.y <= y + h) return { x: x + w / 2, y: point.y };
  }
  return null;
}

/**
 * [개선] A* 알고리즘을 사용하여 두 채널 사이의 최저 비용 경로(채널 ID 목록) 탐색
 * @param startChannelId 시작 채널 ID
 * @param endChannelId 도착 채널 ID
 * @param network 버스 네트워크
 * @returns 최저 비용의 채널 ID 배열
 */
function findBusRoute(
  startChannelId: string,
  endChannelId: string,
  network: BusNetwork
): string[] | null {
  if (startChannelId === endChannelId) return [startChannelId];

  type PathNode = { id: string; g: number; f: number; cameFrom: string | null };
  const openSet = new PriorityQueue<PathNode>((a, b) => a.f - b.f);
  const allNodes = new Map<string, PathNode>();

  const startNode = { id: startChannelId, g: 0, f: 0, cameFrom: null };
  openSet.push(startNode);
  allNodes.set(startChannelId, startNode);

  const endChannel = network.channels.get(endChannelId)!;

  while (openSet.size > 0) {
    const current = openSet.pop()!;

    if (current.id === endChannelId) {
      // 경로 복원
      const path: string[] = [];
      let p: PathNode | undefined = current;
      while (p) {
        path.push(p.id);
        p = p.cameFrom ? allNodes.get(p.cameFrom) : undefined;
      }
      return path.reverse();
    }

    const neighbors = network.intersections.get(current.id) || [];
    for (const neighborId of neighbors) {
      const channel = network.channels.get(neighborId)!;
      const gNew = current.g + (channel.cost || 1);

      const existing = allNodes.get(neighborId);
      if (!existing || gNew < existing.g) {
        const h = manhattan(channel.geometry, endChannel.geometry); // 휴리스틱
        const fNew = gNew + h;
        const newNode: PathNode = {
          id: neighborId,
          g: gNew,
          f: fNew,
          cameFrom: current.id,
        };
        allNodes.set(neighborId, newNode);
        openSet.push(newNode);
      }
    }
  }

  return null; // 경로를 찾지 못함
}
/**
 * On-Ramp, Off-Ramp, 채널 경로를 '차선'을 적용하여 직교 경로로 최종 완성
 */
function stitchPath(
  onRamp: Ramp,
  offRamp: Ramp,
  channelIds: string[],
  network: BusNetwork,
  edgeId: EdgeId,
  cfg: any
): Point[] {
  const baseLaneWidth = cfg.bus?.laneWidth ?? cfg.gridSize / 2;
  const path: Point[] = [onRamp.port];

  // --- On-Ramp 직교 경로 생성 ---
  const onRampChannel = onRamp.channel;
  if (!onRampChannel.lanes.has(edgeId)) {
    onRampChannel.lanes.set(edgeId, onRampChannel.lanes.size);
  }
  const onRampLaneIndex = onRampChannel.lanes.get(edgeId)!;
  const onRampTotalLanes = onRampChannel.lanes.size;

  // 동적 차선 폭 계산
  const onRampChannelWidth =
    onRampChannel.direction === "horizontal"
      ? onRampChannel.geometry.h
      : onRampChannel.geometry.w;
  const onRampEffectiveLaneWidth = Math.min(
    baseLaneWidth,
    onRampChannelWidth / onRampTotalLanes
  );

  const onRampOffset =
    (onRampLaneIndex - (onRampTotalLanes - 1) / 2) * onRampEffectiveLaneWidth;

  let onRampProjection = { ...onRamp.projection };
  if (onRampChannel.direction === "horizontal") {
    onRampProjection.y += onRampOffset;
  } else {
    onRampProjection.x += onRampOffset;
  }
  const isRampHorizontal = onRampChannel.direction === "vertical";
  if (isRampHorizontal) {
    path.push({ x: onRampProjection.x, y: onRamp.port.y });
  } else {
    path.push({ x: onRamp.port.x, y: onRampProjection.y });
  }
  path.push(onRampProjection);

  // --- Highway(채널) 경로 생성 ---
  for (let i = 0; i < channelIds.length; i++) {
    const currentChannel = network.channels.get(channelIds[i])!;
    const nextChannel =
      i + 1 < channelIds.length
        ? network.channels.get(channelIds[i + 1])!
        : null;

    if (!currentChannel.lanes.has(edgeId)) {
      currentChannel.lanes.set(edgeId, currentChannel.lanes.size);
    }
    const currentLaneIndex = currentChannel.lanes.get(edgeId)!;
    const currentTotalLanes = currentChannel.lanes.size;

    // 동적 차선 폭 계산
    const currentChannelWidth =
      currentChannel.direction === "horizontal"
        ? currentChannel.geometry.h
        : currentChannel.geometry.w;
    const currentEffectiveLaneWidth = Math.min(
      baseLaneWidth,
      currentChannelWidth / currentTotalLanes
    );
    const currentOffset =
      (currentLaneIndex - (currentTotalLanes - 1) / 2) *
      currentEffectiveLaneWidth;

    const lastPt = path[path.length - 1];
    if (currentChannel.direction === "horizontal") {
      path.push({
        x: lastPt.x,
        y:
          currentChannel.geometry.y +
          currentChannel.geometry.h / 2 +
          currentOffset,
      });
    } else {
      path.push({
        x:
          currentChannel.geometry.x +
          currentChannel.geometry.w / 2 +
          currentOffset,
        y: lastPt.y,
      });
    }

    if (nextChannel) {
      if (!nextChannel.lanes.has(edgeId)) {
        nextChannel.lanes.set(edgeId, nextChannel.lanes.size);
      }
      const nextLaneIndex = nextChannel.lanes.get(edgeId)!;
      const nextTotalLanes = nextChannel.lanes.size;

      // 동적 차선 폭 계산
      const nextChannelWidth =
        nextChannel.direction === "horizontal"
          ? nextChannel.geometry.h
          : nextChannel.geometry.w;
      const nextEffectiveLaneWidth = Math.min(
        baseLaneWidth,
        nextChannelWidth / nextTotalLanes
      );
      const nextOffset =
        (nextLaneIndex - (nextTotalLanes - 1) / 2) * nextEffectiveLaneWidth;

      const intersectionX =
        currentChannel.direction === "horizontal"
          ? nextChannel.geometry.x + nextChannel.geometry.w / 2 + nextOffset
          : currentChannel.geometry.x +
            currentChannel.geometry.w / 2 +
            currentOffset;
      const intersectionY =
        currentChannel.direction === "horizontal"
          ? currentChannel.geometry.y +
            currentChannel.geometry.h / 2 +
            currentOffset
          : nextChannel.geometry.y + nextChannel.geometry.h / 2 + nextOffset;
      path.push({ x: intersectionX, y: intersectionY });
    }
  }

  // --- Off-Ramp 직교 경로 생성 ---
  const offRampChannel = offRamp.channel;

  if (!offRampChannel.lanes.has(edgeId)) {
    offRampChannel.lanes.set(edgeId, offRampChannel.lanes.size);
  }
  const offRampLaneIndex = offRampChannel.lanes.get(edgeId)!;
  const offRampTotalLanes = offRampChannel.lanes.size;

  // 동적 차선 폭 계산
  const offRampChannelWidth =
    offRampChannel.direction === "horizontal"
      ? offRampChannel.geometry.h
      : offRampChannel.geometry.w;
  const offRampEffectiveLaneWidth = Math.min(
    baseLaneWidth,
    offRampChannelWidth / offRampTotalLanes
  );
  const offRampOffset =
    (offRampLaneIndex - (offRampTotalLanes - 1) / 2) *
    offRampEffectiveLaneWidth;

  let offRampProjection = { ...offRamp.projection };
  if (offRampChannel.direction === "horizontal") {
    offRampProjection.y += offRampOffset;
  } else {
    offRampProjection.x += offRampOffset;
  }

  const lastPathPt = path[path.length - 1];
  if (offRampChannel.direction === "horizontal") {
    path.push({ x: offRampProjection.x, y: lastPathPt.y });
  } else {
    path.push({ x: lastPathPt.x, y: offRampProjection.y });
  }

  path.push(offRampProjection);

  const isExitHorizontal = offRampChannel.direction === "vertical";
  if (isExitHorizontal) {
    path.push({ x: offRampProjection.x, y: offRamp.port.y });
  } else {
    path.push({ x: offRamp.port.x, y: offRampProjection.y });
  }
  path.push(offRamp.port);

  return path;
}

/**
 * 라우팅 실패 시 사용할 비상용 직선 경로를 생성
 */
function createFallbackPath(sourceNode: Node, targetNode: Node): Point[] {
  const sourcePort = {
    x: sourceNode.bbox.x + sourceNode.bbox.w / 2,
    y: sourceNode.bbox.y + sourceNode.bbox.h / 2,
  };
  const targetPort = {
    x: targetNode.bbox.x + targetNode.bbox.w / 2,
    y: targetNode.bbox.y + targetNode.bbox.h / 2,
  };
  const midPt = { x: targetPort.x, y: sourcePort.y };
  return [sourcePort, midPt, targetPort];
}
