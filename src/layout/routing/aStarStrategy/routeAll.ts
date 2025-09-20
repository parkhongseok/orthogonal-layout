import type { Graph, Node, Point, NodeRec, Dir, PortSide } from "@domain/types";
import { buildGrid, worldToCell, cellAt, Grid } from "./grid";
import { aStarGrid } from "./aStar";
import type { CostConfig } from "./cost";
import { cleanupCollinearPoints, smoothPath } from "./pathSmoother";
import { findBestPortPair, getCandidateSides } from "./portSelector"; // 새로운 '포트 전략가' import
import { portPosition } from "@layout/port/assign";

// (디버깅 목적으로만 사용합니다)
export let lastBuiltGrid: Grid | null = null;

export function clearLastBuiltGrid() {
  lastBuiltGrid = null;
}

/**
 * [수정] findEntryPoint 함수를 더 안정적인 로직으로 전면 교체합니다.
 * 포트 위치에서 지정된 방향으로 '안전 거리'만큼 떨어진 유효한 셀을 찾습니다.
 */
function findEntryPoint(
  grid: Grid,
  pos: Point,
  side: PortSide
): { cx: number; cy: number; dir: Dir } | null {
  const { cx: initialCx, cy: initialCy } = worldToCell(grid, pos.x, pos.y);
  const safeDist = 2; // 노드 경계에서 최소 2칸 떨어진 곳을 진입점으로 설정

  let cx = initialCx;
  let cy = initialCy;
  let dir: Dir;

  // 포트 방향에 따라 '안전지대' 좌표를 계산
  switch (side) {
    case "top":
      cy -= safeDist;
      dir = "U";
      break;
    case "bottom":
      cy += safeDist;
      dir = "D";
      break;
    case "left":
      cx -= safeDist;
      dir = "L";
      break;
    case "right":
      cx += safeDist;
      dir = "R";
      break;
  }

  // 계산된 좌표가 유효한지(맵 안이고, 장애물이 없는지) 확인
  const cell = cellAt(grid, cx, cy);
  if (cell && !cell.blocked) {
    return { cx, cy, dir };
  }

  // 만약 안전지대가 막혀있다면, 원래 위치에서부터 한 칸씩 탐색 (비상 로직)
  cx = initialCx;
  cy = initialCy;
  for (let i = 0; i < grid.cols + grid.rows; i++) {
    if (side === "top") cy--;
    if (side === "bottom") cy++;
    if (side === "left") cx--;
    if (side === "right") cx++;
    const fallbackCell = cellAt(grid, cx, cy);
    if (fallbackCell && !fallbackCell.blocked) {
      return { cx, cy, dir };
    }
  }

  return null; // 모든 시도 후에도 유효한 진입점을 찾지 못함
}

/**
 * 그래프의 모든 엣지에 대한 직교 경로를 계산하고 적용합니다.
 * 이 함수는 라우팅 파이프라인의 최종 실행을 담당합니다.
 */
export function routeAll(g: Graph, cfg: any): Graph {
  const out = { ...g, edges: new Map(g.edges) };
  const grid = buildGrid(out, cfg);
  lastBuiltGrid = grid;
  const costCfg = cfg.cost as CostConfig;

  for (const e of out.edges.values()) {
    const s = out.nodes.get(e.sourceId)!;
    const t = out.nodes.get(e.targetId)!;
    if (!s || !t) continue;

    // [핵심 수정] 모든 후보 포트 쌍에 대해 A*를 실행하여 최적의 경로를 찾습니다.
    let bestPath: NodeRec[] | null = null;
    let bestSourcePort: Point | null = null;
    let bestTargetPort: Point | null = null;
    let bestSourceSide: PortSide | null = null;
    let bestTargetSide: PortSide | null = null;
    let minCost = Infinity;

    const candidatePairs = getCandidateSides(s, t);

    for (const [sourceSide, targetSide] of candidatePairs) {
      const sourcePorts = (s.ports || []).filter((p) => p.side === sourceSide);
      const targetPorts = (t.ports || []).filter((p) => p.side === targetSide);

      // 모든 포트 조합을 테스트합니다.
      for (const sPortInfo of sourcePorts) {
        for (const tPortInfo of targetPorts) {
          const sourcePort = portPosition(s, sPortInfo.side, sPortInfo.offset);
          const targetPort = portPosition(t, tPortInfo.side, tPortInfo.offset);

          const start = findEntryPoint(grid, sourcePort, sourceSide);
          const goal = findEntryPoint(grid, targetPort, targetSide);

          if (!start || !goal) continue;

          const aStarPath = aStarGrid(grid, start, goal, costCfg, start.dir);

          if (aStarPath) {
            const pathCost = aStarPath[aStarPath.length - 1].g; // 최종 경로 비용
            if (pathCost < minCost) {
              minCost = pathCost;
              bestPath = aStarPath;
              bestSourcePort = sourcePort;
              bestTargetPort = targetPort;
              bestSourceSide = sourceSide;
              bestTargetSide = targetSide;
            }
          }
        }
      }
    }

    let finalPath: Point[];
    if (bestPath && bestSourcePort && bestTargetPort && bestSourceSide && bestTargetSide) {
      finalPath = smoothPath(bestPath, grid, bestSourcePort, bestTargetPort, bestSourceSide, bestTargetSide);
    } else {
      // 최적 경로를 찾지 못한 경우에만 비상용 대체 경로 사용
      const fallbackPair = getCandidateSides(s, t)[0];
      const sp = portPosition(s, fallbackPair[0], 0.5);
      const tp = portPosition(t, fallbackPair[1], 0.5);
      const midPt = { x: tp.x, y: sp.y };
      finalPath = cleanupCollinearPoints([sp, midPt, tp]);
    }

    out.edges.set(e.id, { ...e, path: finalPath });

    if (bestPath) {
      for (const node of bestPath) {
        const cell = cellAt(grid, node.cx, node.cy);
        if (cell) cell.congestion++;
      }
    }
  }
  return out;
}