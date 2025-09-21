import type { Graph } from "@domain/types";
import type { RoutingStrategy } from "../strategy";
import { createBusChannels } from "./channel";
import { buildBusNetworkGraph } from "./network";
import { routeEdgesOnBus } from "./router";
import { assignPorts } from "@layout/port/assign";
import { initialPlacement } from "@layout/placement/initPlacement";
import { resolveOverlap } from "@layout/placement/resolveOverlap";
import { spreadNodes } from "@layout/placement/spread";
import { sweepCompact } from "@layout/compaction/sweep";
import { beautifyPath } from "@layout/port/beautifyPath";
import { routeAll } from "../aStarStrategy/routeAll"; // A* 라우터를 import
import { setLastBusChannels, fallbackEdgeIds } from "@render/debug";

export class BusRoutingStrategy implements RoutingStrategy {
  public execute(graph: Graph, cfg: any): Graph {
    console.log("Executing: Hybrid Bus Routing Strategy (Foundation Stage)");

    // --- 1. 노드 위치 결정 단계 ---
    let cur = graph;
    cur = initialPlacement(cur, cfg);
    cur = resolveOverlap(cur, cfg);
    cur = spreadNodes(cur, cfg);
    cur = sweepCompact(cur, cfg);

    // --- 2. 라우팅을 위한 포트 할당 ---
    cur = assignPorts(cur, cfg);

    // --- 3. Bus 채널 생성 및 1차 라우팅 시도 ---
    const channels = createBusChannels(cur, cfg);
    setLastBusChannels(channels);
    const network = buildBusNetworkGraph(channels);
    cur = routeEdgesOnBus(cur, network, cfg); // 현재의 실패율 높은 라우터로 일단 실행

    // --- 4. [핵심] Fallback: 실패한 엣지를 A*로 재라우팅 ---
    fallbackEdgeIds.clear(); // 디버그용 Set 초기화
    const failedEdges = Array.from(cur.edges.values()).filter(
      (e) => !e.path || e.path.length <= 2 // 경로가 없거나, 비상용 직선 경로일 경우 실패로 간주
    );

    if (failedEdges.length > 0) {
      console.warn(
        `Bus routing failed for ${failedEdges.length} edges. Running fallback A*...`
      );

      // 실패한 엣지만으로 구성된 임시 그래프 생성
      const fallbackGraph: Graph = {
        ...cur, // 노드, 그룹 정보는 그대로 사용
        edges: new Map(failedEdges.map((e) => [e.id, e])),
      };

      // A* 라우터를 실패한 엣지에 대해서만 실행
      const reroutedGraph = routeAll(fallbackGraph, cfg);

      // A*로 새로 생성된 경로를 원래 그래프에 다시 합침
      for (const reroutedEdge of reroutedGraph.edges.values()) {
        cur.edges.set(reroutedEdge.id, reroutedEdge);
        fallbackEdgeIds.add(reroutedEdge.id); // 디버깅을 위해 ID 기록
      }
    }

    // --- 5. 최종 경로 다듬기 ---
    cur = beautifyPath(cur, cfg);

    return cur;
  }
}
