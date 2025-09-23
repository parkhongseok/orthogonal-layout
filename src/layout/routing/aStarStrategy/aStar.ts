// [수정] 우선순위큐 사용을 통한 O(logN)으로 개선, 기존 배열 사용 시 O(N)
import { cellAt, Grid } from "./grid";
import { CostConfig, hManhattan, isTurn } from "./cost";
import { PriorityQueue } from "@utils/priorityQueue";
import { Dir, NodeRec } from "@domain/types";

function neighbors(cx: number, cy: number) {
  return [
    { cx: cx + 1, cy, dir: "R" as const },
    { cx: cx - 1, cy, dir: "L" as const },
    { cx, cy: cy + 1, dir: "D" as const },
    { cx, cy: cy - 1, dir: "U" as const },
  ];
}
export let aStarFailCount = 0;

export function aStarGrid(
  grid: Grid,
  start: { cx: number; cy: number },
  goal: { cx: number; cy: number },
  costCfg: CostConfig,
  startDir: Dir
): NodeRec[] | null {
  // [수정 1] 시작점 또는 도착점이 장애물에 막혀있는 경우, 즉시 실패 처리
  const startCell = cellAt(grid, start.cx, start.cy);
  const goalCell = cellAt(grid, goal.cx, goal.cy);
  if (!startCell || startCell.blocked || !goalCell || goalCell.blocked) {
    console.warn("A* FAILED: Start or Goal cell is on an obstacle.", {
      start,
      goal,
    });
    return null;
  }

  const openSet = new PriorityQueue<NodeRec>((a, b) => a.f - b.f);
  const key = (x: number, y: number) => `${x},${y}`;
  const allNodes = new Map<string, NodeRec>();
  const closed = new Set<string>();

  const h0 = hManhattan(start.cx, start.cy, goal.cx, goal.cy, 1);
  const startRec: NodeRec = { cx: start.cx, cy: start.cy, g: 0, f: h0 };

  openSet.push(startRec);
  allNodes.set(key(start.cx, start.cy), startRec);

  while (openSet.size > 0) {
    const cur = openSet.pop()!;
    const kcur = key(cur.cx, cur.cy);

    if (closed.has(kcur)) continue;

    if (cur.cx === goal.cx && cur.cy === goal.cy) {
      const path: NodeRec[] = [];
      let p: NodeRec | undefined = cur;
      while (p) {
        path.push(p);
        p = p.came;
      }
      return path.reverse();
    }
    closed.add(kcur);

    for (const nb of neighbors(cur.cx, cur.cy)) {
      const c = cellAt(grid, nb.cx, nb.cy);
      if (!c || c.blocked) continue; // 맵 경계 밖이거나 장애물이면 즉시 무시

      const k = key(nb.cx, nb.cy);
      if (closed.has(k)) continue;

      const turn = isTurn(cur.dir, nb.dir);
      let gNew =
        cur.g +
        costCfg.distance +
        (turn ? costCfg.bend : 0) +
        c.congestion * costCfg.congestion;

      // [수정] 장애물 셀 비용 부과 로직 완전 삭제

      if (!cur.came && nb.dir !== startDir) {
        gNew += costCfg.bend * 10;
      }

      const existingRec = allNodes.get(k);
      if (!existingRec || gNew < existingRec.g) {
        const h = hManhattan(nb.cx, nb.cy, goal.cx, goal.cy, 1);
        const newRec: NodeRec = {
          cx: nb.cx,
          cy: nb.cy,
          g: gNew,
          f: gNew + h,
          came: cur,
          dir: nb.dir,
        };
        allNodes.set(k, newRec);
        openSet.push(newRec);
      }
    }
  }
  return null;
}
