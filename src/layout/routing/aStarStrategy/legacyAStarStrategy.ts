// src/layout/routing/aStarStrategy/legacyAStarStrategy.ts
import type { Graph } from "@domain/types";
import { assignPorts } from "@layout/port/assign";
import type { RoutingStrategy } from "../strategy"; // 한 단계 상위의 strategy.ts
import { routeAll } from "./routeAll"; // 같은 디렉터리 내의 routeAll.ts
import { initialPlacement } from "@layout/placement/initPlacement";
import { resolveOverlap } from "@layout/placement/resolveOverlap";
import { spreadNodes } from "@layout/placement/spread";
import { sweepCompact } from "@layout/compaction/sweep";

export class LegacyAStarStrategy implements RoutingStrategy {
  public execute(graph: Graph, cfg: any): Graph {
    console.log("Executing: Legacy A* Strategy");
    let cur = graph;
    cur = assignPorts(cur, cfg);
    cur = routeAll(cur, cfg);
    return cur;
  }
}
