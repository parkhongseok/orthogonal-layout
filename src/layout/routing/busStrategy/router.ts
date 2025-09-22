import type { Graph, Point, Rect, RoutingVertex, VisibilityGraph, Node, PortSide } from "@domain/types";
import { manhattan } from "@utils/math";
import { portPosition } from "@layout/port/assign";
import { PriorityQueue } from "@utils/priorityQueue";
import { cleanupCollinearPoints } from "../aStarStrategy/pathSmoother";

type AStarNode = { vertexId: number; g: number; f: number; cameFrom: number | null };

function isPathObstructed(p1: Point, p2: Point, obstacles: Rect[]): boolean {
  for (const obs of obstacles) {
    const minX = Math.min(p1.x, p2.x);
    const maxX = Math.max(p1.x, p2.x);
    const minY = Math.min(p1.y, p2.y);
    const maxY = Math.max(p1.y, p2.y);

    if (obs.x >= maxX || obs.x + obs.w <= minX || obs.y >= maxY || obs.y + obs.h <= minY) {
      continue;
    }
    if (Math.abs(p1.y - p2.y) < 1) {
      if (p1.y > obs.y && p1.y < obs.y + obs.h && minX < obs.x + obs.w && maxX > obs.x) {
        return true;
      }
    } else if (Math.abs(p1.x - p2.x) < 1) {
      if (p1.x > obs.x && p1.x < obs.x + obs.w && minY < obs.y + obs.h && maxY > obs.y) {
        return true;
      }
    }
  }
  return false;
}

function findPathOnGraph(startVertexId: number, endVertexId: number, graph: VisibilityGraph, congestionPenalty: number): number[] | null {
  const openSet = new PriorityQueue<AStarNode>((a, b) => a.f - b.f);
  const allNodes = new Map<number, AStarNode>();
  const endVertex = graph.vertices[endVertexId];

  const startNode: AStarNode = { vertexId: startVertexId, g: 0, f: manhattan(graph.vertices[startVertexId], endVertex), cameFrom: null };
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
      
      const gNew = current.g + manhattan(currentVertex, neighborVertex) + (congestion * congestionPenalty);

      const existing = allNodes.get(neighborId);
      if (!existing || gNew < existing.g) {
        const h = manhattan(neighborVertex, endVertex);
        const fNew = gNew + h;
        const newNode: AStarNode = { vertexId: neighborId, g: gNew, f: fNew, cameFrom: current.vertexId };
        allNodes.set(neighborId, newNode);
        openSet.push(newNode);
      }
    }
  }
  return null;
}

function findRampInfo(node: Node, graph: VisibilityGraph, allObstacles: Rect[]): { vertex: RoutingVertex; port: Point; side: PortSide } | null {
    let bestVertex: RoutingVertex | null = null;
    let bestPort: Point | null = null;
    let bestSide: PortSide | null = null;
    let minCost = Infinity;

    const obstaclesWithoutSelf = allObstacles.filter(obs => 
        obs.x !== node.bbox.x || obs.y !== node.bbox.y || obs.w !== node.bbox.w || obs.h !== node.bbox.h
    );

    for (const portInfo of node.ports || []) {
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

    if (!bestVertex || !bestPort || !bestSide) return null;
    return { vertex: bestVertex, port: bestPort, side: bestSide };
}

/**
 * [개선] 더 단순하고 안정적인 경로 조립 로직
 */
function stitchPath(
  startPort: Point,
  endPort: Point,
  vertexPath: RoutingVertex[],
): Point[] {
  const waypoints: Point[] = [startPort, ...vertexPath, endPort];
  if (waypoints.length < 2) return waypoints;
  
  const path: Point[] = [waypoints[0]];
  
  for(let i=1; i < waypoints.length; i++) {
    const prev = path[path.length - 1];
    const curr = waypoints[i];
    
    // 이전 점과 현재 점이 수평/수직이 아니면 꺾임점 추가
    if(Math.abs(prev.x - curr.x) > 1 && Math.abs(prev.y - curr.y) > 1) {
      // 이전 두 점의 방향을 보고 꺾임점 위치 결정
      const prevPrev = path.length > 1 ? path[path.length - 2] : prev;
      if (Math.abs(prevPrev.y - prev.y) < 1) { // 이전에 수평으로 움직였으면
        path.push({ x: curr.x, y: prev.y });
      } else { // 이전에 수직으로 움직였으면
        path.push({ x: prev.x, y: curr.y });
      }
    }
    path.push(curr);
  }

  return cleanupCollinearPoints(path);
}

export function routeOnVisibilityGraph(g: Graph, visibilityGraph: VisibilityGraph, cfg: any): Graph {
  const out = { ...g, edges: new Map(g.edges) };
  const allObstacles = [...Array.from(out.nodes.values()).map(n => n.bbox), ...Array.from(out.groups.values()).map(g => g.bbox)];

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

    const startInfo = findRampInfo(sourceNode, visibilityGraph, allObstacles);
    const endInfo = findRampInfo(targetNode, visibilityGraph, allObstacles);

    if (startInfo && endInfo) {
      const vertexIdPath = findPathOnGraph(startInfo.vertex.id, endInfo.vertex.id, visibilityGraph, cfg.bus.congestionPenalty);
      
      if (vertexIdPath) {
        for (let i = 0; i < vertexIdPath.length - 1; i++) {
          const edgeKey = [vertexIdPath[i], vertexIdPath[i + 1]].sort().join('-');
          const currentUsage = visibilityGraph.edgeUsage.get(edgeKey) || 0;
          visibilityGraph.edgeUsage.set(edgeKey, currentUsage + 1);
        }

        const vertexPath = vertexIdPath.map(id => visibilityGraph.vertices[id]);
        
        const finalPath = stitchPath(startInfo.port, endInfo.port, vertexPath);
        out.edges.set(edge.id, { ...edge, path: finalPath });
        continue;
      }
    }
    
    const sPos = startInfo?.port || portPosition(sourceNode, "right", 0.5);
    const tPos = endInfo?.port || portPosition(targetNode, "left", 0.5);
    out.edges.set(edge.id, { ...edge, path: [sPos, {x: tPos.x, y: sPos.y}, tPos] });
  }
  
  return out;
}