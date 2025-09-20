import type { Graph, Rect } from "@domain/types";
import { computeWorldBounds } from "@render/world"; // world 계산은 기존 헬퍼 재사용

export interface GridCell {
  blocked: boolean; // 장애물 여부 (이 셀은 통과할 수 없음)
  congestion: number; // 혼잡도 (경로가 이 셀을 지나갈 때마다 1씩 증가)
}

export interface Grid {
  readonly cols: number; // 그리드의 가로 셀 개수
  readonly rows: number; // 그리드의 세로 셀 개수
  readonly size: number; // 셀 하나의 픽셀 크기 (gridSize)
  readonly originX: number; // 월드 좌표 -> 그리드 좌표 변환 시 사용될 기준점 X
  readonly originY: number; // 월드 좌표 -> 그리드 좌표 변환 시 사용될 기준점 Y
  readonly cells: GridCell[]; // 전체 셀 데이터 (1차원 배열)
}

/**
 * 그리드 좌표(cx, cy)를 1차원 배열 인덱스로 변환합니다.
 */
function getCellIndex(grid: Grid, cx: number, cy: number): number {
  return cy * grid.cols + cx;
}

/**
 * 그리드 좌표로 해당 셀의 데이터를 가져옵니다. 맵 밖이면 undefined를 반환합니다.
 */
export function cellAt(
  grid: Grid,
  cx: number,
  cy: number
): GridCell | undefined {
  if (cx < 0 || cy < 0 || cx >= grid.cols || cy >= grid.rows) {
    return undefined;
  }
  return grid.cells[getCellIndex(grid, cx, cy)];
}

/**
 * 그래프의 모든 노드와 그룹을 장애물로 등록한 최종 '지도' Grid를 생성합니다.
 * 이 함수는 라우팅 파이프라인의 핵심 준비 단계입니다.
 */
export function buildGrid(graph: Graph, cfg: any): Grid {
  const gridSize = cfg.gridSize;
  const worldBounds = computeWorldBounds(graph);

  // 1. 그리드의 전체 크기와 기준점을 계산합니다.
  // 월드 경계보다 사방으로 10칸씩 여유를 주어 경로 탐색이 막히지 않도록 합니다.
  const margin = gridSize * 10;
  const originX = Math.floor((worldBounds.x - margin) / gridSize) * gridSize;
  const originY = Math.floor((worldBounds.y - margin) / gridSize) * gridSize;
  const worldWidth = worldBounds.w + margin * 2;
  const worldHeight = worldBounds.h + margin * 2;

  const cols = Math.ceil(worldWidth / gridSize);
  const rows = Math.ceil(worldHeight / gridSize);

  // 2. 모든 셀을 '통과 가능(blocked: false)' 상태로 초기화합니다.
  const cells: GridCell[] = Array.from({ length: cols * rows }, () => ({
    blocked: false,
    congestion: 0,
  }));

  const grid: Grid = { cols, rows, size: gridSize, originX, originY, cells };

  // 3. [핵심 강화] 노드를 장애물로 등록합니다.
  // cfg.routing.bboxExpand 값만큼 노드 주변에 '안전 여백'을 추가하여 장애물로 만듭니다.
  const nodeExpand = cfg.routing?.bboxExpand ?? 1; // 기본값 1로 설정
  for (const node of graph.nodes.values()) {
    markRectAsBlocked(grid, node.bbox, nodeExpand);
  }

  // // 4. 그룹 경계도 장애물로 등록합니다. (여백 없이)
  // for (const group of graph.groups.values()) {
  //   markRectAsBlocked(grid, group.bbox, 0);
  // }

  // [디버깅] 블록 처리된 셀의 총 개수를 로그로 남깁니다.
  const blockedCount = cells.filter((c) => c.blocked).length;
  console.log(
    `Grid created: ${cols}x${rows}. Blocked cells: ${blockedCount} (${(
      (blockedCount / (cols * rows)) *
      100
    ).toFixed(1)}%)`
  );

  return grid;
}

/**
 * [헬퍼 함수] 주어진 사각형(Rect) 영역에 해당하는 셀들을 'blocked: true'로 설정합니다.
 */
function markRectAsBlocked(grid: Grid, rect: Rect, paddingInCells: number) {
  // 월드 좌표(px)를 그리드 셀 인덱스로 변환합니다.
  const startX =
    Math.floor((rect.x - grid.originX) / grid.size) - paddingInCells;
  const startY =
    Math.floor((rect.y - grid.originY) / grid.size) - paddingInCells;
  const endX =
    Math.ceil((rect.x + rect.w - grid.originX) / grid.size) + paddingInCells;
  const endY =
    Math.ceil((rect.y + rect.h - grid.originY) / grid.size) + paddingInCells;

  for (let y = startY; y < endY; y++) {
    for (let x = startX; x < endX; x++) {
      const cell = cellAt(grid, x, y);
      if (cell) {
        cell.blocked = true;
      }
    }
  }
}

/** 월드 좌표(px)를 가장 가까운 그리드 셀 좌표로 변환합니다. */
export function worldToCell(
  grid: Grid,
  x: number,
  y: number
): { cx: number; cy: number } {
  const cx = Math.round((x - grid.originX) / grid.size);
  const cy = Math.round((y - grid.originY) / grid.size);
  return { cx, cy };
}

/** 그리드 셀 좌표를 해당 셀의 중앙 월드 좌표(px)로 변환합니다. */
export function cellCenterToWorld(
  grid: Grid,
  cx: number,
  cy: number
): { x: number; y: number } {
  return {
    x: grid.originX + cx * grid.size + grid.size / 2,
    y: grid.originY + cy * grid.size + grid.size / 2,
  };
}
