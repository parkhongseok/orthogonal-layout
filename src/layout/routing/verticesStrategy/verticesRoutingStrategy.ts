import type { Graph } from "@domain/types";
import type { RoutingStrategy } from "../strategy";
import { setLastRoutingVertices, setLastVisibilityGraph } from "@render/debug";
import { assignPorts } from "@layout/port/assign";
import { initialPlacement } from "@layout/placement/initPlacement";
import { resolveOverlap } from "@layout/placement/resolveOverlap";
import { sweepCompact } from "@layout/compaction/sweep";
import { buildVisibilityGraph, createRoutingVertices } from "./visibility";
import { routeOnVisibilityGraph } from "./router";
import { finalizePaths } from "./lane";
import { Profiler } from "../../../../scripts/profiler";

export class VerticesRoutingStrategy implements RoutingStrategy {
  public execute(graph: Graph, cfg: any, profiler: Profiler): Graph {
    let cur = graph;
    console.log("Executing: Bus Routing Strategy");

    // --- 1. 노드 위치 결정 단계 ---
    profiler.start("L1-Placement");
    cur = initialPlacement(cur, cfg);
    cur = resolveOverlap(cur, cfg);
    // cur = spreadNodes(cur, cfg);
    cur = sweepCompact(cur, cfg);
    cur = assignPorts(cur, cfg);
    profiler.stop("L1-Placement");

    // --- 2단계: 가시성 그래프 네트워크 구축 및 라우팅 ---
    profiler.start("L1-Routing");
    profiler.start("createRoutingVertices");
    const vertices = createRoutingVertices(cur, cfg);
    setLastRoutingVertices(vertices); // 디버깅: 정점 시각화
    profiler.stop("createRoutingVertices");

    // buildVisibilityGraph 호출 시 전체 그래프(cur)를 전달하도록 수정
    profiler.start("buildVisibilityGraph");
    const visibilityGraph = buildVisibilityGraph(vertices, cur);
    setLastVisibilityGraph(visibilityGraph);
    profiler.stop("buildVisibilityGraph");
    // 내부 모듈별 측정 세분화 
    cur = routeOnVisibilityGraph(cur, visibilityGraph, cfg, profiler);
    profiler.stop("L1-Routing");

    // --- 3단계: 최종 경로 다듬기 ---
    profiler.start("L1-Post-Process");
    cur = finalizePaths(cur, visibilityGraph, cfg);
    profiler.stop("L1-Post-Process");

    return cur;
  }
}
