import type { Point, PortSide, NodeRec } from "@domain/types";
import type { Grid } from "./grid";
import { cellCenterToWorld } from "./grid";
import { isTurn, dirFrom } from "./cost";

/**
 * A*가 반환한 셀 목록에서 코너 지점만 정확히 추출
 * 'isTurn' 헬퍼 함수를 재사용하여 코드의 일관성을 높임
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
 * 경로에서 연속된 세 점이 한 직선 위에 있을 경우, 중간 점을 제거
 */
export function cleanupCollinearPoints(path: Point[]): Point[] {
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
 * A* 경로와 포트 정보를 받아, 불필요한 꺾임을 최소화한
 * 최종 렌더링 경로를 생성
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

  if (corners.length < 2) {
    const midPt =
      startSide === "left" || startSide === "right"
        ? { x: endPortPos.x, y: startPortPos.y }
        : { x: startPortPos.x, y: endPortPos.y };
    return cleanupCollinearPoints([startPortPos, midPt, endPortPos]);
  }

  const path: Point[] = [startPortPos];
  let remainingCorners = corners;

  // --- 시작점 연결 최적화 ---
  const firstCorner = remainingCorners[0];
  const secondCorner = remainingCorners[1];
  const isPortHorizontal = startSide === "left" || startSide === "right";
  const isFirstPathSegmentHorizontal =
    Math.abs(firstCorner.y - secondCorner.y) < 1;

  if (isPortHorizontal === isFirstPathSegmentHorizontal) {
    // 방향이 일치: 첫 꺾임을 제거하고, 두 번째 꺾임과 정렬된 점을 추가
    if (isPortHorizontal) {
      path.push({ x: secondCorner.x, y: startPortPos.y });
    } else {
      path.push({ x: startPortPos.x, y: secondCorner.y });
    }
    remainingCorners = remainingCorners.slice(1);
  } else {
    // 방향 불일치: 기존 방식대로 첫 꺾임 지점에 연결
    if (isPortHorizontal) {
      path.push({ x: firstCorner.x, y: startPortPos.y });
    } else {
      path.push({ x: startPortPos.x, y: firstCorner.y });
    }
  }

  // --- 남은 경로와 도착점 연결 ---
  path.push(...remainingCorners);
  const lastPathPoint = path[path.length - 1];
  const isEndPortHorizontal = endSide === "left" || endSide === "right";

  if (
    (isEndPortHorizontal && Math.abs(lastPathPoint.x - endPortPos.x) < 1) ||
    (!isEndPortHorizontal && Math.abs(lastPathPoint.y - endPortPos.y) < 1)
  ) {
    // 마지막 세그먼트와 도착 방향이 일치 -> 마지막 포인트의 좌표를 조정
    path[path.length - 1] = isEndPortHorizontal
      ? { x: endPortPos.x, y: lastPathPoint.y }
      : { x: lastPathPoint.x, y: endPortPos.y };
  } else {
    // 방향 불일치 -> 도착점과 정렬된 중간 지점 추가
    if (isEndPortHorizontal) {
      path.push({ x: lastPathPoint.x, y: endPortPos.y });
    } else {
      path.push({ x: endPortPos.x, y: lastPathPoint.y });
    }
  }

  path.push(endPortPos);

  return cleanupCollinearPoints(path);
}