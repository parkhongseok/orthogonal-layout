import type {
  Graph,
  Edge,
  BusNetwork,
  Point,
  BusChannel,
  Node,
  BusChannelId,
} from "@domain/types";
import { portPosition } from "@layout/port/assign";
import { PriorityQueue } from "@utils/priorityQueue";
import { manhattan } from "@utils/math";
import { cleanupCollinearPoints } from "@layout/routing/aStarStrategy/pathSmoother";

// [파일 전체를 이 내용으로 교체]

// Ramp: 노드의 포트와 버스 채널의 연결 지점 정보
interface Ramp {
  port: Point;
  channel: BusChannel;
  projection: Point; // 포트에서 채널 중심선으로 내린 수선의 발
  cost: number; // 포트에서 projection까지의 맨해튼 거리 비용
}

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
    const sourceNode = g.nodes.get(edge.sourceId)!;
    const targetNode = g.nodes.get(edge.targetId)!;

    // 1. 소스/타겟 노드에 연결 가능한 '모든' Ramp 후보를 찾습니다.
    const sourceRamps = findRampCandidates(sourceNode, network);
    const targetRamps = findRampCandidates(targetNode, network);

    // 후보가 하나도 없으면 경로 탐색이 불가능하므로, path를 비웁니다. (Fallback 처리 대상)
    if (sourceRamps.length === 0 || targetRamps.length === 0) {
      edge.path = [];
      continue;
    }

    // 2. [핵심] 다중 출발/도착 후보군 사이의 최적 경로를 탐색합니다.
    const result = findOptimalBusRoute(sourceRamps, targetRamps, network);

    // 3. 찾은 경로를 실제 좌표로 변환합니다.
    if (result) {
      edge.path = stitchPath(
        result.startRamp,
        result.endRamp,
        result.channelPath
      );
    } else {
      edge.path = []; // 경로 탐색 실패 시 Fallback 처리 대상
    }
  }

  return out;
}

/**
 * 노드에 연결될 수 있는 모든 유효한 Ramp 후보를 찾아 비용과 함께 반환합니다.
 */
function findRampCandidates(node: Node, network: BusNetwork): Ramp[] {
  const candidates: Ramp[] = [];
  if (!node.ports) return candidates;

  for (const portInfo of node.ports) {
    const portPos = portPosition(node, portInfo.side, portInfo.offset);
    for (const channel of network.channels.values()) {
      const isPortHorizontal =
        portInfo.side === "left" || portInfo.side === "right";
      const isChannelHorizontal = channel.direction === "horizontal";
      // 포트 방향과 채널 방향은 서로 수직이어야 연결 가능
      if (isPortHorizontal === isChannelHorizontal) continue;

      const projection = getProjectionOnChannel(portPos, channel);
      if (projection) {
        const cost = manhattan(portPos, projection);
        candidates.push({ port: portPos, channel, projection, cost });
      }
    }
  }
  return candidates;
}

// Bus 라우팅의 A* 탐색을 위한 노드 타입 정의
type BusPathNode = {
  id: BusChannelId;
  g: number; // 시작점부터 현재까지의 실제 비용
  f: number; // g + 휴리스틱 (총 예상 비용)
  cameFrom: BusPathNode | null;
};

/**
 * [2단계 핵심] 다중 출발/다중 도착 A* 알고리즘
 * @returns 최단 경로를 구성하는 { startRamp, endRamp, channelPath }
 */
function findOptimalBusRoute(
  startRamps: Ramp[],
  endRamps: Ramp[],
  network: BusNetwork
): { startRamp: Ramp; endRamp: Ramp; channelPath: BusChannel[] } | null {
  const openSet = new PriorityQueue<BusPathNode>((a, b) => a.f - b.f);
  const allNodes = new Map<BusChannelId, BusPathNode>();
  const endChannelIds = new Set(endRamps.map((r) => r.channel.id));

  // 1. 모든 시작 Ramp를 A* 탐색의 시작점으로 등록
  for (const ramp of startRamps) {
    // 휴리스틱(h): 현재 채널에서 가장 가까운 도착 채널까지의 직선 거리
    const h = Math.min(
      ...endRamps.map((er) =>
        manhattan(
          getCenter(ramp.channel.geometry),
          getCenter(er.channel.geometry)
        )
      )
    );
    const node: BusPathNode = {
      id: ramp.channel.id,
      g: ramp.cost, // g(비용)의 시작은 포트에서 채널까지의 진입 비용
      f: ramp.cost + h,
      cameFrom: null,
    };
    allNodes.set(ramp.channel.id, node);
    openSet.push(node);
  }

  let bestDestinationNode: BusPathNode | null = null;

  while (openSet.size > 0) {
    const current = openSet.pop()!;

    // 2. 도착 채널 중 하나에 도달하면, 탐색 성공
    if (endChannelIds.has(current.id)) {
      bestDestinationNode = current;
      break;
    }

    const neighbors = network.intersections.get(current.id) || [];
    for (const neighborId of neighbors) {
      const neighborChannel = network.channels.get(neighborId)!;
      const currentChannel = network.channels.get(current.id)!;
      // [수정] 비용 계산을 교차점(intersection) 기반의 실제 이동 거리로 변경
      const intersection = findIntersection(currentChannel, neighborChannel);
      const travelDistance = manhattan(
        getCenter(currentChannel.geometry),
        intersection
      );
      const gNew = current.g + travelDistance + (neighborChannel.cost ?? 1);

      const existing = allNodes.get(neighborId);
      if (!existing || gNew < existing.g) {
        const h = Math.min(
          ...endRamps.map((er) =>
            manhattan(
              getCenter(neighborChannel.geometry),
              getCenter(er.channel.geometry)
            )
          )
        );
        const newNode: BusPathNode = {
          id: neighborId,
          g: gNew,
          f: gNew + h,
          cameFrom: current,
        };
        allNodes.set(neighborId, newNode);
        openSet.push(newNode);
      }
    }
  }

  if (!bestDestinationNode) return null; // 경로 탐색 실패

  // 3. 최종 경로 역추적
  const channelPath: BusChannel[] = [];
  let p: BusPathNode | null = bestDestinationNode;
  while (p) {
    channelPath.push(network.channels.get(p.id)!);
    p = p.cameFrom;
  }
  channelPath.reverse();

  // 4. 경로에 사용된 실제 시작/종료 Ramp를 찾아서 반환
  const startRamp = startRamps.find((r) => r.channel.id === channelPath[0].id)!;
  const endRamp = endRamps.find(
    (r) => r.channel.id === bestDestinationNode!.id
  )!;

  return { startRamp, endRamp, channelPath };
}

/**
 * [단순화된 최종본] On-Ramp, Off-Ramp, 채널 경로를 합쳐 최종 직교 경로로 만듭니다.
 */
function stitchPath(
  startRamp: Ramp,
  endRamp: Ramp,
  channelPath: BusChannel[]
): Point[] {
  const path: Point[] = [];

  // 1. 시작 포트 -> On-Ramp 진입점
  path.push(startRamp.port);
  path.push(startRamp.projection);

  let currentPoint = startRamp.projection;

  // 2. 채널 경로 순회
  for (let i = 0; i < channelPath.length - 1; i++) {
    const intersection = findIntersection(channelPath[i], channelPath[i + 1]);

    // 현재 점에서 교차점까지 직선 이동
    if (channelPath[i].direction === "horizontal") {
      currentPoint = { x: intersection.x, y: currentPoint.y };
    } else {
      currentPoint = { x: currentPoint.x, y: intersection.y };
    }
    path.push(currentPoint);
    currentPoint = intersection; // 교차점으로 위치 업데이트
  }

  // 3. 마지막 교차점 -> Off-Ramp 진출점
  const lastChannel = channelPath[channelPath.length - 1];
  if (lastChannel.direction === "horizontal") {
    currentPoint = { x: endRamp.projection.x, y: currentPoint.y };
  } else {
    currentPoint = { x: currentPoint.x, y: endRamp.projection.y };
  }
  path.push(currentPoint);
  path.push(endRamp.projection);

  // 4. Off-Ramp 진출점 -> 도착 포트
  path.push(endRamp.port);

  return cleanupCollinearPoints(path);
}

// --- Helper 함수들 ---

function getProjectionOnChannel(
  point: Point,
  channel: BusChannel
): Point | null {
  const { x, y, w, h } = channel.geometry;
  if (channel.direction === "horizontal") {
    if (point.x >= x && point.x <= x + w) return { x: point.x, y: y + h / 2 };
  } else {
    if (point.y >= y && point.y <= y + h) return { x: x + w / 2, y: point.y };
  }
  return null;
}

function getCenter(rect: {
  x: number;
  y: number;
  w: number;
  h: number;
}): Point {
  return { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 };
}

function findIntersection(ch1: BusChannel, ch2: BusChannel): Point {
  const c1 = getCenter(ch1.geometry);
  const c2 = getCenter(ch2.geometry);
  // 수평 채널과 수직 채널의 교차점은, 수직 채널의 X 중심과 수평 채널의 Y 중심으로 구성됨
  return ch1.direction === "horizontal"
    ? { x: c2.x, y: c1.y }
    : { x: c1.x, y: c2.y };
}

// 비상용 경로는 path를 비워두어 Fallback 로직이 처리하도록 함
function createFallbackPath(sourceNode: Node, targetNode: Node): Point[] {
  return [];
}
