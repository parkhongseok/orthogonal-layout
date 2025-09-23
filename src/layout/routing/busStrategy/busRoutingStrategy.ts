import type { Graph, Point, VisibilityGraph } from "@domain/types";
import type { RoutingStrategy } from "../strategy";
import { createBusChannels } from "./channel";
import {
  fallbackEdgeIds,
  lastVisibilityGraph,
  setLastBusChannels,
  setLastRoutingVertices,
  setLastVisibilityGraph,
} from "@render/debug";

import { assignPorts } from "@layout/port/assign";
import { initialPlacement } from "@layout/placement/initPlacement";
import { resolveOverlap } from "@layout/placement/resolveOverlap";
import { spreadNodes } from "@layout/placement/spread";
import { sweepCompact } from "@layout/compaction/sweep";

import { buildVisibilityGraph, createRoutingVertices } from "./visibility";
import { routeOnVisibilityGraph } from "./router";
import { finalizePaths } from "./lane";

export class BusRoutingStrategy implements RoutingStrategy {
  public execute(graph: Graph, cfg: any): Graph {
    let cur = graph;
    console.log("Executing: Bus Routing Strategy");

    // --- 1. 노드 위치 결정 단계 ---
    cur = initialPlacement(cur, cfg);
    cur = resolveOverlap(cur, cfg);
    cur = spreadNodes(cur, cfg);
    cur = resolveOverlap(cur, cfg);
    cur = sweepCompact(cur, cfg);

    // --- 2단계: 라우팅을 위한 포트 할당 ---
    cur = assignPorts(cur, cfg);

    // --- 💡 3단계: 가시성 그래프 네트워크 구축 ---
    const vertices = createRoutingVertices(cur, cfg);
    setLastRoutingVertices(vertices); // 디버깅: 정점 시각화
    // 💡 buildVisibilityGraph 호출 시 전체 그래프(cur)를 전달하도록 수정
    const visibilityGraph = buildVisibilityGraph(vertices, cur);
    setLastVisibilityGraph(visibilityGraph);

    cur = routeOnVisibilityGraph(cur, visibilityGraph, cfg);
    cur = finalizePaths(cur, visibilityGraph, cfg);
    // // --- 3단계: 버스 채널 생성 및 라우팅 ---
    // const channels = createBusChannels(cur, cfg);
    // setLastBusChannels(channels);
    // // 채널을 탐색 가능한 네트워크 그래프로 변환
    // const network = buildBusNetworkGraph(channels);
    // cur = routeEdgesOnBus(cur, network, cfg);

    // // --- 4단계: 하이브리드 라우팅 (Fallback) ---
    // const failedEdges = Array.from(cur.edges.values()).filter(
    //   (e) => !e.path || e.path.length <= 1
    // );

    // if (failedEdges.length > 0) {
    //   console.warn(
    //     `Bus routing failed for ${failedEdges.length} edges. Running fallback A*...`
    //   );
    //   // 실패한 엣지들만으로 구성된 임시 그래프를 만듭니다.
    //   const fallbackGraph: Graph = {
    //     ...cur,
    //     edges: new Map(failedEdges.map((e) => [e.id, e])),
    //   };

    //   // A* 라우팅을 실패한 엣지에 대해서만 실행합니다.
    //   const reroutedGraph = routeAll(fallbackGraph, cfg);

    //   // 결과를 원래 그래프에 다시 합칩니다.
    //   for (const reroutedEdge of reroutedGraph.edges.values()) {
    //     cur.edges.set(reroutedEdge.id, reroutedEdge);
    //     fallbackEdgeIds.add(reroutedEdge.id); // 디버깅을 위해 ID 기록
    //   }
    // }

    // --- 5단계: 최종 경로 다듬기 ---
    // cur = separatedPaths(cur, lastVisibilityGraph, cfg);
    // cur = beautifyPath(cur, cfg);
    return cur;
  }
}


