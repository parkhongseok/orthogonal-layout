// src/layout/routing/grid.ts
import type { Graph, Rect } from "@domain/types";

export interface GridCell {
  blocked: boolean;      // 장애물 여부
  congestion: number;    // 혼잡도(경로가 지나가며 증가시킴)
}

export interface Grid {
  cols: number;          // x방향 셀 수
  rows: number;          // y방향 셀 수
  size: number;          // 한 셀의 픽셀(GridSize)
  originX: number;       // 월드 좌표→그리드 좌표 변환 기준
  originY: number;
  cells: GridCell[];     // length = cols * rows
}

function idx(g: Grid, cx: number, cy: number) {
  return cy * g.cols + cx;
}

export function cellAt(g: Grid, cx: number, cy: number): GridCell | undefined {
  if (cx < 0 || cy < 0 || cx >= g.cols || cy >= g.rows) return undefined;
  return g.cells[idx(g, cx, cy)];
}

function rectToGridCells(g: Grid, r: Rect, padCells = 0) {
  const left   = Math.floor((r.x - g.originX) / g.size) - padCells;
  const top    = Math.floor((r.y - g.originY) / g.size) - padCells;
  const right  = Math.ceil((r.x + r.w - g.originX) / g.size) + padCells;
  const bottom = Math.ceil((r.y + r.h - g.originY) / g.size) + padCells;
  return { left, top, right, bottom };
}

/**
 * 그래프의 노드/그룹 bbox를 장애물로 표시한 Grid 생성
 * - cfg.routing?.bboxExpand: 바운딩박스 주위로 몇 셀 더 확장(block)
 * - cols/rows는 현재 월드 바운드로 산정(필요시 margin을 더 늘려도 됨)
 */
export function buildGrid(graph: Graph, cfg: any): Grid {
  const gridSize = cfg?.gridSize ?? 12;
  // 월드 바운드 추정
  const xs: number[] = [], ys: number[] = [];
  for (const [, n] of graph.nodes) {
    xs.push(n.bbox.x, n.bbox.x + n.bbox.w);
    ys.push(n.bbox.y, n.bbox.y + n.bbox.h);
  }
  for (const [, g] of graph.groups) {
    xs.push(g.bbox.x, g.bbox.x + g.bbox.w);
    ys.push(g.bbox.y, g.bbox.y + g.bbox.h);
  }
  const minX = Math.min(...xs, 0), maxX = Math.max(...xs, 2000);
  const minY = Math.min(...ys, 0), maxY = Math.max(...ys, 1200);

  const marginPx = gridSize * 10; // 여유
  const originX = Math.floor((minX - marginPx) / gridSize) * gridSize;
  const originY = Math.floor((minY - marginPx) / gridSize) * gridSize;
  const widthPx  = (maxX - minX) + marginPx * 2;
  const heightPx = (maxY - minY) + marginPx * 2;

  const cols = Math.max(10, Math.ceil(widthPx / gridSize));
  const rows = Math.max(10, Math.ceil(heightPx / gridSize));
  const cells: GridCell[] = Array.from({ length: cols * rows }, () => ({ blocked: false, congestion: 0 }));

  const g: Grid = { cols, rows, size: gridSize, originX, originY, cells };

  const expand = cfg?.routing?.bboxExpand ?? 0;

  // 노드/그룹을 장애물로 마킹
  for (const [, n] of graph.nodes) {
    const { left, top, right, bottom } = rectToGridCells(g, n.bbox, expand);
    for (let cy = top; cy < bottom; cy++) {
      for (let cx = left; cx < right; cx++) {
        const c = cellAt(g, cx, cy);
        if (c) c.blocked = true;
      }
    }
  }
  for (const [, gr] of graph.groups) {
    const { left, top, right, bottom } = rectToGridCells(g, gr.bbox, 0);
    // 그룹 박스 테두리 정도만 막고 싶으면 padCells=1, 내부는 비워도 된다(선택)
    for (let cy = top; cy < bottom; cy++) {
      for (let cx = left; cx < right; cx++) {
        // 선택: 그룹은 "약한" 장애물로 둘 수도 있음(여긴 막지 않음)
        // const c = cellAt(g, cx, cy);
        // if (c) c.blocked = c.blocked || false;
      }
    }
  }

  return g;
}

/** 월드좌표→그리드셀 변환 */
export function worldToCell(g: Grid, x: number, y: number) {
  const cx = Math.round((x - g.originX) / g.size);
  const cy = Math.round((y - g.originY) / g.size);
  return { cx, cy };
}

/** 그리드셀→월드좌표 (셀 가운데) */
export function cellCenterToWorld(g: Grid, cx: number, cy: number) {
  return {
    x: g.originX + cx * g.size,
    y: g.originY + cy * g.size,
  };
}
