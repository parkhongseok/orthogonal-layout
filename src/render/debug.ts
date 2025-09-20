import type { Grid } from "@layout/routing/aStarStrategy/grid";
import type { BusChannel } from "@domain/types";

// A* 전략의 장애물 그리드
export let lastBuiltGrid: Grid | null = null;

// 버스 전략의 채널 네트워크
export let lastBusChannels: BusChannel[] | null = null;

// 모든 디버깅 데이터를 초기화하는 함수
export function clearDebugData() {
  lastBuiltGrid = null;
  lastBusChannels = null;
}

//  A* 그리드 값을 설정하는 함수
export function setLastBuiltGrid(grid: Grid | null) {
  lastBuiltGrid = grid;
}

// 버스 채널 값을 설정하는 함수
export function setLastBusChannels(channels: BusChannel[] | null) {
  lastBusChannels = channels;
}
