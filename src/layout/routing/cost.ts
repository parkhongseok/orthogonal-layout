// src/layout/routing/cost.ts
export interface CostConfig {
  distance: number;   // 한 스텝(인접 셀) 이동 비용 가중치
  bend: number;       // 진행 방향이 바뀔 때(코너) 가중치
  obstacle: number;   // 장애물 셀로 진입 시(실제로는 금지 or 큰 페널티)
  congestion: number; // 혼잡 셀(이미 경로가 많은 셀)의 가중치
}

export type Dir = "U" | "D" | "L" | "R";

/** 맨해튼 휴리스틱 */
export function hManhattan(ax: number, ay: number, bx: number, by: number, dist = 1) {
  return (Math.abs(ax - bx) + Math.abs(ay - by)) * dist;
}

/** 방향 값 계산 */
export function dirFrom(a: {cx:number;cy:number}, b: {cx:number;cy:number}): Dir {
  if (b.cx > a.cx) return "R";
  if (b.cx < a.cx) return "L";
  if (b.cy > a.cy) return "D";
  return "U";
}

/** 코너(방향 전환)인지 */
export function isTurn(prev?: Dir, next?: Dir) {
  if (!prev || !next) return false;
  return (prev === "L" || prev === "R") ? (next === "U" || next === "D")
                                        : (next === "L" || next === "R");
}

/** 스텝 비용 합산 (필요시 더 세밀하게 확장) */
export function stepCost(
  cfg: CostConfig,
  baseDist: number,
  turning: boolean,
  isObstacle: boolean,
  congestion: number
) {
  let c = 0;
  c += cfg.distance * baseDist;
  if (turning) c += cfg.bend;
  if (isObstacle) c += cfg.obstacle;
  if (congestion > 0) c += cfg.congestion * congestion;
  return c;
}
