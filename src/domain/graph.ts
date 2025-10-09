import type { Edge, EdgeId, Graph, Group, GroupId, Node, NodeId, Rect } from './types';

export function cloneGraph(g: Graph): Graph {
  const newNodes : Map<NodeId, Node>= new Map(JSON.parse(JSON.stringify(Array.from(g.nodes))));
  const newEdges : Map<EdgeId, Edge> = new Map(JSON.parse(JSON.stringify(Array.from(g.edges))));
  const newGroups : Map<GroupId, Group> = new Map(JSON.parse(JSON.stringify(Array.from(g.groups))));

  return {
    nodes: newNodes,
    edges: newEdges,
    groups: newGroups,
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
