// 우선순위큐 사용을 통한 O(logN)으로 개선, 기존 배열 사용 시 O(N)

// src/layout/routing/aStar.ts

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

  // [수정 1] 시작점 또는 도착점이 장애물에 막혀있는 경우, 즉시 실패 처리합니다.
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
      if (!c) continue; // 맵 경계 밖이면 무시

      const k = key(nb.cx, nb.cy);
      if (closed.has(k)) continue;

      const turn = isTurn(cur.dir, nb.dir);
      let gNew =
        cur.g +
        costCfg.distance +
        (turn ? costCfg.bend : 0) +
        c.congestion * costCfg.congestion;

      // [수정 2] 장애물 셀을 완전히 무시하는 대신, 매우 높은 비용을 부과하여
      //           최후의 수단으로만 통과하도록 변경합니다.
      if (c.blocked) {
        gNew += costCfg.obstacle;
      }

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

// import { cellAt, Grid } from "./grid";
// import { CostConfig, hManhattan, isTurn } from "./cost";
// import { PriorityQueue } from "@utils/priorityQueue"; // Import the PriorityQueue
// import { Dir, NodeRec } from "@domain/types";

// function neighbors(cx: number, cy: number) {
//   return [
//     { cx: cx + 1, cy, dir: "R" as const },
//     { cx: cx - 1, cy, dir: "L" as const },
//     { cx, cy: cy + 1, dir: "D" as const },
//     { cx, cy: cy - 1, dir: "U" as const },
//   ];
// }

// export function aStarGrid(
//   grid: Grid,
//   start: { cx: number; cy: number },
//   goal: { cx: number; cy: number },
//   costCfg: CostConfig,
//   startDir: Dir // [추가] 시작 방향
// ): NodeRec[] | null {
//   // [MODIFIED] Use the PriorityQueue instead of a plain array
//   const openSet = new PriorityQueue<NodeRec>((a, b) => a.f - b.f);

//   const key = (x: number, y: number) => `${x},${y}`;
//   const allNodes = new Map<string, NodeRec>(); // Tracks nodes to check for better paths
//   const closed = new Set<string>();

//   const h0 = hManhattan(start.cx, start.cy, goal.cx, goal.cy, 1);
//   const startRec: NodeRec = { cx: start.cx, cy: start.cy, g: 0, f: h0 };

//   openSet.push(startRec);
//   allNodes.set(key(start.cx, start.cy), startRec);

//   // [MODIFIED] Loop condition and how the best node is retrieved
//   while (openSet.size > 0) {
//     const cur = openSet.pop()!;
//     const kcur = key(cur.cx, cur.cy);

//     if (closed.has(kcur)) continue; // Already found a better path to this node

//     if (cur.cx === goal.cx && cur.cy === goal.cy) {
//       const path: NodeRec[] = [];
//       let p: NodeRec | undefined = cur;
//       while (p) {
//         path.push(p);
//         p = p.came;
//       }
//       return path.reverse();
//     }
//     closed.add(kcur);

//     for (const nb of neighbors(cur.cx, cur.cy)) {
//       const c = cellAt(grid, nb.cx, nb.cy);
//       if (!c || c.blocked) continue;

//       const k = key(nb.cx, nb.cy);
//       if (closed.has(k)) continue;

//       const turn = isTurn(cur.dir, nb.dir);
//       let gNew =
//         cur.g +
//         1 * costCfg.distance +
//         (turn ? costCfg.bend : 0) +
//         c.congestion * costCfg.congestion;

//       // [핵심 수정] 첫 스텝일 경우, 지정된 방향이 아니면 큰 페널티를 부과
//       if (!cur.came) {
//         // cur이 시작 노드인가?
//         if (nb.dir !== startDir) {
//           gNew += costCfg.bend * 10; // 굴곡 비용의 10배 페널티
//         }
//       }

//       const existingRec = allNodes.get(k);
//       if (!existingRec || gNew < existingRec.g) {
//         const h = hManhattan(nb.cx, nb.cy, goal.cx, goal.cy, 1);
//         const newRec: NodeRec = {
//           cx: nb.cx,
//           cy: nb.cy,
//           g: gNew,
//           f: gNew + h,
//           came: cur,
//           dir: nb.dir,
//         };
//         allNodes.set(k, newRec);
//         openSet.push(newRec);
//       }
//     }
//   }
//   return null;
// }

// // src/layout/routing/aStar.ts
// import { cellAt, Grid } from "./grid";
// import { CostConfig, dirFrom, hManhattan, isTurn, stepCost, Dir } from "./cost";

// interface NodeRec {
//   cx: number; cy: number;
//   g: number;                // 누적 비용
//   f: number;                // g + h
//   came?: NodeRec;
//   dir?: Dir;                // 이전에서 이 노드로 들어온 방향
// }

// function neighbors(cx: number, cy: number) {
//   return [
//     { cx: cx + 1, cy,    dir: "R" as const },
//     { cx: cx - 1, cy,    dir: "L" as const },
//     { cx,     cy: cy+1,  dir: "D" as const },
//     { cx,     cy: cy-1,  dir: "U" as const },
//   ];
// }

// /** 간단한 A*: 격자 4방향, 장애물/혼잡/코너 비용 반영 */
// export function aStarGrid(
//   grid: Grid,
//   start: { cx: number; cy: number },
//   goal:  { cx: number; cy: number },
//   costCfg: CostConfig
// ): NodeRec[] | null {
//   const open: NodeRec[] = [];
//   const key = (x: number, y: number) => `${x},${y}`;
//   const openMap = new Map<string, NodeRec>();
//   const closed = new Set<string>();

//   const h0 = hManhattan(start.cx, start.cy, goal.cx, goal.cy, 1);
//   const startRec: NodeRec = { cx: start.cx, cy: start.cy, g: 0, f: h0 };
//   open.push(startRec);
//   openMap.set(key(start.cx, start.cy), startRec);

//   const popBest = () => {
//     // 작은 힙 대신 간단히 O(n) 탐색
//     let bestIdx = 0;
//     for (let i=1;i<open.length;i++) if (open[i].f < open[bestIdx].f) bestIdx = i;
//     const n = open.splice(bestIdx,1)[0];
//     openMap.delete(key(n.cx, n.cy));
//     return n;
//   };

//   while (open.length) {
//     const cur = popBest();
//     const kcur = key(cur.cx, cur.cy);
//     if (cur.cx === goal.cx && cur.cy === goal.cy) {
//       // 경로 복원
//       const path: NodeRec[] = [];
//       let p: NodeRec | undefined = cur;
//       while (p) { path.push(p); p = p.came; }
//       return path.reverse();
//     }
//     closed.add(kcur);

//     for (const nb of neighbors(cur.cx, cur.cy)) {
//       const c = cellAt(grid, nb.cx, nb.cy);
//       if (!c) continue;            // 범위 밖
//       if (c.blocked) continue;     // 통과 불가(필요시 큰 페널티로 열어둘 수도)

//       const k = key(nb.cx, nb.cy);
//       if (closed.has(k)) continue;

//       const turn = isTurn(cur.dir, nb.dir);
//       const gNew = cur.g + stepCost(
//         costCfg,
//         1,               // 한 스텝 거리
//         turn,
//         false,           // 장애물 진입은 금지해버렸으므로 false
//         c.congestion
//       );
//       let rec = openMap.get(k);
//       if (!rec || gNew < rec.g) {
//         const h = hManhattan(nb.cx, nb.cy, goal.cx, goal.cy, 1);
//         rec = { cx: nb.cx, cy: nb.cy, g: gNew, f: gNew + h, came: cur, dir: nb.dir };
//         openMap.set(k, rec);
//         // 이미 존재하면 값만 갱신된 상태 — push 중복을 막으려면 검사
//         if (!open.find(o => o.cx === rec!.cx && o.cy === rec!.cy)) open.push(rec);
//       }
//     }
//   }
//   return null;
// }
