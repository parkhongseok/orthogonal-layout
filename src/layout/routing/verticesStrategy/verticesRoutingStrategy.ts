import type { Graph } from "@domain/types";
import type { RoutingStrategy } from "../strategy";
import { setLastRoutingVertices, setLastVisibilityGraph } from "@render/debug";

import { assignPorts } from "@layout/port/assign";
import { initialPlacement } from "@layout/placement/initPlacement";
import { resolveOverlap } from "@layout/placement/resolveOverlap";
import { spreadNodes } from "@layout/placement/spread";
import { sweepCompact } from "@layout/compaction/sweep";

import { buildVisibilityGraph, createRoutingVertices } from "./visibility";
import { routeOnVisibilityGraph } from "./router";
import { finalizePaths } from "./lane";
import { beautifyPath } from "@layout/port/beautifyPath";

export class VerticesRoutingStrategy implements RoutingStrategy {
  public execute(graph: Graph, cfg: any): Graph {
    let cur = graph;
    console.log("Executing: Bus Routing Strategy");

    // --- 1. 노드 위치 결정 단계 ---
    cur = initialPlacement(cur, cfg);
    cur = resolveOverlap(cur, cfg);
    // cur = spreadNodes(cur, cfg);
    cur = resolveOverlap(cur, cfg);
    cur = sweepCompact(cur, cfg);

    // --- 2단계: 라우팅을 위한 포트 할당 ---
    cur = assignPorts(cur, cfg);

    // --- 3단계: 가시성 그래프 네트워크 구축 ---
    const vertices = createRoutingVertices(cur, cfg);
    setLastRoutingVertices(vertices); // 디버깅: 정점 시각화
    // buildVisibilityGraph 호출 시 전체 그래프(cur)를 전달하도록 수정
    const visibilityGraph = buildVisibilityGraph(vertices, cur);
    setLastVisibilityGraph(visibilityGraph);

    cur = routeOnVisibilityGraph(cur, visibilityGraph, cfg);
    cur = finalizePaths(cur, visibilityGraph, cfg);
    return cur;
  }
}
