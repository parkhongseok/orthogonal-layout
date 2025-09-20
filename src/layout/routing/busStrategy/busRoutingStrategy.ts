import type { Graph } from "@domain/types";
import type { RoutingStrategy } from "../strategy";
import { createBusChannels } from "./channel";
import { setLastBusChannels } from "@render/debug";

export class BusRoutingStrategy implements RoutingStrategy {
  public execute(graph: Graph, cfg: any): Graph {
    console.log("Executing: Bus Routing Strategy");
    // --- Phase 1: 버스 네트워크(도로망) 구축 ---
    const channels = createBusChannels(graph, cfg);
    setLastBusChannels(channels);

    // TODO: Phase 2 - 생성된 채널을 이용해 엣지 라우팅하기
    return graph;
  }
}
