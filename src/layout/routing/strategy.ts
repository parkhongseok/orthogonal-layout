import type { Graph } from "@domain/types";
import { Profiler } from "../../../scripts/profiler";

export interface RoutingStrategy {
  execute(graph: Graph, cfg: any, profiler?: Profiler): Graph;
}
