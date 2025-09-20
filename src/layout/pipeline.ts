import type { Graph } from "@domain/types";
import { initialPlacement } from "@layout/placement/initPlacement";
import { resolveOverlap } from "@layout/placement/resolveOverlap";
import { spreadNodes } from "@layout/placement/spread";
import { assignPorts } from "@layout/port/assign";
import { spreadPorts } from "@layout/port/spread";
import { routeAll } from "@layout/routing/routeAll";
import { sweepCompact } from "@layout/compaction/sweep";

export function autoLayoutPipeline(g: Graph, cfg: any): Graph {
  let cur = g;
  cur = initialPlacement(cur, cfg);
  cur = resolveOverlap(cur, cfg);
  cur = spreadNodes(cur, cfg);
  cur = assignPorts(cur, cfg);
  // cur = spreadPorts(cur, cfg);
  cur = sweepCompact(cur, cfg);
  cur = routeAll(cur, cfg);
  return cur;
}
