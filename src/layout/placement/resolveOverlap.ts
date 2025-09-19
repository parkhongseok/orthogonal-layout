import type { Graph, Node, Rect } from "@domain/types";
import { cloneGraph } from "@domain/graph";
import { snap } from "@utils/math";

export function resolveOverlap(g: Graph, cfg: any): Graph {
  const grid = cfg.gridSize as number;
  const inset = (cfg.layout?.groupInset ?? 2) * grid;
  const gapX = (cfg.layout?.nodeGapX ?? 2) * grid;
  const gapY = (cfg.layout?.nodeGapY ?? 2) * grid;

  const out = cloneGraph(g);

  // ====== 그룹 내부 겹침 제거 ======
  for (const [, group] of out.groups) {
    const nodes: Node[] = group.children
      .map((id) => out.nodes.get(id)!)
      .filter(Boolean);
    if (nodes.length > 1) {
      const area: Rect = {
        x: group.bbox.x + inset,
        y: group.bbox.y + inset,
        w: group.bbox.w - inset * 2,
        h: group.bbox.h - inset * 2,
      };
      resolveInContainer(out, nodes, area, { grid, gapX, gapY });
    }
  }

  // ====== 루트 레벨 겹침 제거 ======
  const rootNodes: Node[] = [];
  for (const [, n] of out.nodes) {
    if (!n.groupId) rootNodes.push(n);
  }
  if (rootNodes.length > 1) {
    const marginY = 40;
    const maxBottom = Math.max(
      ...Array.from(out.groups.values()).map((g) => g.bbox.y + g.bbox.h),
      0
    );
    const area: Rect = {
      x: 0,
      y: maxBottom + marginY,
      w: estimateRootWidth(out, grid),
      h: 10000, // 넉넉히 크게
    };
    resolveInContainer(out, rootNodes, area, { grid, gapX, gapY });
  }

  updateGroupBBox(out, grid, inset);

  return out;
}

// ====== 컨테이너 단위 겹침 제거 ======
function resolveInContainer(
  out: Graph,
  nodes: Node[],
  area: Rect,
  p: { grid: number; gapX: number; gapY: number }
) {
  // 1) X축 기준으로 정렬 후 오른쪽으로 밀어내기
  nodes.sort((a, b) => a.bbox.x - b.bbox.x || a.bbox.y - b.bbox.y);
  for (let i = 1; i < nodes.length; i++) {
    const prev = out.nodes.get(nodes[i - 1].id)!;
    const cur = out.nodes.get(nodes[i].id)!;
    let nx = cur.bbox.x;
    if (intersects(prev.bbox, cur.bbox)) {
      nx = prev.bbox.x + prev.bbox.w + p.gapX;
    }
    out.nodes.set(cur.id, {
      ...cur,
      bbox: { ...cur.bbox, x: snap(nx, p.grid) },
    });
  }

  // 2) Y축 기준으로 정렬 후 아래로 밀어내기
  nodes.sort((a, b) => a.bbox.y - b.bbox.y || a.bbox.x - b.bbox.x);
  for (let i = 1; i < nodes.length; i++) {
    const prev = out.nodes.get(nodes[i - 1].id)!;
    const cur = out.nodes.get(nodes[i].id)!;
    let ny = cur.bbox.y;
    if (intersects(prev.bbox, cur.bbox)) {
      ny = prev.bbox.y + prev.bbox.h + p.gapY;
    }
    out.nodes.set(cur.id, {
      ...cur,
      bbox: { ...cur.bbox, y: snap(ny, p.grid) },
    });
  }

  // 3) 컨테이너 영역 안쪽으로 클램프
  for (const n of nodes) {
    const cur = out.nodes.get(n.id)!;
    let x = cur.bbox.x,
      y = cur.bbox.y;
    const gx = area.x,
      gy = area.y;
    const gx2 = area.x + area.w,
      gy2 = area.y + area.h;
    x = Math.max(gx, Math.min(x, gx2 - cur.bbox.w));
    y = Math.max(gy, Math.min(y, gy2 - cur.bbox.h));
    out.nodes.set(cur.id, {
      ...cur,
      bbox: { ...cur.bbox, x: snap(x, p.grid), y: snap(y, p.grid) },
    });
  }
}

function estimateRootWidth(out: Graph, grid: number) {
  const groups = Array.from(out.groups.values());
  if (groups.length === 0) return 800;
  const minX = Math.min(...groups.map((g) => g.bbox.x));
  const maxX = Math.max(...groups.map((g) => g.bbox.x + g.bbox.w));
  return Math.max(800, maxX - minX + 10 * grid * 6);
}

function intersects(a: Rect, b: Rect) {
  return !(
    a.x + a.w <= b.x ||
    b.x + b.w <= a.x ||
    a.y + a.h <= b.y ||
    b.y + b.h <= a.y
  );
}

function updateGroupBBox(out: Graph, grid: number, inset: number) {
  for (const [, group] of out.groups) {
    if (!group.children?.length) continue;
    const nodes = group.children.map(id => out.nodes.get(id)!).filter(Boolean);
    const minX = Math.min(...nodes.map(n => n.bbox.x));
    const minY = Math.min(...nodes.map(n => n.bbox.y));
    const maxX = Math.max(...nodes.map(n => n.bbox.x + n.bbox.w));
    const maxY = Math.max(...nodes.map(n => n.bbox.y + n.bbox.h));
    group.bbox = {
      x: snap(minX - inset, grid),
      y: snap(minY - inset, grid),
      w: snap((maxX - minX) + inset * 2, grid),
      h: snap((maxY - minY) + inset * 2, grid),
    };
    out.groups.set(group.id, group);
  }
}
