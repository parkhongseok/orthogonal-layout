import type { Graph } from "@domain/types";
import { assignPorts } from "@layout/port/assign";
import type { RoutingStrategy } from "../strategy"; // 한 단계 상위의 strategy.ts
import { routeAll } from "./routeAll"; // 같은 디렉터리 내의 routeAll.ts
import { initialPlacement } from "@layout/placement/initPlacement";
import { resolveOverlap } from "@layout/placement/resolveOverlap";
import { sweepCompact } from "@layout/compaction/sweep";
import { beautifyPath } from "@layout/port/beautifyPath";
import { Profiler } from "../../../../scripts/profiler";

export class LegacyAStarStrategy implements RoutingStrategy {
  public execute(graph: Graph, cfg: any, profiler: Profiler): Graph {
    console.log("Executing: Legacy A* Strategy");
    let cur = graph;
    // --- 1. 노드 위치 결정 단계 ---
    profiler.start("L1-Placement");
    cur = initialPlacement(cur, cfg);
    // cur = spreadNodes(cur, cfg);
    cur = resolveOverlap(cur, cfg);
    cur = sweepCompact(cur, cfg);
    cur = assignPorts(cur, cfg);
    profiler.stop("L1-Placement");

    // --- 2단계: 라우팅 ---
    profiler.start("L1-Routing");
    cur = routeAll(cur, cfg, profiler);
    profiler.stop("L1-Routing");

    // --- 3단계: 최종 경로 다듬기 ---
    profiler.start("L1-Post-Process");
    cur = beautifyPath(cur, cfg);
    profiler.stop("L1-Post-Process");

    return cur;
  }
}
