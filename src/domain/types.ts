export type NodeId = string & { readonly brand: unique symbol };
export type EdgeId = string & { readonly brand: unique symbol };
export type GroupId = string & { readonly brand: unique symbol };
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
  id: string;
  geometry: Rect; // 채널이 차지하는 사각형 영역
  direction: 'horizontal' | 'vertical';
}

export interface BusNetwork {
  channels: BusChannel[];
  // (추후 확장) 채널 간의 교차점 정보 등
}