import type { Graph } from "@domain/types";
import type { RoutingStrategy } from "../strategy";
import { fallbackEdgeIds, setLastBusChannels } from "@render/debug";
import { assignPorts } from "@layout/port/assign";
import { initialPlacement } from "@layout/placement/initPlacement";
import { resolveOverlap } from "@layout/placement/resolveOverlap";
import { sweepCompact } from "@layout/compaction/sweep";
import { routeAll } from "../aStarStrategy/routeAll";
import { routeEdgesOnBus } from "./routerBus";
import { buildBusNetworkGraph } from "./network";
import { beautifyPath } from "@layout/port/beautifyPath";
import { createBusChannels } from "./channel";
import { Profiler } from "../../../../scripts/profiler";

export class BusRoutingStrategy implements RoutingStrategy {
  public execute(graph: Graph, cfg: any, profiler: Profiler): Graph {
    let cur = graph;
    console.log("Executing: Bus Routing Strategy");

    // --- 1. 노드 위치 결정 단계 ---
    profiler.start("Placement");
    cur = initialPlacement(cur, cfg);
    cur = resolveOverlap(cur, cfg);
    // cur = spreadNodes(cur, cfg);
    cur = sweepCompact(cur, cfg);
    cur = assignPorts(cur, cfg);
    profiler.stop("Placement");

    // --- 2-1단계: 버스 채널 생성 및 라우팅 ---
    profiler.start("Routing");
    profiler.start("createBusChannels");
    const channels = createBusChannels(cur, cfg);
    setLastBusChannels(channels);
    profiler.stop("createBusChannels");
    // 채널을 탐색 가능한 네트워크 그래프로 변환
    profiler.start("buildBusNetworkGraph");
    const network = buildBusNetworkGraph(channels);
    profiler.stop("buildBusNetworkGraph");

    cur = routeEdgesOnBus(cur, network, cfg, profiler);

    // --- 2-2단계: 하이브리드 라우팅 (Fallback) ---
    profiler.start("Routing Fallback");
    const failedEdges = Array.from(cur.edges.values()).filter(
      (e) => !e.path || e.path.length <= 1
    );

    if (failedEdges.length > 0) {
      console.warn(
        `Bus routing failed for ${failedEdges.length} edges. Running fallback A*...`
      );
      // 실패한 엣지들만으로 구성된 임시 그래프 생성
      const fallbackGraph: Graph = {
        ...cur,
        edges: new Map(failedEdges.map((e) => [e.id, e])),
      };

      // A* 라우팅을 실패한 엣지에 대해서만 실행

      const reroutedGraph = routeAll(fallbackGraph, cfg, profiler);

      // 결과를 원래 그래프에 다시 병합
      for (const reroutedEdge of reroutedGraph.edges.values()) {
        cur.edges.set(reroutedEdge.id, reroutedEdge);
        fallbackEdgeIds.add(reroutedEdge.id); // 디버깅을 위해 ID 기록
      }
    }
    profiler.stop("Routing Fallback");
    profiler.stop("Routing");
    
    // --- 3단계: 최종 경로 다듬기 ---
    profiler.start("Post-Process");
    // cur = separatedPaths(cur, lastVisibilityGraph, cfg);
    cur = beautifyPath(cur, cfg);
    profiler.stop("Post-Process");

    return cur;
  }
}
