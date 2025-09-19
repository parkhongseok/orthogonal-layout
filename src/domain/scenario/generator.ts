import type {
  Graph,
  NodeId,
  EdgeId,
  GroupId,
  Rect,
  Node,
  Group,
} from "@domain/types";
import { snap } from "@utils/math";

function id<T extends string>(prefix: T, i: number) {
  return `${prefix}-${i}` as unknown as any;
}

export function createInitialGraph(
  nNodes: number,
  nEdges: number,
  nGroups: number,
  grid: number
): Graph {
  const nodes = new Map<NodeId, Node>();
  const edges = new Map();
  const groups = new Map<GroupId, Group>();

  // 1. 그룹 생성
  const gw = Math.ceil(Math.sqrt(nGroups));
  const groupW = 20 * grid,
    groupH = 14 * grid,
    gap = 4 * grid;

  for (let i = 0; i < nGroups; i++) {
    const gx = i % gw,
      gy = Math.floor(i / gw);
    const rect: Rect = {
      x: gx * (groupW + gap),
      y: gy * (groupH + gap) + 40,
      w: groupW,
      h: groupH,
    };
    const gid = id<GroupId>("g", i);
    groups.set(gid, { id: gid, bbox: rect, children: [] });
  }
  const groupList = Array.from(groups.values());

  // 2. 노드 생성 로직
  for (let i = 0; i < nNodes; i++) {
    const nid = id<NodeId>("n", i);
    let rect: Rect;
    let groupId: GroupId | undefined = undefined;

    // 2-1. [핵심] 모든 그룹이 최소 1개의 노드를 갖도록 보장
    // nGroups 수만큼의 노드는 각 그룹에 하나씩 할당합니다.
    if (i < nGroups) {
      const g = groupList[i];
      rect = {
        x: g.bbox.x + ((2 + Math.random() * (g.bbox.w / grid - 6)) | 0) * grid,
        y: g.bbox.y + ((2 + Math.random() * (g.bbox.h / grid - 6)) | 0) * grid,
        w: 6 * grid,
        h: 4 * grid,
      };
      groupId = g.id;
      g.children = [...g.children, nid];
      groups.set(g.id, g);
    } else {
      // 2-2. [핵심] 나머지 노드는 그룹에 할당되거나, 그룹 없는 독립 노드가 됨
      // 약 30%의 확률로 그룹에 속하지 않는 노드를 생성합니다.
      if (Math.random() > 0.3) {
        const g = groupList[i % nGroups]; // 간단하게 순환 할당
        rect = {
          x:
            g.bbox.x + ((2 + Math.random() * (g.bbox.w / grid - 6)) | 0) * grid,
          y:
            g.bbox.y + ((2 + Math.random() * (g.bbox.h / grid - 6)) | 0) * grid,
          w: 6 * grid,
          h: 4 * grid,
        };
        groupId = g.id;
        g.children = [...g.children, nid];
        groups.set(g.id, g);
      } else {
        // 그룹이 없는 노드는 임의의 위치에 생성합니다.
        rect = {
          x: snap((Math.random() * 800) | 0, grid),
          y: snap((Math.random() * 600) | 0, grid),
          w: 6 * grid,
          h: 4 * grid,
        };
        groupId = undefined;
      }
    }
    nodes.set(nid, { id: nid, bbox: rect, groupId: groupId });
  }

  // 3. 엣지 생성 (기존과 동일)
  for (let i = 0; i < nEdges; i++) {
    const s = id<NodeId>("n", Math.floor(Math.random() * nNodes));
    const t = id<NodeId>("n", Math.floor(Math.random() * nNodes));
    if (s === t) continue;
    const eid = id<EdgeId>("e", i);
    edges.set(eid, { id: eid, sourceId: s, targetId: t });
  }

  return { nodes, edges, groups };
}
