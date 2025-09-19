import type { Graph, Node, NodeId, Rect } from './types';

export function cloneGraph(g: Graph): Graph {
  return {
    nodes: new Map(g.nodes),
    edges: new Map(g.edges),
    groups: new Map(g.groups),
  };
}

export function moveNode(g: Graph, id: NodeId, to: Rect): Graph {
  const n = g.nodes.get(id);
  if (!n) return g;
  const nn: Node = { ...n, bbox: to };
  const nodes = new Map(g.nodes);
  nodes.set(id, nn);
  return { ...g, nodes };
}
