import type { Graph } from '@domain/types';
import { initialPlacement } from '@layout/placement/initPlacement';
import { resolveOverlap } from '@layout/placement/resolveOverlap';
import { assignPorts } from '@layout/port/assign';
import { spreadPorts } from '@layout/port/spread';
import { routeAll } from '@layout/routing/routeAll';
import { sweepCompact } from '@layout/compaction/sweep';

export function autoLayoutPipeline(g: Graph, cfg: any): Graph {
  let cur = g;
  cur = initialPlacement(cur, cfg);
  cur = resolveOverlap(cur, cfg);
  cur = assignPorts(cur, cfg);
  cur = spreadPorts(cur, cfg);
  cur = routeAll(cur, cfg);
  cur = sweepCompact(cur, cfg);
  return cur;
}
