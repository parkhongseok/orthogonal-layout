import type {
  Graph,
  Point,
  Rect,
  RoutingVertex,
  VisibilityGraph,
  Node,
  PortSide,
} from "@domain/types";
import { manhattan } from "@utils/math";
import { assignPorts, portPosition } from "@layout/port/assign";
import { PriorityQueue } from "@utils/priorityQueue";
import { cleanupCollinearPoints } from "../aStarStrategy/pathSmoother";
import { getCandidateSides } from "../aStarStrategy/portSelector"; // 💡 포트 후보군 탐색 함수 임포트
import { initialPlacement } from "@layout/placement/initPlacement";
import { sweepCompact } from "@layout/compaction/sweep";
import { resolveOverlap } from "@layout/placement/resolveOverlap";
import { RoutingStrategy } from "../strategy";
import { buildVisibilityGraph, createRoutingVertices } from "./visibility";
import { setLastRoutingVertices, setLastVisibilityGraph } from "@render/debug";

export class BusRoutingStrategy implements RoutingStrategy {
  public execute(graph: Graph, cfg: any): Graph {
    let cur = graph;
    console.log("Executing Final: Axis-based Bus Routing Strategy");

    // 1. 노드 위치 결정
    cur = initialPlacement(cur, cfg);
    cur = resolveOverlap(cur, cfg);
    cur = sweepCompact(cur, cfg);

    // 2. 포트 할당
    cur = assignPorts(cur, cfg);

    // 3. 라우팅 네트워크 구축 (Phase 1, 2, 3)
    const vertices = createRoutingVertices(cur, cfg);
    setLastRoutingVertices(vertices);
    const visibilityGraph = buildVisibilityGraph(vertices, cur);
    setLastVisibilityGraph(visibilityGraph);

    // 4. 경로 탐색 및 직교화 (Phase 4A)
    cur = routeOnVisibilityGraph(cur, visibilityGraph, cfg);

    // 5. 최종 경로 분리 및 다듬기 (Phase 4B)
    cur = finalizePaths(cur, visibilityGraph, cfg);

    return cur;
  }
}

/**
 * [Phase 4B: 최종] 경로들을 순회하며, 겹치는 경로 세그먼트에 '차선'을 할당하여 시각적으로 분리
 */
function finalizePaths(
  g: Graph,
  visibilityGraph: VisibilityGraph,
  cfg: any
): Graph {
  const out = { ...g, edges: new Map(g.edges) };
  const laneWidth = cfg.bus?.laneWidth ?? 8;

  // 1. 어떤 경로 세그먼트(v1-v2)를 어떤 엣지들이 사용하는지 집계
  const segmentUsage = new Map<string, string[]>();
  for (const edge of out.edges.values()) {
    if (!edge.vertexPath) continue;
    for (let i = 0; i < edge.vertexPath.length - 1; i++) {
      const segKey = [edge.vertexPath[i], edge.vertexPath[i + 1]]
        .sort()
        .join("-");
      if (!segmentUsage.has(segKey)) segmentUsage.set(segKey, []);
      segmentUsage.get(segKey)!.push(edge.id);
    }
  }

  // 2. 각 엣지별로 사용할 차선(오프셋)을 미리 계산
  const laneAssignments = new Map<string, number>();
  segmentUsage.forEach((edgeIds, segKey) => {
    edgeIds.sort(); // ID 기준 정렬로 차선 할당 순서 고정
    const totalLanes = edgeIds.length;
    edgeIds.forEach((edgeId, index) => {
      const offset = (index - (totalLanes - 1) / 2) * laneWidth;
      laneAssignments.set(`${edgeId}-${segKey}`, offset);
    });
  });

  // 3. 오프셋을 적용하여 모든 엣지의 경로를 재계산
  for (const edge of out.edges.values()) {
    if (!edge.vertexPath || !edge.path || edge.path.length < 2) continue;

    const newPath: Point[] = [edge.path[0]];
    const vertices = visibilityGraph.vertices;

    for (let i = 0; i < edge.vertexPath.length; i++) {
      const vCurrId = edge.vertexPath[i];
      const vCurr = { ...vertices[vCurrId] }; // 원본 수정을 막기 위해 복사

      if (i > 0) {
        // 들어오는 세그먼트 오프셋 적용
        const vPrevId = edge.vertexPath[i - 1];
        const segKey = [vPrevId, vCurrId].sort().join("-");
        const offset = laneAssignments.get(`${edge.id}-${segKey}`) || 0;
        if (Math.abs(vertices[vPrevId].y - vCurr.y) < 1)
          vCurr.y += offset; // Horizontal
        else vCurr.x += offset; // Vertical
      }

      if (i < edge.vertexPath.length - 1) {
        // 나가는 세그먼트 오프셋 적용
        const vNextId = edge.vertexPath[i + 1];
        const segKey = [vCurrId, vNextId].sort().join("-");
        const offset = laneAssignments.get(`${edge.id}-${segKey}`) || 0;
        if (Math.abs(vertices[vNextId].y - vCurr.y) < 1)
          vCurr.y += offset; // Horizontal
        else vCurr.x += offset; // Vertical
      }

      const lastPoint = newPath[newPath.length - 1];
      if (
        Math.abs(lastPoint.x - vCurr.x) > 1 &&
        Math.abs(lastPoint.y - vCurr.y) > 1
      ) {
        const prevVertex = i > 0 ? vertices[edge.vertexPath[i - 1]] : lastPoint;
        if (Math.abs(prevVertex.y - vCurr.y) > 1) {
          newPath.push({ x: vCurr.x, y: lastPoint.y });
        } else {
          newPath.push({ x: lastPoint.x, y: vCurr.y });
        }
      }
      newPath.push(vCurr);
    }

    newPath.push(edge.path[edge.path.length - 1]);

    out.edges.set(edge.id, { ...edge, path: cleanupCollinearPoints(newPath) });
  }

  return out;
}

type AStarNode = {
  vertexId: number;
  g: number;
  f: number;
  cameFrom: number | null;
};

function isPathObstructed(p1: Point, p2: Point, obstacles: Rect[]): boolean {
  for (const obs of obstacles) {
    const minX = Math.min(p1.x, p2.x);
    const maxX = Math.max(p1.x, p2.x);
    const minY = Math.min(p1.y, p2.y);
    const maxY = Math.max(p1.y, p2.y);

    if (
      obs.x >= maxX ||
      obs.x + obs.w <= minX ||
      obs.y >= maxY ||
      obs.y + obs.h <= minY
    ) {
      continue;
    }
    if (Math.abs(p1.y - p2.y) < 1) {
      if (
        p1.y > obs.y &&
        p1.y < obs.y + obs.h &&
        minX < obs.x + obs.w &&
        maxX > obs.x
      ) {
        return true;
      }
    } else if (Math.abs(p1.x - p2.x) < 1) {
      if (
        p1.x > obs.x &&
        p1.x < obs.x + obs.w &&
        minY < obs.y + obs.h &&
        maxY > obs.y
      ) {
        return true;
      }
    }
  }
  return false;
}

function findPathOnGraph(
  startVertexId: number,
  endVertexId: number,
  graph: VisibilityGraph,
  congestionPenalty: number
): number[] | null {
  const openSet = new PriorityQueue<AStarNode>((a, b) => a.f - b.f);
  const allNodes = new Map<number, AStarNode>();
  const endVertex = graph.vertices[endVertexId];

  const startNode: AStarNode = {
    vertexId: startVertexId,
    g: 0,
    f: manhattan(graph.vertices[startVertexId], endVertex),
    cameFrom: null,
  };
  allNodes.set(startVertexId, startNode);
  openSet.push(startNode);

  while (openSet.size > 0) {
    const current = openSet.pop()!;
    if (current.vertexId === endVertexId) {
      const path = [];
      let p: AStarNode | undefined = current;
      while (p) {
        path.push(p.vertexId);
        p = p.cameFrom !== null ? allNodes.get(p.cameFrom) : undefined;
      }
      return path.reverse();
    }

    const neighbors = graph.adjacency.get(current.vertexId) || [];
    for (const neighborId of neighbors) {
      const currentVertex = graph.vertices[current.vertexId];
      const neighborVertex = graph.vertices[neighborId];
      const edgeKey = [current.vertexId, neighborId].sort().join("-");
      const congestion = graph.edgeUsage.get(edgeKey) || 0;

      const gNew =
        current.g +
        manhattan(currentVertex, neighborVertex) +
        congestion * congestionPenalty;

      const existing = allNodes.get(neighborId);
      if (!existing || gNew < existing.g) {
        const h = manhattan(neighborVertex, endVertex);
        const fNew = gNew + h;
        const newNode: AStarNode = {
          vertexId: neighborId,
          g: gNew,
          f: fNew,
          cameFrom: current.vertexId,
        };
        allNodes.set(neighborId, newNode);
        openSet.push(newNode);
      }
    }
  }
  return null;
}

/**
 * [1단계 개선] 노드와 타겟 노드의 상대 위치를 고려하여 최적의 '진입 지점' 정보를 찾습니다.
 */
function findRampInfo(
  node: Node,
  targetNode: Node,
  graph: VisibilityGraph,
  allObstacles: Rect[]
): { vertex: RoutingVertex; port: Point; side: PortSide } | null {
  let bestVertex: RoutingVertex | null = null;
  let bestPort: Point | null = null;
  let bestSide: PortSide | null = null;
  let minCost = Infinity;

  const obstaclesWithoutSelf = allObstacles.filter(
    (obs) =>
      obs.x !== node.bbox.x ||
      obs.y !== node.bbox.y ||
      obs.w !== node.bbox.w ||
      obs.h !== node.bbox.h
  );

  // 두 노드의 상대 위치를 기반으로 가장 이상적인 포트 면(side)부터 순서대로 가져옵니다.
  const candidateSides = getCandidateSides(node, targetNode).map(
    (sides) => sides[0]
  );

  // 이상적인 면부터 차례대로 탐색합니다.
  for (const side of candidateSides) {
    const portsOnSide = (node.ports || []).filter((p) => p.side === side);
    for (const portInfo of portsOnSide) {
      const portPos = portPosition(node, portInfo.side, portInfo.offset);
      for (const vertex of graph.vertices) {
        if (vertex.owner !== node.groupId) continue;
        if (isPathObstructed(portPos, vertex, obstaclesWithoutSelf)) continue;

        const cost = manhattan(portPos, vertex);
        if (cost < minCost) {
          minCost = cost;
          bestVertex = vertex;
          bestPort = portPos;
          bestSide = portInfo.side;
        }
      }
    }
    // 현재 면에서 최적의 경로를 찾았다면, 더 낮은 우선순위의 면은 탐색하지 않고 바로 반환합니다.
    if (bestVertex) {
      return { vertex: bestVertex, port: bestPort!, side: bestSide! };
    }
  }

  // 만약 이상적인 면에서 유효한 경로를 찾지 못했다면 null을 반환합니다.
  return null;
}

function stitchPath(
  startPort: Point,
  endPort: Point,
  vertexPath: RoutingVertex[]
): Point[] {
  const waypoints: Point[] = [startPort, ...vertexPath, endPort];
  if (waypoints.length < 2) return waypoints;

  const path: Point[] = [waypoints[0]];

  for (let i = 1; i < waypoints.length; i++) {
    const prev = path[path.length - 1];
    const curr = waypoints[i];

    if (Math.abs(prev.x - curr.x) > 1 && Math.abs(prev.y - curr.y) > 1) {
      const prevPrev = path.length > 1 ? path[path.length - 2] : prev;
      if (Math.abs(prevPrev.y - prev.y) < 1) {
        path.push({ x: curr.x, y: prev.y });
      } else {
        path.push({ x: prev.x, y: curr.y });
      }
    }
    path.push(curr);
  }

  return cleanupCollinearPoints(path);
}

export function routeOnVisibilityGraph(
  g: Graph,
  visibilityGraph: VisibilityGraph,
  cfg: any
): Graph {
  const out = { ...g, edges: new Map(g.edges) };
  const allObstacles = [
    ...Array.from(out.nodes.values()).map((n) => n.bbox),
    ...Array.from(out.groups.values()).map((g) => g.bbox),
  ];

  const edgesToRoute = Array.from(out.edges.values()).sort((a, b) => {
    const nodeA_source = out.nodes.get(a.sourceId)!;
    const nodeA_target = out.nodes.get(a.targetId)!;
    const distA = manhattan(nodeA_source.bbox, nodeA_target.bbox);
    const nodeB_source = out.nodes.get(b.sourceId)!;
    const nodeB_target = out.nodes.get(b.targetId)!;
    const distB = manhattan(nodeB_source.bbox, nodeB_target.bbox);
    return distB - distA;
  });

  for (const edge of edgesToRoute) {
    const sourceNode = out.nodes.get(edge.sourceId)!;
    const targetNode = out.nodes.get(edge.targetId)!;

    // findRampInfo 호출 시 상대 노드를 함께 전달합니다.
    const startInfo = findRampInfo(
      sourceNode,
      targetNode,
      visibilityGraph,
      allObstacles
    );
    const endInfo = findRampInfo(
      targetNode,
      sourceNode,
      visibilityGraph,
      allObstacles
    );

    if (startInfo && endInfo) {
      const vertexIdPath = findPathOnGraph(
        startInfo.vertex.id,
        endInfo.vertex.id,
        visibilityGraph,
        cfg.bus.congestionPenalty
      );

      if (vertexIdPath) {
        for (let i = 0; i < vertexIdPath.length - 1; i++) {
          const edgeKey = [vertexIdPath[i], vertexIdPath[i + 1]]
            .sort()
            .join("-");
          const currentUsage = visibilityGraph.edgeUsage.get(edgeKey) || 0;
          visibilityGraph.edgeUsage.set(edgeKey, currentUsage + 1);
        }

        const vertexPath = vertexIdPath.map(
          (id) => visibilityGraph.vertices[id]
        );

        const finalPath = stitchPath(startInfo.port, endInfo.port, vertexPath);

        // 경로와 함께 정점 리스트(vertexIdPath)도 엣지에 저장
        out.edges.set(edge.id, {
          ...edge,
          path: finalPath,
          vertexPath: vertexIdPath,
        });
        continue;
      }
    }

    const sPos = startInfo?.port || portPosition(sourceNode, "right", 0.5);
    const tPos = endInfo?.port || portPosition(targetNode, "left", 0.5);
    out.edges.set(edge.id, {
      ...edge,
      path: [sPos, { x: tPos.x, y: sPos.y }, tPos],
    });
  }

  return out;
}
