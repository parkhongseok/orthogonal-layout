export type NodeId = string & { readonly brand: unique symbol };
export type EdgeId = string & { readonly brand: unique symbol };
export type GroupId = string & { readonly brand: unique symbol };

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
