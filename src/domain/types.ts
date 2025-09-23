export type NodeId = string & { readonly brand: unique symbol };
export type EdgeId = string & { readonly brand: unique symbol };
export type GroupId = string & { readonly brand: unique symbol };
export type BusChannelId = string & { readonly brand: unique symbol };
export type Dir = "U" | "D" | "L" | "R";

export interface Point {
  x: number;
  y: number;
}
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
export type PortSide = "top" | "bottom" | "left" | "right";

export interface Node {
  id: NodeId;
  bbox: Rect;
  groupId?: GroupId;
  ports?: ReadonlyArray<{ side: PortSide; offset: number }>;
}

export interface Group {
  id: GroupId;
  bbox: Rect;
  children: ReadonlyArray<NodeId>;
}

export interface Edge {
  id: EdgeId;
  sourceId: NodeId;
  targetId: NodeId;
  path?: ReadonlyArray<Point>;
  vertexPath?: ReadonlyArray<number>;
}

export interface Graph {
  nodes: Map<NodeId, Node>;
  edges: Map<EdgeId, Edge>;
  groups: Map<GroupId, Group>;
}

export interface NodeRec {
  cx: number;
  cy: number;
  g: number;
  f: number;
  came?: NodeRec;
  dir?: Dir;
}

export interface BusChannel {
  id: BusChannelId;
  geometry: Rect; // 채널이 차지하는 사각형 영역
  direction: "horizontal" | "vertical";
  lanes: Map<EdgeId, number>;
  level?: number; // << 0: 간선도로, 1: 지역도로
  cost?: number; // << 이 채널을 통과하는 라우팅 비용
}

export interface BusNetwork {
  channels: Map<string, BusChannel>;
  // 교차점을 그래프의 엣지처럼 표현 <채널 ID, [연결된 채널 ID들]>
  intersections: Map<string, string[]>;
}

// --- 가시성 그래프를 위한 타입 추가 ---
export interface VisibilityGraph {
  vertices: RoutingVertex[];
  // 인접 리스트: 각 정점(인덱스)에서 연결된 다른 정점들의 인덱스 목록
  adjacency: Map<number, number[]>;
  // 간선 사용량: 두 정점을 잇는 간선이 몇 번 사용되었는지 기록 (e.g., "0-1")
  edgeUsage: Map<string, number>;
}

export interface RoutingVertex extends Point {
  id: number; // 고유 ID (배열 인덱스)
  owner?: GroupId; // 이 정점이 속한 그룹의 ID (최상위 레벨은 undefined)
}
