import type { Graph } from "@domain/types";
import { RoutingStrategy } from "./routing/strategy";

export function autoLayoutPipeline(
  g: Graph,
  cfg: any,
  strategy: RoutingStrategy
): Graph {
  let cur = g;
  cur = strategy.execute(cur, cfg);
  return cur;
}
