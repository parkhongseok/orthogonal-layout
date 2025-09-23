// src/layout/routing/busStrategy/visibility.ts

import {
  Graph,
  Point,
  Rect,
  VisibilityGraph,
  RoutingVertex,
  GroupId,
} from "@domain/types";
import { portPosition } from "@layout/port/assign";

// --- 헬퍼 함수 ---

/**
 * 점이 사각형 내부에 있는지 정밀하게 확인 (strict=true 시 경계 제외)
 */
function isPointInRect(p: Point, rect: Rect, strict: boolean = false): boolean {
  const epsilon = strict ? 0.1 : -0.1; // strict가 아닐 때 경계를 포함하도록 허용
  return (
    p.x > rect.x + epsilon &&
    p.x < rect.x + rect.w - epsilon &&
    p.y > rect.y + epsilon &&
    p.y < rect.y + rect.h - epsilon
  );
}

/**
 * 주어진 점이 장애물 목록 중 하나라도 내부에 포함되는지 확인
 */
function isObstructed(point: Point, obstacles: Rect[]): boolean {
  return obstacles.some((obs) => isPointInRect(point, obs, true));
}

/**
 * 두 점을 잇는 직선 경로가 장애물에 의해 막히는지 확인
 */
function isPathObstructed(p1: Point, p2: Point, obstacles: Rect[]): boolean {
  for (const obs of obstacles) {
    const minX = Math.min(p1.x, p2.x),
      maxX = Math.max(p1.x, p2.x);
    const minY = Math.min(p1.y, p2.y),
      maxY = Math.max(p1.y, p2.y);
    if (
      maxX <= obs.x ||
      minX >= obs.x + obs.w ||
      maxY <= obs.y ||
      minY >= obs.y + obs.h
    )
      continue;

    const isHorizontal = Math.abs(p1.y - p2.y) < 1;
    if (isHorizontal) {
      if (
        p1.y > obs.y &&
        p1.y < obs.y + obs.h &&
        minX < obs.x + obs.w &&
        maxX > obs.x
      )
        return true;
    } else {
      // 수직 경로
      if (
        p1.x > obs.x &&
        p1.x < obs.x + obs.w &&
        minY < obs.y + obs.h &&
        maxY > obs.y
      )
        return true;
    }
  }
  return false;
}

/**
 * [Phase 1] 그래프의 모든 요소를 기반으로 통합된 축을 추출
 */
function extractAllAxes(
  g: Graph,
  margin: number
): { sortedXAxes: number[]; sortedYAxes: number[] } {
  const xAxes = new Set<number>();
  const yAxes = new Set<number>();
  const subjects = [...g.nodes.values(), ...g.groups.values()];

  for (const subject of subjects) {
    xAxes.add(subject.bbox.x - margin);
    xAxes.add(subject.bbox.x + subject.bbox.w + margin);
    yAxes.add(subject.bbox.y - margin);
    yAxes.add(subject.bbox.y + subject.bbox.h + margin);
    if ("ports" in subject && subject.ports) {
      for (const port of subject.ports) {
        const pPos = portPosition(subject, port.side, port.offset);
        if (port.side === "top" || port.side === "bottom") xAxes.add(pPos.x);
        else yAxes.add(pPos.y);
      }
    }
  }
  return {
    sortedXAxes: Array.from(xAxes).sort((a, b) => a - b),
    sortedYAxes: Array.from(yAxes).sort((a, b) => a - b),
  };
}

/**
 * [Phase 2] '통합 축' 기반 하이브리드 정점 생성
 */
export function createRoutingVertices(g: Graph, cfg: any): RoutingVertex[] {
  const margin = (cfg.routing.bboxExpand * cfg.gridSize) ;
  const finalVertices: RoutingVertex[] = [];
  const vertexKeys = new Set<string>();
  let vertexIdCounter = 0;

  const addVertex = (p: Point, owner: GroupId | undefined) => {
    const key = `${Math.round(p.x)},${Math.round(p.y)}`;
    if (vertexKeys.has(key)) return;
    vertexKeys.add(key);
    finalVertices.push({ ...p, id: vertexIdCounter++, owner });
  };

  const allGroups = Array.from(g.groups.values());
  const allNodes = Array.from(g.nodes.values());
  const allNodeObstacles = allNodes.map((n) => n.bbox);
  const worldObstacles = [...allNodeObstacles, ...allGroups.map((g) => g.bbox)];

  // 1. 통합 축 추출
  const { sortedXAxes, sortedYAxes } = extractAllAxes(g, margin);

  // 2. 교차점 기반 하이브리드 정점 생성
  for (const x of sortedXAxes) {
    for (const y of sortedYAxes) {
      const p = { x, y };
      const ownerGroup = allGroups.find((g) => isPointInRect(p, g.bbox));

      if (ownerGroup) {
        const internalObstacles = ownerGroup.children.map(
          (id) => g.nodes.get(id)!.bbox
        );
        if (!isObstructed(p, internalObstacles)) {
          addVertex(p, ownerGroup.id);
        }
      } else {
        if (!isObstructed(p, worldObstacles)) {
          addVertex(p, undefined);
        }
      }
    }
  }

  // 3. 포트 진입 정점 생성
  for (const node of allNodes) {
    if (!node.ports) continue;
    const ownerGroup = node.groupId ? g.groups.get(node.groupId) : undefined;
    const obstacles = ownerGroup
      ? ownerGroup.children.map((id) => g.nodes.get(id)!.bbox)
      : worldObstacles;

    for (const port of node.ports) {
      const pPos = portPosition(node, port.side, port.offset);
      let entryPoint: Point | undefined;

      if (port.side === "left" || port.side === "right") {
        const targetX =
          port.side === "left"
            ? sortedXAxes.filter((x) => x < pPos.x).pop()
            : sortedXAxes.find((x) => x > pPos.x);
        if (targetX !== undefined) entryPoint = { x: targetX, y: pPos.y };
      } else {
        const targetY =
          port.side === "top"
            ? sortedYAxes.filter((y) => y < pPos.y).pop()
            : sortedYAxes.find((y) => y > pPos.y);
        if (targetY !== undefined) entryPoint = { x: pPos.x, y: targetY };
      }

      if (
        entryPoint &&
        !isPathObstructed(
          pPos,
          entryPoint,
          obstacles.filter((o) => o !== node.bbox)
        )
      ) {
        addVertex(entryPoint, ownerGroup?.id);
      }
    }
  }

  console.log(`Generated ${finalVertices.length} hybrid routing vertices.`);
  return finalVertices;
}

/**
 * [Phase 3] '2-Pass + 게이트웨이' 방식으로 가시성 그래프 구축
 */
export function buildVisibilityGraph(
  vertices: RoutingVertex[],
  g: Graph
): VisibilityGraph {
  const visibilityGraph: VisibilityGraph = {
    vertices,
    adjacency: new Map(vertices.map((v) => [v.id, []])),
    edgeUsage: new Map(),
  };
  const allNodeObstacles = Array.from(g.nodes.values()).map((n) => n.bbox);

  // 1. 같은 소속(owner) 내에서의 연결
  const verticesByOwner = new Map<GroupId | "world", RoutingVertex[]>();
  for (const v of vertices) {
    const ownerKey = v.owner || "world";
    if (!verticesByOwner.has(ownerKey)) verticesByOwner.set(ownerKey, []);
    verticesByOwner.get(ownerKey)!.push(v);
  }

  for (const [ownerKey, ownedVertices] of verticesByOwner.entries()) {
    const obstacles =
      ownerKey === "world"
        ? allNodeObstacles
        : g.groups.get(ownerKey)!.children.map((id) => g.nodes.get(id)!.bbox);
    connectAlignedVertices(ownedVertices, obstacles, visibilityGraph);
  }

  // 2. 그룹 <-> 월드 간 '게이트웨이' 연결
  const worldVertices = verticesByOwner.get("world") || [];
  for (const group of g.groups.values()) {
    const internalVertices = verticesByOwner.get(group.id) || [];
    for (const internalV of internalVertices) {
      for (const worldV of worldVertices) {
        if (
          Math.abs(internalV.x - worldV.x) < 1 ||
          Math.abs(internalV.y - worldV.y) < 1
        ) {
          if (!isPathObstructed(internalV, worldV, allNodeObstacles)) {
            visibilityGraph.adjacency.get(internalV.id)!.push(worldV.id);
            visibilityGraph.adjacency.get(worldV.id)!.push(internalV.id);
          }
        }
      }
    }
  }

  const edgeCount =
    Array.from(visibilityGraph.adjacency.values()).flat().length / 2;
  console.log(
    `Built visibility graph with ${vertices.length} vertices and ${edgeCount} edges.`
  );
  return visibilityGraph;
}

/**
 * [헬퍼] 정렬된 정점들을 수평/수직으로 연결하는 로직
 */
function connectAlignedVertices(
  vertexGroup: RoutingVertex[],
  obstacles: Rect[],
  graph: VisibilityGraph
) {
  // 수평 연결
  const verticesByY = new Map<number, RoutingVertex[]>();
  for (const v of vertexGroup) {
    const yKey = Math.round(v.y);
    if (!verticesByY.has(yKey)) verticesByY.set(yKey, []);
    verticesByY.get(yKey)!.push(v);
  }
  for (const yGroup of verticesByY.values()) {
    yGroup.sort((a, b) => a.x - b.x);
    for (let i = 0; i < yGroup.length - 1; i++) {
      const v1 = yGroup[i],
        v2 = yGroup[i + 1];
      if (!isPathObstructed(v1, v2, obstacles)) {
        graph.adjacency.get(v1.id)!.push(v2.id);
        graph.adjacency.get(v2.id)!.push(v1.id);
      }
    }
  }
  // 수직 연결
  const verticesByX = new Map<number, RoutingVertex[]>();
  for (const v of vertexGroup) {
    const xKey = Math.round(v.x);
    if (!verticesByX.has(xKey)) verticesByX.set(xKey, []);
    verticesByX.get(xKey)!.push(v);
  }
  for (const xGroup of verticesByX.values()) {
    xGroup.sort((a, b) => a.y - b.y);
    for (let i = 0; i < xGroup.length - 1; i++) {
      const v1 = xGroup[i],
        v2 = xGroup[i + 1];
      if (!isPathObstructed(v1, v2, obstacles)) {
        graph.adjacency.get(v1.id)!.push(v2.id);
        graph.adjacency.get(v2.id)!.push(v1.id);
      }
    }
  }
}
