import type { Graph, NodeId, EdgeId, GroupId, Rect } from "@domain/types";

function id<T extends string>(prefix: T, i: number) {
  return `${prefix}-${i}` as unknown as any;
}

/**
 * nNodes 중 일부는 그룹에 배정, 일부는 루트 레벨(그룹 밖)에 둔다.
 * - 각 그룹은 최소 1개 이상의 노드를 반드시 가진다.
 * - ungroupedRatio(0~1)로 루트 레벨 비율 조정.
 */
export function createInitialGraph(
  nNodes: number,
  nEdges: number,
  nGroups: number,
  grid: number,
  ungroupedRatio = 0.1 // 기본 10%는 그룹 밖
): Graph {
  const nodes = new Map();
  const edges = new Map();
  const groups = new Map();

  // ====== 1) 그룹 배치(타일 형태) ======
  const gw = Math.ceil(Math.sqrt(nGroups));
  const gh = Math.ceil(nGroups / gw);
  const groupW = 20 * grid,
    groupH = 14 * grid,
    gap = 4 * grid;

  for (let i = 0; i < nGroups; i++) {
    const gx = i % gw,
      gy = Math.floor(i / gw);
    const rect: Rect = {
      x: snap(gx * (groupW + gap), grid),
      y: snap(gy * (groupH + gap) + 40, grid),
      w: snap(groupW, grid),
      h: snap(groupH, grid),
    };
    groups.set(id<GroupId>("g", i), {
      id: id<GroupId>("g", i),
      bbox: rect,
      children: [],
    });
  }

  // ====== 2) 노드 배정 전략 ======
  // (a) 각 그룹에 최소 1개 강제 배정
  let nodeIdx = 0;
  for (let gi = 0; gi < nGroups && nodeIdx < nNodes; gi++, nodeIdx++) {
    const gid = id<GroupId>("g", gi);
    const g = groups.get(gid)!;
    const rect: Rect = randomNodeRectInGroup(g.bbox, grid);
    const nid = id<NodeId>("n", nodeIdx);
    nodes.set(nid, { id: nid, bbox: rect, groupId: gid, ports: [] });
    g.children = [...g.children, nid];
    groups.set(gid, g);
  }

  // (b) 남은 노드: ungroupedRatio 확률로 루트 레벨, 이외는 임의 그룹
  for (; nodeIdx < nNodes; nodeIdx++) {
    const makeUngrouped = Math.random() < ungroupedRatio;
    if (makeUngrouped) {
      const rect: Rect = randomNodeRectInRoot(groups, grid);
      const nid = id<NodeId>("n", nodeIdx);
      nodes.set(nid, { id: nid, bbox: rect, ports: [] }); // groupId 없음 = 루트 레벨
    } else {
      const gi = Math.floor(Math.random() * nGroups);
      const gid = id<GroupId>("g", gi);
      const g = groups.get(gid)!;
      const rect: Rect = randomNodeRectInGroup(g.bbox, grid);
      const nid = id<NodeId>("n", nodeIdx);
      nodes.set(nid, { id: nid, bbox: rect, groupId: gid, ports: [] });
      g.children = [...g.children, nid];
      groups.set(gid, g);
    }
  }

  // 각 그룹에 배정된 노드 수 로그 출력
  for (const group of groups.values()) {
    console.log(`Group ${group.id} has ${group.children.length} nodes.`);
  }

  // ====== 3) 엣지 생성: 그룹 내/간/루트 노드 섞어서 랜덤 연결 ======
  const nodeIds = Array.from(nodes.keys()) as NodeId[];
  let e = 0;
  while (e < nEdges && nodeIds.length > 1) {
    const s = nodeIds[Math.floor(Math.random() * nodeIds.length)];
    let t = s;
    while (t === s) {
      t = nodeIds[Math.floor(Math.random() * nodeIds.length)];
    }
    const eid = id<EdgeId>("e", e++);
    edges.set(eid, { id: eid, sourceId: s, targetId: t });
  }

  return { nodes, edges, groups };
}

// ====== Helpers ======

function randomNodeRectInGroup(gbox: Rect, grid: number): Rect {
  // 그룹 내부에서 대충 격자에 맞춘 초기 위치 (나중에 initPlacement가 재배치함)
  const pad = 2 * grid;
  const x =
    gbox.x + pad + ((Math.random() * (gbox.w - 6 * grid - pad * 2)) | 0);
  const y =
    gbox.y + pad + ((Math.random() * (gbox.h - 4 * grid - pad * 2)) | 0);
  return { x: snap(x, grid), y: snap(y, grid), w: 6 * grid, h: 4 * grid };
}

function randomNodeRectInRoot(groups: Map<GroupId, any>, grid: number): Rect {
  // 루트 레벨은 그룹 블록들 아래쪽 여백에 대충 배치 (초기)
  // 나중에 initPlacement가 root 영역 타일링으로 재배치함.
  const marginY = 40;
  const maxBottom = Math.max(
    ...Array.from(groups.values()).map((g) => g.bbox.y + g.bbox.h)
  );
  const baseY = maxBottom + marginY;

  const maxRight = Math.max(
    ...Array.from(groups.values()).map((g) => g.bbox.x + g.bbox.w)
  );
  const spreadX = maxRight + 400; // 넓게 흩뿌려두고, 이후 초기 배치에서 재정렬

  const x = (Math.random() * spreadX) | 0;
  const y = baseY + ((Math.random() * 400) | 0);
  return { x: snap(x, grid), y: snap(y, grid), w: 6 * grid, h: 4 * grid };
}

function snap(v: number, grid: number) {
  return Math.round(v / grid) * grid;
}

// import type {
//   Graph,
//   NodeId,
//   EdgeId,
//   GroupId,
//   Rect,
//   Node,
//   Group,
// } from "@domain/types";
// import { snap } from "@utils/math";

// function id<T extends string>(prefix: T, i: number) {
//   return `${prefix}-${i}` as unknown as any;
// }

// export function createInitialGraph(
//   nNodes: number,
//   nEdges: number,
//   nGroups: number,
//   grid: number
// ): Graph {
//   const nodes = new Map<NodeId, Node>();
//   const edges = new Map();
//   const groups = new Map<GroupId, Group>();

//   // 1. 그룹 생성
//   const gw = Math.ceil(Math.sqrt(nGroups));
//   const groupW = 20 * grid,
//     groupH = 14 * grid,
//     gap = 4 * grid;

//   for (let i = 0; i < nGroups; i++) {
//     const gx = i % gw,
//       gy = Math.floor(i / gw);
//     const rect: Rect = {
//       x: gx * (groupW + gap),
//       y: gy * (groupH + gap) + 40,
//       w: groupW,
//       h: groupH,
//     };
//     const gid = id<GroupId>("g", i);
//     groups.set(gid, { id: gid, bbox: rect, children: [] });
//   }
//   const groupList = Array.from(groups.values());

//   // 2. 노드 생성 로직
//   for (let i = 0; i < nNodes; i++) {
//     const nid = id<NodeId>("n", i);
//     let rect: Rect;
//     let groupId: GroupId | undefined = undefined;

//     // 2-1. [핵심] 모든 그룹이 최소 1개의 노드를 갖도록 보장
//     // nGroups 수만큼의 노드는 각 그룹에 하나씩 할당합니다.
//     if (i < nGroups) {
//       const g = groupList[i];
//       rect = {
//         x: g.bbox.x + ((2 + Math.random() * (g.bbox.w / grid - 6)) | 0) * grid,
//         y: g.bbox.y + ((2 + Math.random() * (g.bbox.h / grid - 6)) | 0) * grid,
//         w: 6 * grid,
//         h: 4 * grid,
//       };
//       groupId = g.id;
//       g.children = [...g.children, nid];
//       groups.set(g.id, g);
//     } else {
//       // 2-2. [핵심] 나머지 노드는 그룹에 할당되거나, 그룹 없는 독립 노드가 됨
//       // 약 30%의 확률로 그룹에 속하지 않는 노드를 생성합니다.
//       if (Math.random() > 0.3) {
//         const g = groupList[i % nGroups]; // 간단하게 순환 할당
//         rect = {
//           x:
//             g.bbox.x + ((2 + Math.random() * (g.bbox.w / grid - 6)) | 0) * grid,
//           y:
//             g.bbox.y + ((2 + Math.random() * (g.bbox.h / grid - 6)) | 0) * grid,
//           w: 6 * grid,
//           h: 4 * grid,
//         };
//         groupId = g.id;
//         g.children = [...g.children, nid];
//         groups.set(g.id, g);
//       } else {
//         // 그룹이 없는 노드는 임의의 위치에 생성합니다.
//         rect = {
//           x: snap((Math.random() * 800) | 0, grid),
//           y: snap((Math.random() * 600) | 0, grid),
//           w: 6 * grid,
//           h: 4 * grid,
//         };
//         groupId = undefined;
//       }
//     }
//     nodes.set(nid, { id: nid, bbox: rect, groupId: groupId });
//   }

//   // 3. 엣지 생성 (기존과 동일)
//   for (let i = 0; i < nEdges; i++) {
//     const s = id<NodeId>("n", Math.floor(Math.random() * nNodes));
//     const t = id<NodeId>("n", Math.floor(Math.random() * nNodes));
//     if (s === t) continue;
//     const eid = id<EdgeId>("e", i);
//     edges.set(eid, { id: eid, sourceId: s, targetId: t });
//   }

//   return { nodes, edges, groups };
// }
