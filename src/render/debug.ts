import type { Grid } from "@layout/routing/aStarStrategy/grid";
import type { BusChannel, EdgeId, Point, VisibilityGraph } from "@domain/types";

// A* 전략의 장애물 그리드
export let lastBuiltGrid: Grid | null = null;

// 버스 전략의 채널 네트워크
export let lastBusChannels: BusChannel[] | null = null;

// [신규] Bus 라우팅 실패 후 A*로 대체된 엣지 ID 목록
export const fallbackEdgeIds = new Set<EdgeId>();
// 새로운 방식 버스 라우팅 (정점 기반)
export let lastRoutingVertices: Point[] | null = null;
export let lastVisibilityGraph: VisibilityGraph | null = null;

/**
 * 모든 디버깅 데이터를 초기화하는 함수
 */
export function clearDebugData() {
  lastBuiltGrid = null;
  lastBusChannels = null;
  lastVisibilityGraph = null;
  lastRoutingVertices = null; // 누락된 부분 추가
  fallbackEdgeIds.clear();
}

/**
 * A* 그리드 값을 설정하는 함수
 */
export function setLastBuiltGrid(grid: Grid | null) {
  lastBuiltGrid = grid;
}

/**
 * 버스 채널 값을 설정하는 함수
 */
export function setLastBusChannels(channels: BusChannel[] | null) {
  lastBusChannels = channels;
}

export function setLastRoutingVertices(vertices: Point[] | null) {
  lastRoutingVertices = vertices;
}

//  함수 추가
export function setLastVisibilityGraph(graph: VisibilityGraph | null) {
  lastVisibilityGraph = graph;
}