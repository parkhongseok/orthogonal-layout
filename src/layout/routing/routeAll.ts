// src/layout/routing/routeAll.ts
import type { Graph, Node, PortSide, Point } from "@domain/types";
import { buildGrid, worldToCell, cellCenterToWorld, Grid } from "./grid";
import { aStarGrid } from "./aStar";
import type { CostConfig } from "./cost";
import { portPosition } from "@layout/port/assign";

type Side = PortSide;

function center(n: Node) {
  return { x: n.bbox.x + n.bbox.w / 2, y: n.bbox.y + n.bbox.h / 2 };
}

function chooseSide(a: Node, b: Node): Side {
  const ca = center(a), cb = center(b);
  const dx = cb.x - ca.x, dy = cb.y - ca.y;
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? "right" : "left";
  return dy >= 0 ? "bottom" : "top";
}

function pickPort(n: Node, side: Side, other: Node) {
  const ports = (n.ports || []).filter(p => p.side === side);
  if (!ports.length) return { pos: center(n), idx: -1 };
  // 투영 좌표 기준 가장 가까운 포트
  const o = center(other);
  const scored = ports.map((p, i) => {
    const pos = portPosition(n, side, p.offset);
    const key = (side === "top" || side === "bottom") ? pos.x : pos.y;
    const tgt = (side === "top" || side === "bottom") ? o.x : o.y;
    return { i, pos, d: Math.abs(key - tgt) };
  }).sort((a,b) => a.d - b.d);
  return { pos: scored[0].pos, idx: scored[0].i };
}

export function routeAll(g: Graph, cfg: any): Graph {
  const out: Graph = {
    nodes: new Map(g.nodes),
    edges: new Map(g.edges),
    groups: new Map(g.groups),
  };

  const grid: Grid = buildGrid(out, cfg);
  const costCfg = cfg?.cost as CostConfig;

  for (const [, e] of out.edges) {
    const s = out.nodes.get(e.sourceId)!;
    const t = out.nodes.get(e.targetId)!;

    // 1) 면/포트 선택
    const sSide = chooseSide(s, t);
    const tSide = chooseSide(t, s);
    const sPort = pickPort(s, sSide, t);
    const tPort = pickPort(t, tSide, s);

    // 2) A* 실행 (월드→셀)
    const start = worldToCell(grid, sPort.pos.x, sPort.pos.y);
    const goal  = worldToCell(grid, tPort.pos.x, tPort.pos.y);
    const nodes = aStarGrid(grid, start, goal, costCfg);

    // 3) 경로 복원 (셀→월드 중심, 첫/마지막은 정확히 포트 좌표로 보정)
    let path: Point[] = [];
    if (nodes && nodes.length) {
      path = nodes.map(n => {
        const p = cellCenterToWorld(grid, n.cx, n.cy);
        return { x: p.x, y: p.y };
      });
      // 보정
      if (path.length) {
        path[0] = { x: sPort.pos.x, y: sPort.pos.y };
        path[path.length - 1] = { x: tPort.pos.x, y: tPort.pos.y };
      }
    } else {
      // A* 실패 시 간단한 L-자 폴백(선택)
      path = [
        { x: sPort.pos.x, y: sPort.pos.y },
        { x: tPort.pos.x, y: sPort.pos.y },
        { x: tPort.pos.x, y: tPort.pos.y },
      ];
    }

    out.edges.set(e.id, { ...e, path });
  }

  return out;
}
