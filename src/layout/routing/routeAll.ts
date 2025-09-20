import type { Graph, Node, Point, NodeRec, Dir } from "@domain/types";
import { buildGrid, worldToCell, cellAt, Grid } from "./grid";
import { aStarGrid } from "./aStar";
import type { CostConfig } from "./cost";
import { smoothPath } from "./pathSmoother";
import { findBestPortPair } from "./portSelector"; // 새로운 '포트 전략가' import

/**
 * 포트 위치와 진출 방향을 기준으로, 장애물이 없는 첫 번째 그리드 셀(진입점)을 찾습니다.
 * @param grid 라우팅에 사용될 Grid 객체
 * @param pos 포트의 실제 월드 좌표
 * @param side 포트가 위치한 노드의 면 (진출 방향)
 * @returns A* 탐색의 시작/종료점으로 사용될 셀 좌표와 방향
 */
function findEntryPoint(
  grid: Grid,
  pos: Point,
  side: Dir
): { cx: number; cy: number; dir: Dir } {
  let { cx, cy } = worldToCell(grid, pos.x, pos.y);
  const maxIter = grid.cols + grid.rows; // 무한 루프 방지를 위한 안전 장치

  // 지정된 방향으로 한 칸씩 이동하며 'blocked'가 아닌 첫 셀을 찾습니다.
  for (let i = 0; i < maxIter; i++) {
    if (!cellAt(grid, cx, cy)?.blocked) {
      break; // 장애물이 없는 셀을 찾았으므로 루프 종료
    }
    if (side === "U") cy--;
    if (side === "D") cy++;
    if (side === "L") cx--;
    if (side === "R") cx++;
  }
  return { cx, cy, dir: side };
}

/**
 * 그래프의 모든 엣지에 대한 직교 경로를 계산하고 적용합니다.
 * 이 함수는 라우팅 파이프라인의 최종 실행을 담당합니다.
 */
export function routeAll(g: Graph, cfg: any): Graph {
  // 그래프 데이터 복사 (원본 불변성 유지)
  const out = { ...g, edges: new Map(g.edges) };
  // 1. 라우팅을 위한 '지도'를 생성합니다.
  const grid = buildGrid(out, cfg);
  const costCfg = cfg.cost as CostConfig;

  for (const e of out.edges.values()) {
    const s = out.nodes.get(e.sourceId)!;
    const t = out.nodes.get(e.targetId)!;
    if (!s || !t) continue; // 엣지가 유효하지 않으면 건너뜁니다.

    // 2. [핵심] '포트 전략가'를 호출하여 최적의 포트 쌍을 결정합니다.
    const { sourcePort, targetPort, sourceSide, targetSide } = findBestPortPair(
      s,
      t
    );

    // 3. 결정된 포트를 기준으로 A* 탐색을 위한 진입/진출점을 찾습니다.
    const start = findEntryPoint(
      grid,
      sourcePort,
      sourceSide?.toUpperCase() as Dir
    );
    const goal = findEntryPoint(
      grid,
      targetPort,
      targetSide?.toUpperCase() as Dir
    );

    // 4. '탐험가(A*)'를 호출하여 최적의 셀 경로를 찾습니다.
    const aStarPath = aStarGrid(grid, start, goal, costCfg, start.dir);

    let finalPath: Point[];
    if (aStarPath) {
      // 5. '경로 설계자'를 호출하여 셀 경로를 완벽한 직교 좌표 경로로 다듬습니다.
      finalPath = smoothPath(
        aStarPath,
        grid,
        sourcePort,
        targetPort,
        sourceSide,
        targetSide
      );
    } else {
      // 6. A*가 경로를 찾지 못한 경우, 간단한 L자 형태의 비상 경로를 생성합니다.
      const midPt = { x: targetPort.x, y: sourcePort.y };
      finalPath = [sourcePort, midPt, targetPort];
    }

    // 7. 계산된 최종 경로를 엣지 데이터에 업데이트합니다.
    out.edges.set(e.id, { ...e, path: finalPath });

    // 8. (심화) 경로가 지나간 셀의 혼잡도를 높여, 다음 엣지가 이 경로를 피하도록 유도합니다.
    if (aStarPath) {
      for (const node of aStarPath) {
        const cell = cellAt(grid, node.cx, node.cy);
        if (cell) cell.congestion++;
      }
    }
  }
  return out;
}
