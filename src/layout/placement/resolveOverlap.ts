import { cloneGraph } from "@domain/graph";
import type { Graph, Node } from "@domain/types";

/**
 * 간단한 'Sweep and Push' 알고리즘으로 노드 겹침을 해결합니다.
 * 먼저 세로로 정렬하여 아래로 밀고, 다음 가로로 정렬하여 옆으로 밀어내는 과정을 반복합니다.
 */
export function resolveOverlap(g: Graph, cfg: any): Graph {
  const graph = cloneGraph(g);
  const nodes = Array.from(graph.nodes.values());
  const minGap = cfg.gridSize;

  const maxIterations = 10;

  for (let iter = 0; iter < maxIterations; iter++) {
    // --- 1. 세로 방향 스윕 (위에서 아래로) ---
    // [수정] y좌표가 같으면 x좌표로, 그것도 같으면 id로 정렬하여 항상 같은 순서를 보장합니다.
    nodes.sort(
      (a, b) =>
        a.bbox.y - b.bbox.y || a.bbox.x - b.bbox.x || a.id.localeCompare(b.id)
    );

    for (let i = 0; i < nodes.length; i++) {
      for (let j = 0; j < i; j++) {
        const upperNode = nodes[j];
        const lowerNode = nodes[i];

        // if (upperNode.groupId !== lowerNode.groupId) continue;

        const isHorizontallyOverlapping =
          upperNode.bbox.x < lowerNode.bbox.x + lowerNode.bbox.w &&
          upperNode.bbox.x + upperNode.bbox.w > lowerNode.bbox.x;

        if (isHorizontallyOverlapping) {
          const requiredY = upperNode.bbox.y + upperNode.bbox.h + minGap;
          if (lowerNode.bbox.y < requiredY) {
            lowerNode.bbox.y = requiredY;
          }
        }
      }
    }

    // --- 2. 가로 방향 스윕 (왼쪽에서 오른쪽으로) ---
    // [수정] x좌표가 같으면 y좌표로, 그것도 같으면 id로 정렬하여 항상 같은 순서를 보장합니다.
    nodes.sort(
      (a, b) =>
        a.bbox.x - b.bbox.x || a.bbox.y - b.bbox.y || a.id.localeCompare(b.id)
    );

    for (let i = 0; i < nodes.length; i++) {
      for (let j = 0; j < i; j++) {
        const leftNode = nodes[j];
        const rightNode = nodes[i];

        // if (leftNode.groupId !== rightNode.groupId) continue;

        const isVerticallyOverlapping =
          leftNode.bbox.y < rightNode.bbox.y + rightNode.bbox.h &&
          leftNode.bbox.y + leftNode.bbox.h > rightNode.bbox.y;

        if (isVerticallyOverlapping) {
          const requiredX = leftNode.bbox.x + leftNode.bbox.w + minGap;
          if (rightNode.bbox.x < requiredX) {
            rightNode.bbox.x = requiredX;
          }
        }
      }
    }
  }

  for (const node of nodes) {
    graph.nodes.set(node.id, node);
  }

  return graph;
}
// // import type { Graph, Node, Rect } from "@domain/types";
// // import { cloneGraph } from "@domain/graph";
// // import { intersects, snap } from "@utils/math";

// // /**
// //  * 간단 겹침 제거:
// //  * - 같은 그룹 내에서만 처리.
// //  * - 1) X축 정렬 후 오른쪽으로 밀어내기
// //  * - 2) Y축 정렬 후 아래로 밀어내기
// //  * - 그룹 경계 밖으로 나가려 하면 경계 안쪽으로 스냅.
// //  */
// // export function resolveOverlap(g: Graph, cfg: any): Graph {
// //   const grid = cfg.gridSize as number;
// //   const inset = (cfg.layout?.groupInset ?? 2) * grid;
// //   const gapX = (cfg.layout?.nodeGapX ?? 2) * grid;
// //   const gapY = (cfg.layout?.nodeGapY ?? 2) * grid;

// //   const out = cloneGraph(g);

// //   for (const [, group] of out.groups) {
// //     const nodes: Node[] = group.children
// //       .map((id) => out.nodes.get(id)!)
// //       .filter(Boolean);
// //     if (nodes.length <= 1) continue;

// //     // 1) 수평 정렬 + 오른쪽 밀어내기
// //     nodes.sort((a, b) => a.bbox.x - b.bbox.x || a.bbox.y - b.bbox.y);
// //     for (let i = 1; i < nodes.length; i++) {
// //       const prev = out.nodes.get(nodes[i - 1].id)!;
// //       const cur = out.nodes.get(nodes[i].id)!;
// //       let r = { ...cur.bbox };
// //       if (intersects(prev.bbox, cur.bbox)) {
// //         r.x = snap(prev.bbox.x + prev.bbox.w + gapX, grid);
// //         out.nodes.set(cur.id, { ...cur, bbox: r });
// //       }
// //     }

// //     // 2) 수직 정렬 + 아래로 밀어내기
// //     const nodes2: Node[] = group.children
// //       .map((id) => out.nodes.get(id)!)
// //       .filter(Boolean);
// //     nodes2.sort((a, b) => a.bbox.y - b.bbox.y || a.bbox.x - b.bbox.x);
// //     for (let i = 1; i < nodes2.length; i++) {
// //       const prev = out.nodes.get(nodes2[i - 1].id)!;
// //       const cur = out.nodes.get(nodes2[i].id)!;
// //       let r = { ...cur.bbox };
// //       if (intersects(prev.bbox, cur.bbox)) {
// //         r.y = snap(prev.bbox.y + prev.bbox.h + gapY, grid);
// //         out.nodes.set(cur.id, { ...cur, bbox: r });
// //       }
// //     }

// //     // 3) 그룹 경계 안쪽으로 클램프
// //     clampToGroup(out, group.id, cfg);
// //   }

// //   return out;
// // }

// // function clampToGroup(out: Graph, groupId: any, cfg: any) {
// //   const grid = cfg.gridSize as number;
// //   const inset = (cfg.layout?.groupInset ?? 2) * grid;
// //   const gapX = (cfg.layout?.nodeGapX ?? 2) * grid;
// //   const gapY = (cfg.layout?.nodeGapY ?? 2) * grid;

// //   const g = out.groups.get(groupId)!;
// //   const gx = g.bbox.x + inset;
// //   const gy = g.bbox.y + inset;
// //   const gx2 = g.bbox.x + g.bbox.w - inset;
// //   const gy2 = g.bbox.y + g.bbox.h - inset;

// //   for (const id of g.children) {
// //     const n = out.nodes.get(id)!;
// //     let x = n.bbox.x,
// //       y = n.bbox.y;

// //     // 좌상단 최소 위치
// //     x = Math.max(x, gx);
// //     y = Math.max(y, gy);
// //     // 우하단 경계 내부(노드 전체가 들어오도록)
// //     x = Math.min(x, gx2 - n.bbox.w);
// //     y = Math.min(y, gy2 - n.bbox.h);

// //     out.nodes.set(id, {
// //       ...n,
// //       bbox: { ...n.bbox, x: snap(x, grid), y: snap(y, grid) },
// //     });
// //   }
// // }
