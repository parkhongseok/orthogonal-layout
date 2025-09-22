import {
  Graph,
  Point,
  Rect,
  VisibilityGraph,
  RoutingVertex,
  GroupId,
} from "@domain/types";
import { computeWorldBounds } from "@render/world";

function isPointInRect(point: Point, rect: Rect): boolean {
  return (
    point.x > rect.x &&
    point.x < rect.x + rect.w &&
    point.y > rect.y &&
    point.y < rect.y + rect.h
  );
}

function createVerticesInArea(area: Rect, obstacles: Rect[]): Point[] {
  const xCoords = new Set<number>([area.x, area.x + area.w]);
  const yCoords = new Set<number>([area.y, area.y + area.h]);
  obstacles.forEach((obs) => {
    if (obs.x < area.x + area.w && obs.x + obs.w > area.x) {
      xCoords.add(obs.x);
      xCoords.add(obs.x + obs.w);
    }
    if (obs.y < area.y + area.h && obs.y + obs.h > area.y) {
      yCoords.add(obs.y);
      yCoords.add(obs.y + obs.h);
    }
  });
  const sortedX = Array.from(xCoords).sort((a, b) => a - b);
  const sortedY = Array.from(yCoords).sort((a, b) => a - b);
  const vertices: Point[] = [];
  for (let i = 0; i < sortedY.length - 1; i++) {
    for (let j = 0; j < sortedX.length - 1; j++) {
      const tile: Rect = {
        y: sortedY[i],
        h: sortedY[i + 1] - sortedY[i],
        x: sortedX[j],
        w: sortedX[j + 1] - sortedX[j],
      };
      if (tile.w < 1 || tile.h < 1) continue;
      const center: Point = { x: tile.x + tile.w / 2, y: tile.y + tile.h / 2 };
      const isInsideObstacle = obstacles.some((obs) =>
        isPointInRect(center, obs)
      );
      if (!isInsideObstacle) {
        vertices.push(center);
      }
    }
  }
  return vertices;
}

export function createRoutingVertices(g: Graph): RoutingVertex[] {
  const world = computeWorldBounds(g);
  let allVertices: RoutingVertex[] = [];
  let vertexIdCounter = 0;

  const allNodes = Array.from(g.nodes.values());
  const allGroups = Array.from(g.groups.values());

  const topLevelObstacles: Rect[] = [
    ...allNodes.map((n) => n.bbox),
    ...allGroups.map((grp) => grp.bbox),
  ];
  const topLevelPoints = createVerticesInArea(world, topLevelObstacles);
  topLevelPoints.forEach((p) => {
    allVertices.push({ ...p, id: vertexIdCounter++, owner: undefined });
  });

  for (const group of allGroups) {
    const childNodes = group.children
      .map((childId) => g.nodes.get(childId)!)
      .filter(Boolean);
    const internalObstacles = childNodes.map((n) => n.bbox);

    const internalPoints = createVerticesInArea(group.bbox, internalObstacles);
    internalPoints.forEach((p) => {
      if (
        p.x > group.bbox.x &&
        p.x < group.bbox.x + group.bbox.w &&
        p.y > group.bbox.y &&
        p.y < group.bbox.y + group.bbox.h
      ) {
        allVertices.push({ ...p, id: vertexIdCounter++, owner: group.id });
      }
    });
  }

  console.log(`Generated ${allVertices.length} total routing vertices.`);
  return allVertices;
}

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

export function buildVisibilityGraph(
  vertices: RoutingVertex[],
  graphData: Graph
): VisibilityGraph {
  const visibilityGraph: VisibilityGraph = {
    vertices,
    adjacency: new Map(),
    edgeUsage: new Map(),
  };

  const allNodes = Array.from(graphData.nodes.values());
  const allGroups = Array.from(graphData.groups.values());
  const allObstacles = [
    ...allNodes.map((n) => n.bbox),
    ...allGroups.map((g) => g.bbox),
  ];

  for (const v of vertices) {
    visibilityGraph.adjacency.set(v.id, []);
  }

  const topLevelVertices = vertices.filter((v) => !v.owner);
  const groupVertices = new Map<GroupId, RoutingVertex[]>();
  for (const group of allGroups) {
    groupVertices.set(
      group.id,
      vertices.filter((v) => v.owner === group.id)
    );
  }

  for (let i = 0; i < topLevelVertices.length; i++) {
    for (let j = i + 1; j < topLevelVertices.length; j++) {
      const v1 = topLevelVertices[i];
      const v2 = topLevelVertices[j];
      if (
        (Math.abs(v1.x - v2.x) < 1 || Math.abs(v1.y - v2.y) < 1) &&
        !isPathObstructed(v1, v2, allObstacles)
      ) {
        visibilityGraph.adjacency.get(v1.id)!.push(v2.id);
        visibilityGraph.adjacency.get(v2.id)!.push(v1.id);
      }
    }
  }

  for (const group of allGroups) {
    const internalVertices = groupVertices.get(group.id) || [];
    const internalObstacles = group.children.map(
      (id) => graphData.nodes.get(id)!.bbox
    );

    // 💡 --- 수정된 부분 ---
    // '관문' 연결 시 현재 그룹의 bbox는 장애물에서 제외합니다.
    const gatewayCheckObstacles = allObstacles.filter(
      (obs) => obs !== group.bbox
    );
    // 💡 --- 여기까지 수정 ---

    for (let i = 0; i < internalVertices.length; i++) {
      for (let j = i + 1; j < internalVertices.length; j++) {
        const v1 = internalVertices[i];
        const v2 = internalVertices[j];
        if (
          (Math.abs(v1.x - v2.x) < 1 || Math.abs(v1.y - v2.y) < 1) &&
          !isPathObstructed(v1, v2, internalObstacles)
        ) {
          visibilityGraph.adjacency.get(v1.id)!.push(v2.id);
          visibilityGraph.adjacency.get(v2.id)!.push(v1.id);
        }
      }
    }

    for (const internal of internalVertices) {
      for (const external of topLevelVertices) {
        if (
          Math.abs(internal.x - external.x) < 1 ||
          Math.abs(internal.y - external.y) < 1
        ) {
          // 수정된 장애물 목록으로 '관문' 연결을 검사합니다.
          if (!isPathObstructed(internal, external, gatewayCheckObstacles)) {
            visibilityGraph.adjacency.get(internal.id)!.push(external.id);
            visibilityGraph.adjacency.get(external.id)!.push(internal.id);
          }
        }
      }
    }
  }

  console.log(`Built visibility graph with ${vertices.length} vertices.`);
  return visibilityGraph;
}
