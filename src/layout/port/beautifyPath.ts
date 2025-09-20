// src/layout/beautifyPath.ts

import type { Graph, NodeId, PortSide, Point } from "@domain/types";
import { portPosition } from "./assign";
import { cleanupCollinearPoints } from "@layout/routing/pathSmoother";

export function beautifyPath(g: Graph, cfg: any): Graph {
  const out = { ...g, edges: new Map(g.edges) };

  // 1. 각 노드의 면(side) 별로 연결된 엣지를 수집합니다.
  const sideUsage = new Map<
    NodeId,
    Map<PortSide, { edgeId: string; type: "source" | "target" }[]>
  >();

  for (const edge of out.edges.values()) {
    if (!edge.path || edge.path.length === 0) continue;

    const sourceNode = out.nodes.get(edge.sourceId)!;
    const targetNode = out.nodes.get(edge.targetId)!;
    const sourcePort = edge.path[0];
    const targetPort = edge.path[edge.path.length - 1];

    // 포트가 어느 면에 가장 가까운지 판단
    const sourceSide = getClosestSide(sourceNode.bbox, sourcePort);
    const targetSide = getClosestSide(targetNode.bbox, targetPort);

    // 소스 노드의 면 사용 정보 기록
    if (!sideUsage.has(sourceNode.id)) sideUsage.set(sourceNode.id, new Map());
    const sSides = sideUsage.get(sourceNode.id)!;
    if (!sSides.has(sourceSide)) sSides.set(sourceSide, []);
    sSides.get(sourceSide)!.push({ edgeId: edge.id, type: "source" });

    // 타겟 노드의 면 사용 정보 기록
    if (!sideUsage.has(targetNode.id)) sideUsage.set(targetNode.id, new Map());
    const tSides = sideUsage.get(targetNode.id)!;
    if (!tSides.has(targetSide)) tSides.set(targetSide, []);
    tSides.get(targetSide)!.push({ edgeId: edge.id, type: "target" });
  }

  // 2. 수집된 정보를 바탕으로 포트 위치를 재분배하고 경로를 수정합니다.
  for (const [nodeId, sides] of sideUsage.entries()) {
    const node = out.nodes.get(nodeId)!;
    for (const [side, edges] of sides.entries()) {
      const k = edges.length;
      if (k === 0) continue;

      // 엣지들을 포트의 위치에 따라 정렬 (좌->우, 상->하)
      edges.sort((a, b) => {
        const aEdge = out.edges.get(a.edgeId as any)!;
        const bEdge = out.edges.get(b.edgeId as any)!;
        const aPoint =
          a.type === "source"
            ? aEdge.path![0]
            : aEdge.path![aEdge.path!.length - 1];
        const bPoint =
          b.type === "source"
            ? bEdge.path![0]
            : bEdge.path![bEdge.path!.length - 1];
        if (side === "top" || side === "bottom") return aPoint.x - bPoint.x;
        return aPoint.y - bPoint.y;
      });

      edges.forEach(({ edgeId, type }, i) => {
        const offset = (i + 1) / (k + 1);
        const newPortPos = portPosition(node, side, offset);
        const edge = out.edges.get(edgeId as any)!;
        const newPath = [...edge.path!];

        if (type === "source") {
          newPath[0] = newPortPos;
          if (newPath.length > 1) {
            if (side === "top" || side === "bottom")
              newPath[1].x = newPortPos.x;
            else newPath[1].y = newPortPos.y;
          }
        } else {
          const last = newPath.length - 1;
          newPath[last] = newPortPos;
          if (newPath.length > 1) {
            if (side === "top" || side === "bottom")
              newPath[last - 1].x = newPortPos.x;
            else newPath[last - 1].y = newPortPos.y;
          }
        }
        out.edges.set(edge.id, {
          ...edge,
          path: cleanupCollinearPoints(newPath),
        });
      });
    }
  }

  return out;
}

// 헬퍼 함수들
function getClosestSide(
  bbox: { x: number; y: number; w: number; h: number },
  point: Point
): PortSide {
  const distTop = Math.abs(point.y - bbox.y);
  const distBottom = Math.abs(point.y - (bbox.y + bbox.h));
  const distLeft = Math.abs(point.x - bbox.x);
  const distRight = Math.abs(point.x - (bbox.x + bbox.w));
  const minDist = Math.min(distTop, distBottom, distLeft, distRight);

  if (minDist === distTop) return "top";
  if (minDist === distBottom) return "bottom";
  if (minDist === distLeft) return "left";
  return "right";
}

