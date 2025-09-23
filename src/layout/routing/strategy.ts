import type { Graph } from "@domain/types";

export interface RoutingStrategy {
  execute(graph: Graph, cfg: any): Graph;
}
