import type { Point, PortSide, NodeRec } from "@domain/types";
import type { Grid } from "./grid";
import { cellCenterToWorld } from "./grid";
import { isTurn, dirFrom } from "./cost"; // Dir 타입과 헬퍼 함수 import

/**
 * A*가 반환한 셀 목록에서 코너 지점만 정확히 추출합니다.
 * 'isTurn' 헬퍼 함수를 재사용하여 코드의 일관성을 높입니다.
 */
function findCorners(nodes: NodeRec[], grid: Grid): Point[] {
  if (nodes.length < 2) {
    return nodes.map((n) => cellCenterToWorld(grid, n.cx, n.cy));
  }

  const corners: Point[] = [cellCenterToWorld(grid, nodes[0].cx, nodes[0].cy)];

  for (let i = 1; i < nodes.length - 1; i++) {
    const prev = nodes[i - 1];
    const curr = nodes[i];
    const next = nodes[i + 1];

    // 들어오는 방향(prev->curr)과 나가는 방향(curr->next)을 비교하여 코너인지 판별
    const dirIn = dirFrom(prev, curr);
    const dirOut = dirFrom(curr, next);

    if (isTurn(dirIn, dirOut)) {
      corners.push(cellCenterToWorld(grid, curr.cx, curr.cy));
    }
  }
  corners.push(
    cellCenterToWorld(
      grid,
      nodes[nodes.length - 1].cx,
      nodes[nodes.length - 1].cy
    )
  );
  return corners;
}

/**
 * 경로에서 연속된 세 점이 한 직선 위에 있을 경우, 중간 점을 제거합니다.
 */
function cleanupCollinearPoints(path: Point[]): Point[] {
  if (path.length < 3) return path;
  const cleaned: Point[] = [path[0]];
  for (let i = 1; i < path.length - 1; i++) {
    const pPrev = cleaned[cleaned.length - 1];
    const pCurr = path[i];
    const pNext = path[i + 1];
    const isCollinear =
      (Math.abs(pPrev.x - pCurr.x) < 1e-6 &&
        Math.abs(pCurr.x - pNext.x) < 1e-6) ||
      (Math.abs(pPrev.y - pCurr.y) < 1e-6 &&
        Math.abs(pCurr.y - pNext.y) < 1e-6);
    if (!isCollinear) {
      cleaned.push(pCurr);
    }
  }
  cleaned.push(path[path.length - 1]);
  return cleaned;
}

/**
 * A* 경로와 포트 정보를 받아, 최종 렌더링에 사용될 완벽한 직교 경로를 생성합니다.
 */
export function smoothPath(
  aStarPath: NodeRec[],
  grid: Grid,
  startPortPos: Point,
  endPortPos: Point,
  startSide: PortSide,
  endSide: PortSide
): Point[] {
  const corners = findCorners(aStarPath, grid);

  if (corners.length === 0) {
    const midPt =
      startSide === "left" || startSide === "right"
        ? { x: endPortPos.x, y: startPortPos.y }
        : { x: startPortPos.x, y: endPortPos.y };
    return cleanupCollinearPoints([startPortPos, midPt, endPortPos]);
  }

  const path: Point[] = [startPortPos];
  const firstCorner = corners[0];
  const lastCorner = corners[corners.length - 1];

  if (startSide === "left" || startSide === "right") {
    path.push({ x: firstCorner.x, y: startPortPos.y });
  } else {
    path.push({ x: startPortPos.x, y: firstCorner.y });
  }

  path.push(...corners);

  if (endSide === "left" || endSide === "right") {
    path.push({ x: lastCorner.x, y: endPortPos.y });
  } else {
    path.push({ x: endPortPos.x, y: lastCorner.y });
  }
  path.push(endPortPos);

  return cleanupCollinearPoints(path);
}
