import type { Graph, Node, Rect, Group } from "@domain/types";
import { cloneGraph } from "@domain/graph";
import { snap, snapUp } from "@utils/math";

export function resolveOverlap(g: Graph, cfg: any): Graph {
  const grid = cfg.gridSize as number;
  const inset = (cfg.layout?.groupInset ?? 2) * grid;

  const out = cloneGraph(g);
  // Map을 새로 만들어 내부 객체들이 확실히 참조되도록 보장합니다.
  out.nodes = new Map(out.nodes);
  out.groups = new Map(out.groups);

  const maxIterations = 5; // 전체 과정을 여러 번 반복하여 안정화시킵니다.
  for (let i = 0; i < maxIterations; i++) {
    // 1단계: 그룹과 루트 노드(상위 레벨)들의 겹침을 해결합니다.
    const topLevelItems: (Group | Node)[] = [
      ...Array.from(out.groups.values()),
      ...Array.from(out.nodes.values()).filter((n) => !n.groupId),
    ];
    const deltas = sweepAndPush(topLevelItems, cfg);

    // 2단계: 그룹이 이동한 만큼 자식 노드들도 똑같이 이동시킵니다.
    deltas.forEach((delta, id) => {
      const group = out.groups.get(id as any);
      if (group) {
        group.bbox.x += delta.dx;
        group.bbox.y += delta.dy;
        group.children.forEach((childId) => {
          const childNode = out.nodes.get(childId);
          if (childNode) {
            childNode.bbox.x += delta.dx;
            childNode.bbox.y += delta.dy;
          }
        });
      }
    });

    // 3단계: 각 그룹 내부의 자식 노드들끼리 겹침을 해결합니다.
    for (const group of out.groups.values()) {
      const children = group.children
        .map((id) => out.nodes.get(id)!)
        .filter(Boolean);
      if (children.length > 1) {
        sweepAndPush(children, cfg);
      }
    }

    // 4단계: 모든 이동이 끝난 후, 그룹 경계 상자를 자식에 맞게 다시 조절합니다.
    updateAllGroupBBoxes(out, grid, inset);
  }

  return out;
}

/**
 * 주어진 아이템(노드 또는 그룹) 리스트의 겹침을 해결하고, 각 아이템의 이동량을 반환합니다.
 * 이 함수는 전달된 아이템의 bbox 속성을 직접 수정합니다.
 */
function sweepAndPush(
  items: (Node | Group)[],
  cfg: any
): Map<string, { dx: number; dy: number }> {
  const gap = (cfg.layout?.nodeGapX ?? 2) * cfg.gridSize;
  const initialPositions = new Map(
    items.map((it) => [it.id, { x: it.bbox.x, y: it.bbox.y }])
  );

  // 안정성을 위해 스윕-푸시를 2번 실행합니다.
  for (let iter = 0; iter < 2; iter++) {
    // 세로 스윕
    items.sort(
      (a, b) =>
        a.bbox.y - b.bbox.y || a.bbox.x - b.bbox.x || a.id.localeCompare(b.id)
    );
    for (let i = 0; i < items.length; i++) {
      for (let j = 0; j < i; j++) {
        const upper = items[j];
        const lower = items[i];
        if (
          upper.bbox.x < lower.bbox.x + lower.bbox.w &&
          upper.bbox.x + upper.bbox.w > lower.bbox.x
        ) {
          const requiredY = upper.bbox.y + upper.bbox.h + gap;
          if (lower.bbox.y < requiredY) lower.bbox.y = requiredY;
        }
      }
    }

    // 가로 스윕
    items.sort(
      (a, b) =>
        a.bbox.x - b.bbox.x || a.bbox.y - b.bbox.y || a.id.localeCompare(b.id)
    );
    for (let i = 0; i < items.length; i++) {
      for (let j = 0; j < i; j++) {
        const left = items[j];
        const right = items[i];
        if (
          left.bbox.y < right.bbox.y + right.bbox.h &&
          left.bbox.y + left.bbox.h > right.bbox.y
        ) {
          const requiredX = left.bbox.x + left.bbox.w + gap;
          if (right.bbox.x < requiredX) right.bbox.x = requiredX;
        }
      }
    }
  }

  // 각 아이템이 얼마나 움직였는지 변위(delta)를 계산하여 반환합니다.
  const deltas = new Map<string, { dx: number; dy: number }>();
  for (const item of items) {
    const initial = initialPositions.get(item.id)!;
    deltas.set(item.id, {
      dx: item.bbox.x - initial.x,
      dy: item.bbox.y - initial.y,
    });
  }
  return deltas;
}

function updateAllGroupBBoxes(out: Graph, grid: number, inset: number) {
  for (const group of out.groups.values()) {
    if (!group.children?.length) continue;
    const nodes = group.children
      .map((id) => out.nodes.get(id)!)
      .filter(Boolean);
    if (nodes.length === 0) continue;

    const minX = Math.min(...nodes.map((n) => n.bbox.x));
    const minY = Math.min(...nodes.map((n) => n.bbox.y));
    const maxX = Math.max(...nodes.map((n) => n.bbox.x + n.bbox.w));
    const maxY = Math.max(...nodes.map((n) => n.bbox.y + n.bbox.h));

    const finalX1 = snap(minX - inset, grid);
    const finalY1 = snap(minY - inset, grid);
    const finalX2 = snapUp(maxX + inset, grid);
    const finalY2 = snapUp(maxY + inset, grid);

    group.bbox = {
      x: finalX1,
      y: finalY1,
      w: finalX2 - finalX1,
      h: finalY2 - finalY1,
    };
  }
}
