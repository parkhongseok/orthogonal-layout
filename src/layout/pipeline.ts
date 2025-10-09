import type { Graph } from "@domain/types";
import { RoutingStrategy } from "./routing/strategy";
import { Profiler } from "../../scripts/profiler";

export function autoLayoutPipeline(
  g: Graph,
  cfg: any,
  strategy: RoutingStrategy,
  profiler: Profiler
): Graph {
  let cur = g;
  cur = strategy.execute(cur, cfg, profiler);
  return cur;
}
