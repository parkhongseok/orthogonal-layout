import { cloneGraph } from "@domain/graph";
import type { Graph, Node } from "@domain/types";
import { snap } from "@utils/math";

/**
 * 노드 위치가 변경된 후, 각 그룹의 경계 상자(bbox)를 자식 노드들을 모두 포함하도록 업데이트합니다.
 */
export function updateGroupBounds(g: Graph, cfg: any): Graph {
  const graph = cloneGraph(g);
  const padding = cfg.gridSize * 2; // 그룹 경계와 내부 노드 사이의 여백

  for (const [groupId, group] of graph.groups.entries()) {
    const children = group.children
      .map((childId) => graph.nodes.get(childId))
      .filter((n): n is Node => n !== undefined);

    if (children.length === 0) continue;

    // 모든 자식 노드를 감싸는 최소/최대 좌표를 찾습니다.
    let minX = Infinity,
      minY = Infinity;
    let maxX = -Infinity,
      maxY = -Infinity;

    for (const child of children) {
      minX = Math.min(minX, child.bbox.x);
      minY = Math.min(minY, child.bbox.y);
      maxX = Math.max(maxX, child.bbox.x + child.bbox.w);
      maxY = Math.max(maxY, child.bbox.y + child.bbox.h);
    }

    // 새 경계 상자의 각 모서리 위치를 먼저 계산합니다.
    const targetX1 = minX - padding;
    const targetY1 = minY - padding;
    const targetX2 = maxX + padding;
    const targetY2 = maxY + padding;

    // 모서리 위치를 그리드에 맞춥니다.
    const finalX1 = snap(targetX1, cfg.gridSize);
    const finalY1 = snap(targetY1, cfg.gridSize);
    const finalX2 = snap(targetX2, cfg.gridSize);
    const finalY2 = snap(targetY2, cfg.gridSize);

    // 그리드에 맞춰진 모서리 위치를 기반으로 최종 너비와 높이를 계산합니다.
    const newBbox = {
      x: finalX1,
      y: finalY1,
      w: finalX2 - finalX1,
      h: finalY2 - finalY1,
    };
    graph.groups.set(groupId, { ...group, bbox: newBbox });
  }

  return graph;
}
