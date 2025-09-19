import type { Graph, NodeId, EdgeId, GroupId, Rect } from '@domain/types';

function id<T extends string>(prefix: T, i: number) {
  return `${prefix}-${i}` as unknown as any;
}

export function createInitialGraph(nNodes: number, nEdges: number, nGroups: number, grid: number): Graph {
  const nodes = new Map();
  const edges = new Map();
  const groups = new Map();

  // groups: simple tiled groups
  const gw = Math.ceil(Math.sqrt(nGroups));
  const gh = Math.ceil(nGroups / gw);
  const groupW = 20 * grid, groupH = 14 * grid, gap = 4 * grid;

  for (let i = 0; i < nGroups; i++) {
    const gx = i % gw, gy = Math.floor(i / gw);
    const rect: Rect = { x: gx*(groupW+gap), y: gy*(groupH+gap) + 40, w: groupW, h: groupH };
    groups.set(id<GroupId>('g', i), { id: id<GroupId>('g', i), bbox: rect, children: [] });
  }

  // nodes: random within canvas-ish bounds (may exceed group; later placement fixes)
  for (let i = 0; i < nNodes; i++) {
    const gid = id<GroupId>('g', i % nGroups);
    const g = groups.get(gid)!;
    const nx = g.bbox.x + (2 + Math.random()*(g.bbox.w/grid - 6) | 0) * grid;
    const ny = g.bbox.y + (2 + Math.random()*(g.bbox.h/grid - 6) | 0) * grid;
    const rect: Rect = { x: nx, y: ny, w: 6*grid, h: 4*grid };
    const nid = id<NodeId>('n', i);
    nodes.set(nid, { id: nid, bbox: rect, groupId: gid, ports: [] });
    g.children = [...g.children, nid];
    groups.set(gid, g);
  }

  // edges: random pairs
  for (let i = 0; i < nEdges; i++) {
    const s = id<NodeId>('n', Math.floor(Math.random()*nNodes));
    const t = id<NodeId>('n', Math.floor(Math.random()*nNodes));
    if (s === t) continue;
    const eid = id<EdgeId>('e', i);
    edges.set(eid, { id: eid, sourceId: s, targetId: t });
  }

  return { nodes, edges, groups };
}
