import type { Graph, Node, Rect, Group } from "@domain/types";
import { cloneGraph } from "@domain/graph";
import { snap, snapUp } from "@utils/math";

export function resolveOverlap(g: Graph, cfg: any): Graph {
  const grid = cfg.gridSize as number;
  const inset = (cfg.layout?.groupInset ?? 2) * grid;
  const gap = (cfg.layout?.nodeGapX ?? 2) * cfg.gridSize;

  const out = cloneGraph(g);
  // Map을 새로 만들어 내부 객체들이 확실히 참조되도록 보장
  out.nodes = new Map(out.nodes);
  out.groups = new Map(out.groups);

  const maxIterations = 10; // 안정성을 위해 반복 횟수 증가
  for (let i = 0; i < maxIterations; i++) {
    let movedCount = 0;

    // 1단계: 그룹과 루트 노드(상위 레벨)들의 겹침을 해결
    const topLevelItems: (Group | Node)[] = [
      ...Array.from(out.groups.values()),
      ...Array.from(out.nodes.values()).filter((n) => !n.groupId),
    ];
    const deltas = sweepAndPush(topLevelItems, gap);

    // 2단계: 계산된 이동량을 그룹과 그 자식 노드들, 그리고 루트 노드에 적용
    deltas.forEach((delta, item) => {
      if (Math.abs(delta.dx) > 0.1 || Math.abs(delta.dy) > 0.1) {
        movedCount++;
        item.bbox.x += delta.dx;
        item.bbox.y += delta.dy;

        // 아이템이 그룹일 경우, 자식 노드들도 똑같이 이동
        if ("children" in item) {
          item.children.forEach((childId) => {
            const childNode = out.nodes.get(childId);
            if (childNode) {
              childNode.bbox.x += delta.dx;
              childNode.bbox.y += delta.dy;
            }
          });
        }
      }
    });

    // 3단계: 각 그룹 내부의 자식 노드들끼리 겹침을 해결
    for (const group of out.groups.values()) {
      const children = group.children
        .map((id) => out.nodes.get(id)!)
        .filter(Boolean);
      if (children.length > 1) {
        const childDeltas = sweepAndPush(children, gap);
        childDeltas.forEach((delta, item) => {
          if (Math.abs(delta.dx) > 0.1 || Math.abs(delta.dy) > 0.1) {
            movedCount++;
            item.bbox.x += delta.dx;
            item.bbox.y += delta.dy;
          }
        });
      }
    }

    // 4단계: 모든 이동이 끝난 후, 그룹 경계 상자를 자식에 맞게 다시 조절
    updateAllGroupBBoxes(out, grid, inset);

    // 변경 사항이 없으면 루프를 조기 종료하여 최적화
    if (movedCount === 0) {
      break;
    }
  }

  return out;
}

/**
 * 주어진 아이템 리스트의 겹침을 해결하고, 각 아이템의 이동량(delta)을 Map 형태로 반환
 * 이 함수는 전달된 아이템의 bbox를 직접 수정하지 않음
 */
function sweepAndPush(
  items: (Node | Group)[],
  gap: number
): Map<Node | Group, { dx: number; dy: number }> {
  const deltas = new Map(items.map((it) => [it, { dx: 0, dy: 0 }]));

  // 안정성을 위해 스윕-푸시를 여러 번(e.g., 4번) 실행
  for (let iter = 0; iter < 4; iter++) {
    items.sort((a, b) => a.bbox.y - b.bbox.y || a.bbox.x - b.bbox.x);
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        push(items[i], items[j], gap, deltas);
      }
    }

    items.sort((a, b) => a.bbox.x - b.bbox.x || a.bbox.y - b.bbox.y);
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        push(items[i], items[j], gap, deltas);
      }
    }
  }
  return deltas;
}

/** 두 아이템이 겹칠 경우 밀어낼 힘을 계산하여 delta에 누적 */
function push(
  a: Node | Group,
  b: Node | Group,
  gap: number,
  deltas: Map<Node | Group, { dx: number; dy: number }>
) {
  const ad = deltas.get(a)!;
  const bd = deltas.get(b)!;
  const ax1 = a.bbox.x + ad.dx,
    ay1 = a.bbox.y + ad.dy;
  const bx1 = b.bbox.x + bd.dx,
    by1 = b.bbox.y + bd.dy;
  const ax2 = ax1 + a.bbox.w,
    ay2 = ay1 + a.bbox.h;
  const bx2 = bx1 + b.bbox.w,
    by2 = by1 + b.bbox.h;

  if (
    ax1 < bx2 + gap &&
    ax2 + gap > bx1 &&
    ay1 < by2 + gap &&
    ay2 + gap > by1
  ) {
    const dx = Math.min(ax2 + gap - bx1, bx2 + gap - ax1);
    const dy = Math.min(ay2 + gap - by1, by2 + gap - ay1);

    if (dx < dy) {
      if (a.bbox.x < b.bbox.x) {
        ad.dx -= dx / 2;
        bd.dx += dx / 2;
      } else {
        ad.dx += dx / 2;
        bd.dx -= dx / 2;
      }
    } else {
      if (a.bbox.y < b.bbox.y) {
        ad.dy -= dy / 2;
        bd.dy += dy / 2;
      } else {
        ad.dy += dy / 2;
        bd.dy -= dy / 2;
      }
    }
  }
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
