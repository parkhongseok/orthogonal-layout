import type { Graph } from "@domain/types";
import { initialPlacement } from "@layout/placement/initPlacement";
import { resolveOverlap } from "@layout/placement/resolveOverlap";
import { spreadNodes } from "@layout/placement/spread";
import { assignPorts } from "@layout/port/assign";
import { sweepCompact } from "@layout/compaction/sweep";
import { routeAll } from "./routing/aStarStrategy/routeAll";
import { RoutingStrategy } from "./routing/strategy";

export function autoLayoutPipeline(
  g: Graph,
  cfg: any,
  strategy: RoutingStrategy
): Graph {
  let cur = g;
  // --- 1. 노드 위치 결정 단계 ---
  cur = initialPlacement(cur, cfg);
  cur = resolveOverlap(cur, cfg);
  cur = spreadNodes(cur, cfg);
  cur = assignPorts(cur, cfg);
  cur = sweepCompact(cur, cfg);

  cur = strategy.execute(cur, cfg);
  return cur;
}
