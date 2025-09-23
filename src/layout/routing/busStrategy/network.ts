import type { Graph, BusChannel, BusNetwork, Rect } from "@domain/types";

/**
 * 채널 목록을 분석하여, 채널 간 교차점을 포함한 BusNetwork 그래프를 생성
 */
export function buildBusNetworkGraph(channels: BusChannel[]): BusNetwork {
  const network: BusNetwork = {
    channels: new Map(channels.map(c => [c.id, c])),
    intersections: new Map(),
  };

  for (const ch of channels) {
    network.intersections.set(ch.id, []);
  }

  for (let i = 0; i < channels.length; i++) {
    for (let j = i + 1; j < channels.length; j++) {
      const ch1 = channels[i];
      const ch2 = channels[j];

      // 서로 다른 방향의 채널만 교차 가능
      if (ch1.direction !== ch2.direction && intersects(ch1.geometry, ch2.geometry)) {
        network.intersections.get(ch1.id)!.push(ch2.id);
        network.intersections.get(ch2.id)!.push(ch1.id);
      }
    }
  }
  return network;
}

function intersects(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}