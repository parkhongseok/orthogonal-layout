import type { Graph } from "@domain/types";
import type { RoutingStrategy } from "../strategy";
import { createBusChannels } from "./channel";
import { setLastBusChannels } from "@render/debug";
import { buildBusNetworkGraph } from "./network";
import { routeEdgesOnBus } from "./router";
import { assignPorts } from "@layout/port/assign";
import { initialPlacement } from "@layout/placement/initPlacement";
import { resolveOverlap } from "@layout/placement/resolveOverlap";
import { spreadNodes } from "@layout/placement/spread";
import { sweepCompact } from "@layout/compaction/sweep";
import { beautifyPath } from "@layout/port/beautifyPath";

export class BusRoutingStrategy implements RoutingStrategy {
  public execute(graph: Graph, cfg: any): Graph {
    let cur = graph;
    console.log("Executing: Bus Routing Strategy");

    // --- 1. 노드 위치 결정 단계 ---
    cur = initialPlacement(cur, cfg);
    cur = resolveOverlap(cur, cfg);
    cur = spreadNodes(cur, cfg);
    cur = sweepCompact(cur, cfg);

    // --- 2단계: 라우팅을 위한 포트 할당 ---
    cur = assignPorts(cur, cfg);

    // --- 3단계: 버스 채널 생성 및 라우팅 ---
    const channels = createBusChannels(cur, cfg);
    setLastBusChannels(channels);
    // 채널을 탐색 가능한 네트워크 그래프로 변환
    const network = buildBusNetworkGraph(channels);

    //  네트워크를 이용해 모든 엣지 라우팅
    cur = routeEdgesOnBus(cur, network, cfg);
    cur = beautifyPath(cur, cfg);
    return cur;
  }
}
