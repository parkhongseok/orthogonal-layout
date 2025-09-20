import type { Graph } from "@domain/types";
import type { RoutingStrategy } from "../strategy";

export class BusRoutingStrategy implements RoutingStrategy {
  public execute(graph: Graph, cfg: any): Graph {
    console.log("Executing: Bus Routing Strategy (Not implemented yet)");
    // TODO: 버스 채널 생성 및 라우팅 로직 구현
    return graph;
  }
}
