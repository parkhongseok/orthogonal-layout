import type { Graph, NodeId, PortSide, Point } from "@domain/types";
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

  for (const [nodeId, sides] of sideUsage.entries()) {
    const node = out.nodes.get(nodeId)!;
    for (const [side, edges] of sides.entries()) {
      const k = edges.length;
      if (k === 0) continue;

      edges.sort((a, b) => {
        const aEdge = out.edges.get(a.edgeId as any)!;
        const bEdge = out.edges.get(b.edgeId as any)!;
        const aOtherNodeId =
          a.type === "source" ? aEdge.targetId : aEdge.sourceId;
        const bOtherNodeId =
          b.type === "source" ? bEdge.targetId : bEdge.sourceId;
        const aOtherNode = out.nodes.get(aOtherNodeId)!;
        const bOtherNode = out.nodes.get(bOtherNodeId)!;
        const aCenter = {
          x: aOtherNode.bbox.x + aOtherNode.bbox.w / 2,
          y: aOtherNode.bbox.y + aOtherNode.bbox.h / 2,
        };
        const bCenter = {
          x: bOtherNode.bbox.x + bOtherNode.bbox.w / 2,
          y: bOtherNode.bbox.y + bOtherNode.bbox.h / 2,
        };
        if (side === "top" || side === "bottom") {
          return aCenter.x - bCenter.x;
        }
        return aCenter.y - bCenter.y;
      });

      // [핵심 수정] 포트 간격을 노드 너비가 아닌, 차선(Lane) 시스템과 동일한 규칙으로 재계산합니다.
      const laneSpacing = cfg.bus?.laneWidth ?? cfg.gridSize / 2;
      const totalPortsWidth = (edges.length - 1) * laneSpacing;
      let startOffset: number;

      if (side === "top" || side === "bottom") {
        const sideCenter = node.bbox.x + node.bbox.w / 2;
        startOffset = sideCenter - totalPortsWidth / 2;
      } else {
        // left or right
        const sideCenter = node.bbox.y + node.bbox.h / 2;
        startOffset = sideCenter - totalPortsWidth / 2;
      }

      edges.forEach(({ edgeId, type }, i) => {
        const edge = out.edges.get(edgeId as any)!;

        let newPortPos: Point;
        if (side === "top" || side === "bottom") {
          const portX = startOffset + i * laneSpacing;
          newPortPos = {
            x: portX,
            y: node.bbox.y + (side === "bottom" ? node.bbox.h : 0),
          };
        } else {
          // left or right
          const portY = startOffset + i * laneSpacing;
          newPortPos = {
            x: node.bbox.x + (side === "right" ? node.bbox.w : 0),
            y: portY,
          };
        }

        const newPath = [...edge.path!];

        // 새 포트 위치에 맞게 경로를 재구성하는 로직 (기존과 유사)
        if (type === "source") {
          const p1 = newPath[1];
          newPath.shift();
          if (side === "top" || side === "bottom") {
            if (Math.abs(newPortPos.x - p1.x) > 0.1)
              newPath.unshift({ x: newPortPos.x, y: p1.y });
          } else {
            if (Math.abs(newPortPos.y - p1.y) > 0.1)
              newPath.unshift({ x: p1.x, y: newPortPos.y });
          }
          newPath.unshift(newPortPos);
        } else {
          const pN_1 = newPath[newPath.length - 2];
          newPath.pop();
          if (side === "top" || side === "bottom") {
            if (Math.abs(pN_1.x - newPortPos.x) > 0.1)
              newPath.push({ x: newPortPos.x, y: pN_1.y });
          } else {
            if (Math.abs(pN_1.y - newPortPos.y) > 0.1)
              newPath.push({ x: pN_1.x, y: newPortPos.y });
          }
          newPath.push(newPortPos);
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
