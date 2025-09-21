import type { Graph, Node, Point, NodeRec, Dir, PortSide } from "@domain/types";
import { buildGrid, worldToCell, cellAt, Grid } from "./grid";
import { aStarGrid } from "./aStar";
import type { CostConfig } from "./cost";
import { cleanupCollinearPoints, smoothPath } from "./pathSmoother";
import { findBestPortPair, getCandidateSides } from "./portSelector"; // 새로운 '포트 전략가' import
import { portPosition } from "@layout/port/assign";
import { setLastBuiltGrid } from "@render/debug";
import { manhattan } from "@utils/math";

/**
 * [핵심 개선] A*의 목표 지점을 노드 경계에 더 가깝게 설정하여 '감싸는' 현상을 해결합니다.
 * @param grid 라우팅용 그리드
 * @param pos 실제 포트의 월드 좌표
 * @param side 포트가 위치한 노드의 면
 * @returns A* 탐색을 위한 최적의 시작/종료 셀 정보
 */
function findEntryPoint(
  grid: Grid,
  pos: Point,
  side: PortSide
): { cx: number; cy: number; dir: Dir } | null {
  const { cx: initialCx, cy: initialCy } = worldToCell(grid, pos.x, pos.y);

  // 노드 경계에서 1칸 떨어진 곳을 목표 진입점으로 설정합니다.
  const safeDist = 1;

  let cx = initialCx;
  let cy = initialCy;
  let dir: Dir;

  // 포트 방향에 따라 목표 좌표를 계산
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

  // 1. 가장 이상적인 목표 지점을 시도합니다.
  let cell = cellAt(grid, cx, cy);
  if (cell && !cell.blocked) {
    return { cx, cy, dir };
  }

  // 2. 만약 막혀있다면, 원래 포트 위치에서부터 해당 방향으로 한 칸씩 탐색합니다.
  // 이 비상 로직은 A*가 노드 경계에 최대한 가깝게 접근하도록 보장합니다.
  cx = initialCx;
  cy = initialCy;
  const maxSearch = grid.cols + grid.rows; // 무한 루프 방지
  for (let i = 0; i < maxSearch; i++) {
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
  setLastBuiltGrid(grid);
  const costCfg = cfg.cost as CostConfig;

  // --- [핵심 수정] 라우팅 순서 최적화 ---
  // 시작 노드와 끝 노드 사이의 맨해튼 거리가 '먼' 엣지부터 라우팅하도록 정렬합니다.
  // 이렇게 하면 길고 복잡한 경로가 먼저 자리를 잡고, 짧은 경로들이 이를 피해갈 수 있습니다.
  const edgesToRoute = Array.from(out.edges.values()).sort((a, b) => {
    const nodeA_source = out.nodes.get(a.sourceId)!;
    const nodeA_target = out.nodes.get(a.targetId)!;
    const distA = manhattan(nodeA_source.bbox, nodeA_target.bbox);

    const nodeB_source = out.nodes.get(b.sourceId)!;
    const nodeB_target = out.nodes.get(b.targetId)!;
    const distB = manhattan(nodeB_source.bbox, nodeB_target.bbox);

    return distB - distA; // 거리가 긴 순서대로 (내림차순)
  });

  for (const e of edgesToRoute) {
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
    if (
      bestPath &&
      bestSourcePort &&
      bestTargetPort &&
      bestSourceSide &&
      bestTargetSide
    ) {
      finalPath = smoothPath(
        bestPath,
        grid,
        bestSourcePort,
        bestTargetPort,
        bestSourceSide,
        bestTargetSide
      );
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
