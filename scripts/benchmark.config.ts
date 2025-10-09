import { LegacyAStarStrategy } from "../src/layout/routing/aStarStrategy/legacyAStarStrategy";
import { BusRoutingStrategy } from "../src/layout/routing/busStrategy/busRoutingStrategy";
import { VerticesRoutingStrategy } from "../src/layout/routing/verticesStrategy/verticesRoutingStrategy";
import { RoutingStrategy } from "../src/layout/routing/strategy";

/**
 * 벤치마크에 사용할 테스트 시나리오를 정의
 * 점진적으로 확장할 수 있도록 초기에 몇 가지 대표적인 시나리오를 포함
 */
export const SCENARIOS = [
  { name: 'Small', nodes: 12, edges: 18, groups: 2 },
  { name: 'Medium', nodes: 60, edges: 90, groups: 3 },
  { name: 'Large (Standard)', nodes: 120, edges: 180, groups: 4 },
  // { name: 'High-Density', nodes: 60, edges: 180, groups: 3 }, // 추후 확장용
  // { name: 'Many-Groups', nodes: 120, edges: 180, groups: 10 }, // 추후 확장용
];

/**
 * 멱등성을 보장하기 위해 사용할 랜덤 시드(seed) 목록
 * 동일한 시드는 항상 동일한 그래프를 생성
 */
export const SEEDS = [42, 101, 256, 888, 1337];

/**
 * 벤치마크를 수행할 라우팅 전략의 목록
 * 새로운 전략을 추가하거나 제외하기 용이하도록 Map 형태로 관리
 */
export const STRATEGIES: Map<string, RoutingStrategy> = new Map([
  ['A-Star', new LegacyAStarStrategy()],
  ['Bus-Channel', new BusRoutingStrategy()],
  ['Vertices-Network', new VerticesRoutingStrategy()],
]);