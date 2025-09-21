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

/**
 * BusNetwork를 이용해 그래프의 모든 엣지에 대한 직교 경로를 계산합니다.
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
 * 단일 엣지에 대한 최적의 버스 경로를 찾습니다.
 */
function findPathForEdge(
  edge: Edge,
  g: Graph,
  network: BusNetwork,
  cfg: any
): Point[] {
  const sourceNode = g.nodes.get(edge.sourceId)!;
  const targetNode = g.nodes.get(edge.targetId)!;

  // 1. On-Ramp: 소스 노드에서 가장 효율적인 시작 채널(과 포트) 찾기
  const onRamp = findBestRamp(sourceNode, network, "source");

  // 2. Off-Ramp: 타겟 노드에서 가장 효율적인 도착 채널(과 포트) 찾기
  const offRamp = findBestRamp(targetNode, network, "target");

  if (!onRamp || !offRamp) {
    // 적절한 진입/진출로를 찾지 못하면, 임시 직선 경로 반환
    return createFallbackPath(sourceNode, targetNode);
  }

  // 3. Highway: 네트워크 그래프에서 BFS로 최단 채널 경로 탐색
  const channelPath = findBusRoute(
    onRamp.channel.id,
    offRamp.channel.id,
    network
  );

  // 4. 경로 조합: 찾은 세 조각을 합쳐 최종 직교 경로 생성
  if (channelPath) {
    return stitchPath(onRamp, offRamp, channelPath, network, edge.id, cfg);
  } else {
    // 채널 간 경로가 없는 경우 (네트워크가 분리된 경우 등)
    return createFallbackPath(sourceNode, targetNode);
  }
}

// --- Helper Functions ---

interface Ramp {
  port: Point;
  channel: BusChannel;
  projection: Point; // 포트에서 채널로 내린 수선의 발
}

/**
 * 노드에서 버스 네트워크로 진입/진출하기 위한 최적의 Ramp를 찾습니다.
 */
function findBestRamp(
  node: Node,
  network: BusNetwork,
  type: "source" | "target"
): Ramp | null {
  let bestRamp: Ramp | null = null;
  let minCost = Infinity;

  // 디버깅 로그 1: 노드에 포트가 제대로 할당되었는지 확인
  if (!node.ports || node.ports.length === 0) {
    console.warn(`Node ${node.id} has no ports!`);
    return null;
  }

  for (const portInfo of node.ports || []) {
    const portPos = portPosition(node, portInfo.side, portInfo.offset);

    for (const channel of network.channels.values()) {
      // 포트 방향과 채널 방향이 수직이어야 직접 연결 가능
      const isPortHorizontal =
        portInfo.side === "left" || portInfo.side === "right";
      const isChannelHorizontal = channel.direction === "horizontal";
      if (isPortHorizontal === isChannelHorizontal) continue;

      const projection = getProjection(portPos, channel);
      if (projection) {
        // 디버깅 로그 2: 유효한 진입로 후보를 찾았는지 확인
        console.log(
          `Found a potential ramp for Node ${node.id} from port ${portInfo.side} to channel ${channel.id}`
        );
        const cost =
          Math.abs(portPos.x - projection.x) +
          Math.abs(portPos.y - projection.y);
        if (cost < minCost) {
          minCost = cost;
          bestRamp = { port: portPos, channel, projection };
        }
      }
    }
  }
  // 디버깅 로그 3: 최종적으로 선택된 Ramp가 있는지 확인
  if (!bestRamp) {
    console.error(`Could not find any valid ramp for Node ${node.id}`);
  }
  return bestRamp;
}

/**
 * 점에서 채널로 내린 수선의 발(projection)을 계산합니다. 점이 채널 범위 내에 있을 때만 유효합니다.
 */
function getProjection(point: Point, channel: BusChannel): Point | null {
  const { x, y, w, h } = channel.geometry;
  if (channel.direction === "horizontal") {
    if (point.x >= x && point.x <= x + w) {
      return { x: point.x, y: y + h / 2 };
    }
  } else {
    // vertical
    if (point.y >= y && point.y <= y + h) {
      return { x: x + w / 2, y: point.y };
    }
  }
  return null;
}

/**
 * BFS를 사용하여 두 채널 사이의 최단 경로(채널 ID 목록)를 찾습니다.
 */
function findBusRoute(
  startChannelId: string,
  endChannelId: string,
  network: BusNetwork
): string[] | null {
  if (startChannelId === endChannelId) return [startChannelId];

  const queue: string[][] = [[startChannelId]];
  const visited = new Set<string>([startChannelId]);

  while (queue.length > 0) {
    const path = queue.shift()!;
    const lastChannelId = path[path.length - 1];

    if (lastChannelId === endChannelId) {
      return path;
    }

    const neighbors = network.intersections.get(lastChannelId) || [];
    for (const neighborId of neighbors) {
      if (!visited.has(neighborId)) {
        visited.add(neighborId);
        const newPath = [...path, neighborId];
        queue.push(newPath);
      }
    }
  }
  return null; // 경로를 찾지 못함
}

/**
 * On-Ramp, Off-Ramp, 채널 경로를 합쳐 하나의 직교 경로(Point 배열)로 만듭니다.
 */

/**
 * [최종본] On-Ramp, Off-Ramp, 채널 경로를 '차선'을 적용하여 직교 경로로 최종 완성합니다.
 */
function stitchPath(
  onRamp: Ramp,
  offRamp: Ramp,
  channelIds: string[],
  network: BusNetwork,
  edgeId: EdgeId,
  cfg: any
): Point[] {
  // 차선 폭을 config에서 가져오거나 기본값을 사용합니다. (gridSize의 절반)
  const laneWidth = cfg.bus?.laneWidth ?? cfg.gridSize / 2;
  const path: Point[] = [onRamp.port];

  // --- On-Ramp 직교 경로 생성 ---
  const onRampChannel = onRamp.channel;
  // 이 엣지에 대한 차선 오프셋을 계산하고 할당합니다.
  if (!onRampChannel.lanes.has(edgeId)) {
    const laneIndex = onRampChannel.lanes.size;
    onRampChannel.lanes.set(edgeId, laneIndex);
  }
  const onRampLaneIndex = onRampChannel.lanes.get(edgeId)!;
  const onRampTotalLanes = onRampChannel.lanes.size;
  const onRampOffset =
    (onRampLaneIndex - (onRampTotalLanes - 1) / 2) * laneWidth;

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

    // 현재 채널에 대한 차선 오프셋 계산
    if (!currentChannel.lanes.has(edgeId)) {
      const laneIndex = currentChannel.lanes.size;
      currentChannel.lanes.set(edgeId, laneIndex);
    }
    const currentLaneIndex = currentChannel.lanes.get(edgeId)!;
    const currentTotalLanes = currentChannel.lanes.size;
    const currentOffset =
      (currentLaneIndex - (currentTotalLanes - 1) / 2) * laneWidth;

    // 이전 지점에서 현재 채널의 차선까지 이동
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

    // 다음 채널과의 교차점 계산
    if (nextChannel) {
      // 다음 채널에 대한 차선 오프셋 계산
      if (!nextChannel.lanes.has(edgeId)) {
        const laneIndex = nextChannel.lanes.size;
        nextChannel.lanes.set(edgeId, laneIndex);
      }
      const nextLaneIndex = nextChannel.lanes.get(edgeId)!;
      const nextTotalLanes = nextChannel.lanes.size;
      const nextOffset = (nextLaneIndex - (nextTotalLanes - 1) / 2) * laneWidth;

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
  const offRampOffset = offRampChannel.lanes.get(edgeId)! * laneWidth; // 이미 할당됨
  let offRampProjection = { ...offRamp.projection };
  if (offRampChannel.direction === "horizontal") {
    offRampProjection.y += offRampOffset;
  } else {
    offRampProjection.x += offRampOffset;
  }

  // 마지막 교차점에서 offRampProjection까지 차선을 따라 이동
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
 * 라우팅 실패 시 사용할 비상용 직선 경로를 생성합니다.
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
