import type { Graph, Point, VisibilityGraph } from "@domain/types"; // VisibilityGraph 임포트
import { cleanupCollinearPoints } from "@layout/routing/aStarStrategy/pathSmoother";

/**
 * [최종 개선] 라우팅이 완료된 경로들을 순회하며, 겹치는 경로 세그먼트에 '차선'을 할당하여 시각적으로 분리합니다.
 */
export function separatedPaths(
  g: Graph,
  visibilityGraph: VisibilityGraph | null,
  cfg: any
): Graph {
  if (!visibilityGraph) {
    console.warn("Visibility graph not available for beautifying paths.");
    return g;
  }

  const out = { ...g, edges: new Map(g.edges) };
  const laneWidth = cfg.bus?.laneWidth ?? 8;

  // 가시성 그래프의 모든 간선에 대해 차선 정보를 계산합니다.
  for (const [edgeKey, usage] of visibilityGraph.edgeUsage.entries()) {
    if (usage < 2) continue; // 엣지가 2개 이상 지나간 간선만 처리

    const [v1Id, v2Id] = edgeKey.split("-").map(Number);
    const v1 = visibilityGraph.vertices[v1Id];
    const v2 = visibilityGraph.vertices[v2Id];

    if (!v1 || !v2) continue; // 안전장치

    const isHorizontal = Math.abs(v1.y - v2.y) < 1;

    const totalWidth = (usage - 1) * laneWidth;
    const startOffset = -totalWidth / 2;

    let laneCounter = 0;
    // 이 간선을 사용한 모든 엣지를 찾아서 경로를 수정합니다.
    for (const edge of out.edges.values()) {
      if (!edge.path) continue;

      // 엣지의 경로에서 이 간선(v1-v2) 부분을 찾습니다.
      for (let i = 0; i < edge.path.length - 1; i++) {
        const p1 = edge.path[i];
        const p2 = edge.path[i + 1];

        // 정점 v1, v2와 거의 일치하는 경로 세그먼트를 찾습니다.
        const isMatch =
          (Math.abs(p1.x - v1.x) < 1 &&
            Math.abs(p1.y - v1.y) < 1 &&
            Math.abs(p2.x - v2.x) < 1 &&
            Math.abs(p2.y - v2.y) < 1) ||
          (Math.abs(p1.x - v2.x) < 1 &&
            Math.abs(p1.y - v2.y) < 1 &&
            Math.abs(p2.x - v1.x) < 1 &&
            Math.abs(p2.y - v1.y) < 1);

        if (isMatch) {
          const offset = startOffset + laneCounter * laneWidth;
          if (offset === 0) {
            // 중앙 차선은 수정할 필요 없음
            laneCounter++;
            continue;
          }

          const newPath = [...edge.path];

          if (isHorizontal) {
            newPath[i] = { ...p1, y: p1.y + offset };
            newPath[i + 1] = { ...p2, y: p2.y + offset };
          } else {
            // Vertical
            newPath[i] = { ...p1, x: p1.x + offset };
            newPath[i + 1] = { ...p2, x: p2.x + offset };
          }

          // 꺾이는 부분도 자연스럽게 연결되도록 앞/뒤 포인트를 조정합니다.
          if (i > 0) {
            const prevPoint = newPath[i - 1];
            if (isHorizontal)
              newPath[i - 1] = { ...prevPoint, y: newPath[i].y };
            else newPath[i - 1] = { ...prevPoint, x: newPath[i].x };
          }
          if (i < newPath.length - 2) {
            const nextPoint = newPath[i + 2];
            if (isHorizontal)
              newPath[i + 2] = { ...nextPoint, y: newPath[i + 1].y };
            else newPath[i + 2] = { ...nextPoint, x: newPath[i + 1].x };
          }

          out.edges.set(edge.id, {
            ...edge,
            path: cleanupCollinearPoints(newPath),
          });
          laneCounter++;
          break; // 한 엣지당 한 번만 수정
        }
      }
    }
  }

  return out;
}
