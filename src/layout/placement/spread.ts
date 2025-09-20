// src/layout/placement/spread.ts

import type { Graph, Node, Group, Rect, NodeId, GroupId } from "@domain/types";
import { snap } from "@utils/math";

/**
 * 간단 Repulsion 기반 스프레드:
 * - 컨테이너(그룹/루트)별로만 처리 → 컨테이너 간 간섭 없음
 * - 겹치면 최소 여백(nodeGapX/Y)을 만족하도록 양쪽으로 조금씩 이동
 * - 컨테이너 경계를 벗어나지 않게 클램프
 * - 매 반복 후 격자 스냅
 *
 * cfg.layout:
 * - nodeGapX, nodeGapY: 최소 간격(격자 셀 수)
 * - groupInset: 그룹 안쪽 여백(격자 셀 수)
 * - iterations?: 반복 횟수(옵션), default 20
 * - step?: 이동 스텝 스케일(옵션), default 0.5
 */
export function spreadNodes(g: Graph, cfg: any): Graph {
  const grid = cfg.gridSize as number;
  const gapX = (cfg.layout?.nodeGapX ?? 2) * grid;
  const gapY = (cfg.layout?.nodeGapY ?? 2) * grid;
  const inset = (cfg.layout?.groupInset ?? 2) * grid;
  const iterations = cfg.layout?.spreadIterations ?? 20;
  const step = cfg.layout?.spreadStep ?? 0.5; // 0~1

  const out: Graph = {
    nodes: new Map(g.nodes),
    edges: new Map(g.edges),
    groups: new Map(g.groups),
  };

  // 1) 컨테이너(그룹/루트)별 노드 묶기
  const within: Map<GroupId | "__ROOT__", Node[]> = new Map();
  const rootKey = "__ROOT__" as unknown as GroupId;

  for (const [, n] of out.nodes) {
    const k = (n.groupId ?? rootKey) as GroupId;
    const arr = within.get(k) ?? [];
    arr.push(n);
    within.set(k, arr);
  }

  // 2) 컨테이너별 스프레드
  for (const [key, nodes] of within) {
    if (nodes.length <= 1) continue;

    // 컨테이너 bounds
    const container: Rect =
      key === rootKey
        ? rootArea(out, grid) // 루트 레벨 전체 영역
        : inflate(out.groups.get(key as GroupId)!.bbox, -inset, -inset); // 그룹 내부(inset 적용)

    // 반복적인 충돌 해소
    for (let it = 0; it < iterations; it++) {
      let moved = 0;

      // 쌍 검사(O(n^2)) — 그룹당 수십개면 충분히 감당
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = out.nodes.get(nodes[i].id)!;
          const b = out.nodes.get(nodes[j].id)!;

          const push = resolvePair(a.bbox, b.bbox, gapX, gapY);
          if (push.dx !== 0 || push.dy !== 0) {
            // 양쪽으로 나눠 밀기
            const ax = clamp(
              a.bbox.x - push.dx * step,
              container.x,
              container.x + container.w - a.bbox.w
            );
            const ay = clamp(
              a.bbox.y - push.dy * step,
              container.y,
              container.y + container.h - a.bbox.h
            );
            const bx = clamp(
              b.bbox.x + push.dx * step,
              container.x,
              container.x + container.w - b.bbox.w
            );
            const by = clamp(
              b.bbox.y + push.dy * step,
              container.y,
              container.y + container.h - b.bbox.h
            );

            out.nodes.set(a.id, {
              ...a,
              bbox: { ...a.bbox, x: snap(ax, grid), y: snap(ay, grid) },
            });
            out.nodes.set(b.id, {
              ...b,
              bbox: { ...b.bbox, x: snap(bx, grid), y: snap(by, grid) },
            });
            moved++;
          }
        }
      }

      // 컨테이너 경계 보호(스냅 후 경계 재확인)
      for (const n of nodes) {
        const cur = out.nodes.get(n.id)!;
        const nx = clamp(
          cur.bbox.x,
          container.x,
          container.x + container.w - cur.bbox.w
        );
        const ny = clamp(
          cur.bbox.y,
          container.y,
          container.y + container.h - cur.bbox.h
        );
        if (nx !== cur.bbox.x || ny !== cur.bbox.y) {
          out.nodes.set(cur.id, {
            ...cur,
            bbox: { ...cur.bbox, x: nx, y: ny },
          });
        }
      }

      if (moved === 0) break; // 수렴
    }
  }

  // 3) 그룹 bbox 갱신(컨테이너 내부 노드 이동 반영)
  updateGroupBBox(out, grid, inset);

  return out;
}

/** 두 박스 사이가 gapX/gapY를 만족하지 않으면 밀어낼 오프셋(dx,dy) 반환 */
function resolvePair(a: Rect, b: Rect, gapX: number, gapY: number) {
  // 필요한 최소 간격을 포함한 확장 박스 기준으로 충돌 판단
  const ax1 = a.x - gapX / 2,
    ax2 = a.x + a.w + gapX / 2;
  const ay1 = a.y - gapY / 2,
    ay2 = a.y + a.h + gapY / 2;

  const bx1 = b.x - gapX / 2,
    bx2 = b.x + b.w + gapX / 2;
  const by1 = b.y - gapY / 2,
    by2 = b.y + b.h + gapY / 2;

  const overlapX = Math.min(ax2, bx2) - Math.max(ax1, bx1);
  const overlapY = Math.min(ay2, by2) - Math.max(ay1, by1);

  if (overlapX <= 0 || overlapY <= 0) return { dx: 0, dy: 0 }; // 겹치지 않음

  // 더 작은 축으로 분리(시각적으로 덜 튐)
  if (overlapX < overlapY) {
    // a가 왼쪽이면 a←, b→
    const dir = a.x + a.w / 2 <= b.x + b.w / 2 ? -1 : 1;
    return { dx: dir * overlapX, dy: 0 };
  } else {
    // a가 위쪽이면 a↑, b↓
    const dir = a.y + a.h / 2 <= b.y + b.h / 2 ? -1 : 1;
    return { dx: 0, dy: dir * overlapY };
  }
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}
function inflate(r: Rect, dx: number, dy: number): Rect {
  return { x: r.x + dx, y: r.y + dy, w: r.w - 2 * dx, h: r.h - 2 * dy };
}

/** 루트 레벨 컨테이너(화면 전체/그룹 배열 바깥) 대략 영역 */
function rootArea(out: Graph, grid: number): Rect {
  const nodes = Array.from(out.nodes.values()).filter((n) => !n.groupId);
  if (nodes.length === 0) return { x: 0, y: 0, w: 4000, h: 2000 };
  const minX = Math.min(...nodes.map((n) => n.bbox.x));
  const minY = Math.min(...nodes.map((n) => n.bbox.y));
  const maxX = Math.max(...nodes.map((n) => n.bbox.x + n.bbox.w));
  const maxY = Math.max(...nodes.map((n) => n.bbox.y + n.bbox.h));
  const pad = grid * 6;
  return {
    x: minX - pad,
    y: minY - pad,
    w: maxX - minX + pad * 2,
    h: maxY - minY + pad * 2,
  };
}

/** 그룹 bbox를 자식 노드에 맞춰 재계산 */
function updateGroupBBox(out: Graph, grid: number, inset: number) {
  for (const [gid, g] of out.groups) {
    const children = g.children
      .map((id) => out.nodes.get(id))
      .filter(Boolean) as Node[];
    if (children.length === 0) continue;
    const minX = Math.min(...children.map((n) => n.bbox.x));
    const minY = Math.min(...children.map((n) => n.bbox.y));
    const maxX = Math.max(...children.map((n) => n.bbox.x + n.bbox.w));
    const maxY = Math.max(...children.map((n) => n.bbox.y + n.bbox.h));
    // inset을 다시 추가해서 약간 여백 확보
    const x = snap(minX - inset, grid);
    const y = snap(minY - inset, grid);
    const w = snap(maxX - minX + inset * 2, grid);
    const h = snap(maxY - minY + inset * 2, grid);
    out.groups.set(gid, { ...g, bbox: { x, y, w, h } });
  }
}
