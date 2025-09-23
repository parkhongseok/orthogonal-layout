import type { Graph, Node, Point, NodeRec, Dir, PortSide } from "@domain/types";
import { buildGrid, worldToCell, cellAt, Grid } from "./grid";
import { aStarGrid } from "./aStar";
import type { CostConfig } from "./cost";
import { cleanupCollinearPoints, smoothPath } from "./pathSmoother";
import { getCandidateSides } from "./portSelector";
import { portPosition } from "@layout/port/assign";
import { setLastBuiltGrid } from "@render/debug";
import { manhattan } from "@utils/math";

/**
 * [1단계 성능 개선] A*의 목표 지점을 노드 경계에 더 가깝게 설정하여 '감싸는' 현상을 해결
 * @param grid 라우팅용 그리드
 * @param node 대상 노드
 * @param side 진입/진출할 노드의 면
 * @returns A* 탐색을 위한 최적의 시작/종료 셀 정보
 */
function findEntryPointNearNode(
  grid: Grid,
  node: Node,
  side: PortSide
): { cx: number; cy: number; dir: Dir } | null {
  // 노드의 중앙에서 시작점 탐색
  const nodeCenter = {
    x: node.bbox.x + node.bbox.w / 2,
    y: node.bbox.y + node.bbox.h / 2,
  };
  const { cx: initialCx, cy: initialCy } = worldToCell(
    grid,
    nodeCenter.x,
    nodeCenter.y
  );

  const safeDist = 1;
  let cx = initialCx;
  let cy = initialCy;
  let dir: Dir;

  switch (side) {
    case "top":
      cy = Math.floor((node.bbox.y - grid.originY) / grid.size) - safeDist;
      dir = "U";
      break;
    case "bottom":
      cy =
        Math.ceil((node.bbox.y + node.bbox.h - grid.originY) / grid.size) +
        safeDist;
      dir = "D";
      break;
    case "left":
      cx = Math.floor((node.bbox.x - grid.originX) / grid.size) - safeDist;
      dir = "L";
      break;
    case "right":
      cx =
        Math.ceil((node.bbox.x + node.bbox.w - grid.originX) / grid.size) +
        safeDist;
      dir = "R";
      break;
  }

  // 가장 이상적인 목표 지점을 시도
  let cell = cellAt(grid, cx, cy);
  if (cell && !cell.blocked) {
    return { cx, cy, dir };
  }

  // 만약 막혀있다면, 원래 포트 위치에서부터 해당 방향으로 한 칸씩 탐색
  const maxSearch = grid.cols + grid.rows;
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

  return null;
}

/**
 * [1단계 성능 개선] 그래프의 모든 엣지에 대한 직교 경로를 계산하고 적용
 * A* 호출을 엣지당 1회로 최소화하여 성능을 최적화
 */
export function routeAll(g: Graph, cfg: any): Graph {
  const out = { ...g, edges: new Map(g.edges) };
  const grid = buildGrid(out, cfg);
  setLastBuiltGrid(grid);
  const costCfg = cfg.cost as CostConfig;

  // 라우팅 순서 최적화: 긴 엣지부터 처리
  const edgesToRoute = Array.from(out.edges.values()).sort((a, b) => {
    const nodeA_source = out.nodes.get(a.sourceId)!;
    const nodeA_target = out.nodes.get(a.targetId)!;
    const distA = manhattan(nodeA_source.bbox, nodeA_target.bbox);

    const nodeB_source = out.nodes.get(b.sourceId)!;
    const nodeB_target = out.nodes.get(b.targetId)!;
    const distB = manhattan(nodeB_source.bbox, nodeB_target.bbox);

    return distB - distA;
  });

  for (const e of edgesToRoute) {
    const s = out.nodes.get(e.sourceId)!;
    const t = out.nodes.get(e.targetId)!;
    if (!s || !t) continue;

    // 1. 최적의 연결 방향(side)을 결정
    const candidateSides = getCandidateSides(s, t);
    const [sourceSide, targetSide] = candidateSides[0]; // 가장 우선순위가 높은 후보를 사용

    // 2. A* 탐색을 위한 시작점과 목표점을 노드 경계 근처에서 탐색
    const start = findEntryPointNearNode(grid, s, sourceSide);
    const goal = findEntryPointNearNode(grid, t, targetSide);

    if (!start || !goal) {
      // 경로 탐색 실패 시 비상용 직선 경로 생성
      const sp = portPosition(s, sourceSide, 0.5);
      const tp = portPosition(t, targetSide, 0.5);
      out.edges.set(e.id, { ...e, path: [sp, { x: tp.x, y: sp.y }, tp] });
      continue;
    }

    // 3. 엣지당 단 한번의 A* 탐색을 실행
    const aStarPath = aStarGrid(grid, start, goal, costCfg, start.dir);

    let finalPath: Point[];
    if (aStarPath) {
      // 4. 경로 후처리: A* 경로를 실제 포트 위치와 연결하고 다듬기
      const tempSourcePort = portPosition(s, sourceSide, 0.5);
      const tempTargetPort = portPosition(t, targetSide, 0.5);

      finalPath = smoothPath(
        aStarPath,
        grid,
        tempSourcePort,
        tempTargetPort,
        sourceSide,
        targetSide
      );

      // 그리드에 혼잡도(congestion)를 업데이트
      for (const node of aStarPath) {
        const cell = cellAt(grid, node.cx, node.cy);
        if (cell) cell.congestion++;
      }
    } else {
      // A* 탐색 실패 시 비상용 대체 경로
      const sp = portPosition(s, sourceSide, 0.5);
      const tp = portPosition(t, targetSide, 0.5);
      const midPt = { x: tp.x, y: sp.y };
      finalPath = cleanupCollinearPoints([sp, midPt, tp]);
    }

    out.edges.set(e.id, { ...e, path: finalPath });
  }
  return out;
}
