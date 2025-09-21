// src/layout/routing/aStarStrategy/legacyAStarStrategy.ts
import type { Graph } from "@domain/types";
import { assignPorts } from "@layout/port/assign";
import type { RoutingStrategy } from "../strategy"; // 한 단계 상위의 strategy.ts
import { routeAll } from "./routeAll"; // 같은 디렉터리 내의 routeAll.ts
import { initialPlacement } from "@layout/placement/initPlacement";
import { resolveOverlap } from "@layout/placement/resolveOverlap";
import { spreadNodes } from "@layout/placement/spread";
import { sweepCompact } from "@layout/compaction/sweep";
import { beautifyPath } from "@layout/port/beautifyPath";

export class LegacyAStarStrategy implements RoutingStrategy {
  public execute(graph: Graph, cfg: any): Graph {
    console.log("Executing: Legacy A* Strategy");
    let cur = graph;
    // --- 1. 노드 위치 결정 단계 ---
    cur = initialPlacement(cur, cfg);
    cur = resolveOverlap(cur, cfg);
    cur = spreadNodes(cur, cfg);
    cur = sweepCompact(cur, cfg);

    // --- 2단계: 라우팅을 위한 포트 할당 ---
    cur = assignPorts(cur, cfg);

    // --- 3단계: 라우팅 ---
    cur = routeAll(cur, cfg);

    // --- 4단계: 최종 경로 다듬기 ---
    cur = beautifyPath(cur, cfg);
    return cur;
  }
}
