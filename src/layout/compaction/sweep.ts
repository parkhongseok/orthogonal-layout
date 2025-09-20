import type { Graph, Node, Group } from "@domain/types";
import { snap } from "@utils/math";

export function sweepCompact(g: Graph, cfg: any): Graph {
  const out = { ...g, nodes: new Map(g.nodes), groups: new Map(g.groups) };
  const gap = (cfg.layout?.nodeGapX ?? 4) * cfg.gridSize; // 최소 간격 유지
  const allItems: (Node | Group)[] = [
    ...Array.from(out.nodes.values()),
    ...Array.from(out.groups.values()),
  ];

  // --- 수직 압축 (Y축) ---
  // Y좌표 기준으로 정렬
  allItems.sort((a, b) => a.bbox.y - b.bbox.y);

  for (let i = 0; i < allItems.length; i++) {
    const item = allItems[i];
    let maxY = 0; // 현재 아이템이 올라갈 수 있는 가장 높은 Y 위치

    // 현재 아이템보다 위에 있는 다른 모든 아이템들을 확인
    for (let j = 0; j < i; j++) {
      const other = allItems[j];
      // X축에서 겹치는 경우에만 고려
      if (
        item.bbox.x < other.bbox.x + other.bbox.w &&
        item.bbox.x + item.bbox.w > other.bbox.x
      ) {
        maxY = Math.max(maxY, other.bbox.y + other.bbox.h + gap);
      }
    }

    const deltaY = item.bbox.y - maxY;
    if (deltaY > 0) {
      // 계산된 위치로 아이템 이동
      item.bbox.y -= deltaY;
      // 그룹일 경우, 자식 노드들도 함께 이동
      if ("children" in item) {
        item.children.forEach((childId) => {
          const child = out.nodes.get(childId);
          if (child) child.bbox.y -= deltaY;
        });
      }
    }
  }

  // --- 수평 압축 (X축) ---
  // X좌표 기준으로 재정렬
  allItems.sort((a, b) => a.bbox.x - b.bbox.x);

  for (let i = 0; i < allItems.length; i++) {
    const item = allItems[i];
    let maxX = 0; // 현재 아이템이 갈 수 있는 가장 왼쪽 X 위치

    for (let j = 0; j < i; j++) {
      const other = allItems[j];
      // Y축에서 겹치는 경우에만 고려
      if (
        item.bbox.y < other.bbox.y + other.bbox.h &&
        item.bbox.y + item.bbox.h > other.bbox.y
      ) {
        maxX = Math.max(maxX, other.bbox.x + other.bbox.w + gap);
      }
    }

    const deltaX = item.bbox.x - maxX;
    if (deltaX > 0) {
      item.bbox.x -= deltaX;
      if ("children" in item) {
        item.children.forEach((childId) => {
          const child = out.nodes.get(childId);
          if (child) child.bbox.x -= deltaX;
        });
      }
    }
  }

  // 격자 스냅으로 마무리
  for (const item of allItems) {
    item.bbox.x = snap(item.bbox.x, cfg.gridSize);
    item.bbox.y = snap(item.bbox.y, cfg.gridSize);
  }

  return out;
}
