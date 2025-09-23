import type { Graph, Group, GroupId, Node, Rect } from "@domain/types";
import { cloneGraph } from "@domain/graph";
import { snap } from "@utils/math";

export function initialPlacement(g: Graph, cfg: any): Graph {
  const grid = cfg.gridSize as number;
  const inset = (cfg.layout?.groupInset ?? 2) * grid;
  const gapX = (cfg.layout?.nodeGapX ?? 2) * grid;
  const gapY = (cfg.layout?.nodeGapY ?? 2) * grid;
  const gGapX = (cfg.layout?.groupGapX ?? 6) * grid; // 그룹 간 간격(px)
  const gGapY = (cfg.layout?.groupGapY ?? 6) * grid;

  const out = cloneGraph(g);

  // === 0) 그룹별 필요 크기 먼저 계산(자식 수 기반)
  type Need = {
    id: GroupId;
    needW: number;
    needH: number;
    maxW: number;
    maxH: number;
    count: number;
  };
  const needs: Need[] = [];
  for (const [, group] of out.groups) {
    const children = group.children
      .map((id) => out.nodes.get(id)!)
      .filter(Boolean);
    const count = children.length;
    if (count === 0) {
      // 자식 없으면 최소 크기 유지
      needs.push({
        id: group.id,
        needW: group.bbox.w,
        needH: group.bbox.h,
        maxW: 0,
        maxH: 0,
        count,
      });
      continue;
    }
    const maxW = Math.max(...children.map((n) => n.bbox.w));
    const maxH = Math.max(...children.map((n) => n.bbox.h));
    const cellW = maxW + gapX;
    const cellH = maxH + gapY;
    const cols = Math.max(1, Math.ceil(Math.sqrt(count)));
    const rows = Math.max(1, Math.ceil(count / cols));
    const innerW = cols * cellW - gapX;
    const innerH = rows * cellH - gapY;
    const needW = snap(innerW + inset * 2, grid);
    const needH = snap(innerH + inset * 2, grid);
    needs.push({ id: group.id, needW, needH, maxW, maxH, count });
  }

  // === 1) 그룹 레벨 격자 배치(상호 겹치지 않게 x,y 재배치)
  const nGroups = needs.length;
  if (nGroups > 0) {
    const cols = Math.ceil(Math.sqrt(nGroups));
    const rows = Math.ceil(nGroups / cols);

    // 셀 크기는 컬럼/로우의 최대 needW/H를 사용(균일 셀)
    const colWidths: number[] = new Array(cols).fill(0);
    const rowHeights: number[] = new Array(rows).fill(0);

    needs.forEach((nd, i) => {
      const c = i % cols,
        r = Math.floor(i / cols);
      colWidths[c] = Math.max(colWidths[c], nd.needW);
      rowHeights[r] = Math.max(rowHeights[r], nd.needH);
    });

    // 누적 오프셋
    const xOffsets: number[] = [];
    const yOffsets: number[] = [];
    for (let c = 0, x = 0; c < cols; c++) {
      xOffsets[c] = snap(x, grid);
      x += colWidths[c]; // 먼저 현재 컬럼의 너비를 더하고,
      if (c < cols - 1) {
        // 마지막 컬럼이 아닐 경우에만 간격을 더합니다.
        x += gGapX;
      }
    }
    for (let r = 0, y = 40; r < rows; r++) {
      yOffsets[r] = snap(y, grid);
      y += rowHeights[r]; // 먼저 현재 로우의 높이를 더하고,
      if (r < rows - 1) {
        // 마지막 로우가 아닐 경우에만 간격을 더합니다.
        y += gGapY;
      }
    }

    // 실제 그룹 위치/크기 적용
    needs.forEach((nd, i) => {
      const c = i % cols,
        r = Math.floor(i / cols);
      const group = out.groups.get(nd.id)!;
      const gx = xOffsets[c] + Math.max(0, (colWidths[c] - nd.needW) / 2); // 셀 중앙 정렬
      const gy = yOffsets[r] + Math.max(0, (rowHeights[r] - nd.needH) / 2);
      group.bbox = {
        x: snap(gx, grid),
        y: snap(gy, grid),
        w: nd.needW,
        h: nd.needH,
      };
      out.groups.set(group.id, group);
    });
  }

  // === 2) 그룹 내부 타일링(확정된 bbox 내부에 자식 배치)
  for (const [, group] of out.groups) {
    const children: Node[] = group.children
      .map((id) => out.nodes.get(id)!)
      .filter(Boolean);
    if (children.length === 0) continue;
    tileNodes(
      out,
      children,
      {
        x: group.bbox.x + inset,
        y: group.bbox.y + inset,
        w: group.bbox.w - inset * 2,
        h: group.bbox.h - inset * 2,
      },
      grid,
      gapX,
      gapY
    );
  }

  // === 3) 루트(그룹 밖) 타일링(이전 그대로)
  const rootNodes: Node[] = [];
  for (const [, n] of out.nodes) if (!n.groupId) rootNodes.push(n);

  if (rootNodes.length > 0) {
    // 루트 노드를 배치할 영역을 더 안정적으로 계산합니다.
    const groups = Array.from(out.groups.values());
    let area: Rect;

    if (groups.length > 0) {
      // 그룹이 있을 경우, 모든 그룹을 포함하는 전체 경계 상자를 계산합니다.
      const minX = Math.min(...groups.map((gp) => gp.bbox.x));
      const maxX = Math.max(...groups.map((gp) => gp.bbox.x + gp.bbox.w));
      const minY = Math.min(...groups.map((gp) => gp.bbox.y));
      const maxY = Math.max(...groups.map((gp) => gp.bbox.y + gp.bbox.h));

      const width = maxX - minX;
      const height = maxY - minY;

      // 루트 노드 영역을 전체 경계 상자의 '아래' 또는 '오른쪽' 중 더 넓은 공간에 배치
      if (width > height) {
        // 가로로 넓은 경우: 아래에 배치
        area = {
          x: minX,
          y: snap(maxY + gGapY, grid), // 그룹 간 간격만큼 여유를 둠
          w: width,
          h: Math.max(
            200,
            Math.ceil(rootNodes.length / 10) * (6 * grid + gapY)
          ),
        };
      } else {
        // 세로로 넓거나 비슷한 경우: 오른쪽에 배치
        area = {
          x: snap(maxX + gGapX, grid), // 그룹 간 간격만큼 여유를 둠
          y: minY,
          w: Math.max(
            400,
            Math.ceil(rootNodes.length / 10) * (6 * grid + gapX)
          ),
          h: height,
        };
      }
    } else {
      // 그룹이 아예 없는 경우, 기본 영역에 배치
      area = { x: 0, y: 40, w: 800, h: 600 };
    }

    tileNodes(out, rootNodes, area, grid, gapX, gapY);
  }

  return out;
}

function tileNodes(
  out: Graph,
  nodes: Node[],
  area: Rect,
  grid: number,
  gapX: number,
  gapY: number
) {
  if (!nodes.length) return;
  const maxW = Math.max(...nodes.map((n) => n.bbox.w));
  const maxH = Math.max(...nodes.map((n) => n.bbox.h));
  const cellW = maxW + gapX;
  const cellH = maxH + gapY;
  const cols = Math.max(1, Math.floor(area.w / cellW));
  const rows = Math.max(1, Math.ceil(nodes.length / cols));
  const usedW = cols * cellW - gapX;
  const usedH = rows * cellH - gapY;
  const startX = snap(area.x + Math.max(0, (area.w - usedW) / 2), grid);
  const startY = snap(area.y + Math.max(0, (area.h - usedH) / 2), grid);

  nodes.forEach((n, idx) => {
    const c = idx % cols;
    const r = Math.floor(idx / cols);
    const x = startX + c * cellW + Math.max(0, (cellW - n.bbox.w - gapX) / 2);
    const y = startY + r * cellH + Math.max(0, (cellH - n.bbox.h - gapY) / 2);
    out.nodes.set(n.id, {
      ...n,
      bbox: { ...n.bbox, x: snap(x, grid), y: snap(y, grid) },
    });
  });
}

function estimateRootWidth(out: Graph, grid: number) {
  const groups = Array.from(out.groups.values());
  if (!groups.length) return 800;
  const minX = Math.min(...groups.map((g) => g.bbox.x));
  const maxX = Math.max(...groups.map((g) => g.bbox.x + g.bbox.w));
  const total = maxX - minX + 6 * grid * 10;
  return Math.max(800, total);
}
