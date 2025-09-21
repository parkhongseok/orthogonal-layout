// src/layout/port/beautifyPath.ts

import type { Graph, NodeId, PortSide, Point } from "@domain/types";
import { portPosition } from "./assign";
import { cleanupCollinearPoints } from "@layout/routing/aStarStrategy/pathSmoother";

/**
 * [개선] 라우팅이 완료된 경로를 순회하며, 겹치거나 꼬인 포트 연결을 최적화하여 시각적 품질을 높입니다.
 * 1. 한 면에 연결된 엣지들을 꼬이지 않는 순서로 재정렬합니다.
 * 2. 재정렬된 순서에 따라 포트 위치를 균등하게 재분배합니다.
 * 3. 경로의 시작/끝 부분을 새로운 포트 위치에 맞게 직선으로 수정합니다.
 * @param g 라우팅이 완료된 그래프
 * @param cfg 설정 객체
 * @returns 경로가 최종적으로 다듬어진 그래프
 */
export function beautifyPath(g: Graph, cfg: any): Graph {
  const out = { ...g, edges: new Map(g.edges) };

  // 1. 각 노드의 면(side) 별로 연결된 엣지를 수집합니다. (이전과 동일)
  const sideUsage = new Map<
    NodeId,
    Map<PortSide, { edgeId: string; type: "source" | "target" }[]>
  >();

  for (const edge of out.edges.values()) {
    if (!edge.path || edge.path.length < 2) continue;
    const sourceNode = out.nodes.get(edge.sourceId)!;
    const targetNode = out.nodes.get(edge.targetId)!;
    const sourcePort = edge.path[0];
    const targetPort = edge.path[edge.path.length - 1];
    const sourceSide = getClosestSide(sourceNode.bbox, sourcePort);
    const targetSide = getClosestSide(targetNode.bbox, targetPort);

    if (!sideUsage.has(sourceNode.id)) sideUsage.set(sourceNode.id, new Map());
    const sSides = sideUsage.get(sourceNode.id)!;
    if (!sSides.has(sourceSide)) sSides.set(sourceSide, []);
    sSides.get(sourceSide)!.push({ edgeId: edge.id, type: "source" });

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

      // 엣지들을 '꼬이지 않는' 순서로 정렬합니다. (이전과 동일)
      edges.sort((a, b) => {
        const aEdge = out.edges.get(a.edgeId as any)!;
        const bEdge = out.edges.get(b.edgeId as any)!;
        const aPoint =
          a.type === "source"
            ? aEdge.path![1]
            : aEdge.path![aEdge.path!.length - 2];
        const bPoint =
          b.type === "source"
            ? bEdge.path![1]
            : bEdge.path![bEdge.path!.length - 2];
        if (side === "top" || side === "bottom") return aPoint.x - bPoint.x;
        return aPoint.y - bPoint.y;
      });

      edges.forEach(({ edgeId, type }, i) => {
        const offset = (i + 1) / (k + 1);
        const newPortPos = portPosition(node, side, offset);
        const edge = out.edges.get(edgeId as any)!;
        const newPath = [...edge.path!];

        // [핵심 수정] 더 안정적인 방식으로 경로 끝단을 재구성합니다.
        if (type === "source") {
          const p1 = newPath[1]; // 경로의 두 번째 점
          newPath.shift(); // 기존 시작점(오래된 포트) 제거

          // 새 포트 위치와 p1 사이에 필요한 중간점을 계산하여 경로 맨 앞에 추가
          if (side === "top" || side === "bottom") {
            if (Math.abs(newPortPos.x - p1.x) > 0.1) {
              newPath.unshift({ x: newPortPos.x, y: p1.y });
            }
          } else {
            // left or right
            if (Math.abs(newPortPos.y - p1.y) > 0.1) {
              newPath.unshift({ x: p1.x, y: newPortPos.y });
            }
          }
          newPath.unshift(newPortPos); // 새로운 시작점(포트)을 맨 앞에 추가
        } else {
          // type === 'target'
          const pN_1 = newPath[newPath.length - 2]; // 경로의 끝에서 두 번째 점
          newPath.pop(); // 기존 끝점(오래된 포트) 제거

          // pN_1과 새 포트 위치 사이에 필요한 중간점을 계산하여 경로 맨 뒤에 추가
          if (side === "top" || side === "bottom") {
            if (Math.abs(pN_1.x - newPortPos.x) > 0.1) {
              newPath.push({ x: newPortPos.x, y: pN_1.y });
            }
          } else {
            // left or right
            if (Math.abs(pN_1.y - newPortPos.y) > 0.1) {
              newPath.push({ x: pN_1.x, y: newPortPos.y });
            }
          }
          newPath.push(newPortPos); // 새로운 끝점(포트)을 맨 뒤에 추가
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
