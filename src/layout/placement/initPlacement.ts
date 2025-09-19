import { cloneGraph } from '@domain/graph';
import type { Graph, Rect } from '@domain/types';
import { snap } from '@utils/math';

// 주어진 사각형의 좌표와 크기를 그리드에 맞춥니다.
function snapRectToGrid(rect: Rect, gridSize: number): Rect {
  return {
    x: snap(rect.x, gridSize),
    y: snap(rect.y, gridSize),
    // 너비와 높이도 그리드 단위의 배수가 되도록 올림 처리합니다.
    w: Math.ceil(rect.w / gridSize) * gridSize,
    h: Math.ceil(rect.h / gridSize) * gridSize,
  };
}

/**
 * 모든 노드와 그룹의 위치/크기를 그리드에 맞게 스냅합니다.
 * 레이아웃 알고리즘의 가장 첫 단계입니다.
 */
export function initialPlacement(g: Graph, cfg: any): Graph {
  const graph = cloneGraph(g); // 원본을 수정하지 않기 위해 복제

  // 모든 노드를 순회하며 그리드에 맞춥니다.
  for (const [nodeId, node] of graph.nodes.entries()) {
    graph.nodes.set(nodeId, {
      ...node,
      bbox: snapRectToGrid(node.bbox, cfg.gridSize),
    });
  }

  // 모든 그룹을 순회하며 그리드에 맞춥니다.
  for (const [groupId, group] of graph.groups.entries()) {
    graph.groups.set(groupId, {
      ...group,
      bbox: snapRectToGrid(group.bbox, cfg.gridSize),
    });
  }

  return graph;
}

// import type { Graph, Group, Node, Rect } from "@domain/types";
// import { cloneGraph } from "@domain/graph";
// import { snap } from "@utils/math";

// /**
//  * 초기 배치 전략:
//  * - 각 그룹 내부를 간단한 타일 그리드(행/열)로 채운다.
//  * - 모든 좌표는 gridSize 정수배로 스냅.
//  * - 노드의 기존 크기(bbox.w/h)는 유지하고, 위치만 재배치.
//  */
// export function initialPlacement(g: Graph, cfg: any): Graph {
//   const grid = cfg.gridSize as number;
//   const inset = (cfg.layout?.groupInset ?? 2) * grid;
//   const gapX = (cfg.layout?.nodeGapX ?? 2) * grid;
//   const gapY = (cfg.layout?.nodeGapY ?? 2) * grid;

//   const out = cloneGraph(g);

//   // 그룹별 자식 노드를 타일링
//   for (const [, group] of out.groups) {
//     const children: Node[] = group.children
//       .map((id) => out.nodes.get(id)!)
//       .filter(Boolean);

//     if (children.length === 0) continue;

//     // 노드 크기는 대체로 동일(시나리오 생성기 기준)
//     // 혹시 달라도 가장 큰 크기를 기준 cell로 사용
//     const maxW = Math.max(...children.map((n) => n.bbox.w));
//     const maxH = Math.max(...children.map((n) => n.bbox.h));

//     // 그룹 내부 배치 가능한 영역
//     const gx = group.bbox.x + inset;
//     const gy = group.bbox.y + inset;
//     const gw = group.bbox.w - inset * 2;
//     const gh = group.bbox.h - inset * 2;

//     // 한 칸(cell) 크기 = 노드 크기 + 간격
//     const cellW = maxW + gapX;
//     const cellH = maxH + gapY;

//     // 열 수/행 수 계산 (최소 1 보장)
//     const cols = Math.max(1, Math.floor(gw / cellW));
//     const rows = Math.max(1, Math.ceil(children.length / cols));

//     // 실제 시작점(수평 중앙정렬 느낌으로 약간 보정)
//     const usedW = cols * cellW - gapX;
//     const usedH = rows * cellH - gapY;
//     const startX = snap(gx + Math.max(0, (gw - usedW) / 2), grid);
//     const startY = snap(gy + Math.max(0, (gh - usedH) / 2), grid);

//     // 타일링 배치
//     children.forEach((n, idx) => {
//       const c = idx % cols;
//       const r = Math.floor(idx / cols);

//       // 노드를 셀 중앙 정렬
//       const x = startX + c * cellW + Math.max(0, (cellW - n.bbox.w - gapX) / 2);
//       const y = startY + r * cellH + Math.max(0, (cellH - n.bbox.h - gapY) / 2);

//       const placed: Rect = {
//         x: snap(x, grid),
//         y: snap(y, grid),
//         w: n.bbox.w,
//         h: n.bbox.h,
//       };

//       out.nodes.set(n.id, { ...n, bbox: placed, groupId: group.id });
//     });
//   }

//   return out;
// }
