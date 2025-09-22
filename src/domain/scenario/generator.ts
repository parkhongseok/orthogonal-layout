import type { Graph, NodeId, EdgeId, GroupId, Rect } from "@domain/types";
import { nodeId, edgeId, groupId } from "@domain/id";
import { CONFIG } from "@app/config";

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
  const groupW = (CONFIG.layout.groupGapX | 4) * grid,
    groupH = (CONFIG.layout.groupGapY | 4) * grid,
    gap = (CONFIG.layout.groupInset | 4) * grid;

  for (let i = 0; i < nGroups; i++) {
    const gx = i % gw,
      gy = Math.floor(i / gw);
    const rect: Rect = {
      x: snap(gx * (groupW + gap), grid),
      y: snap(gy * (groupH + gap), grid),
      w: snap(groupW, grid),
      h: snap(groupH, grid),
    };
    const gid = groupId(i);
    groups.set(gid, {
      id: gid,
      bbox: rect,
      children: [],
    });
  }

  // ====== 2) 노드 배정 전략 ======
  // (a) 각 그룹에 최소 1개 강제 배정
  let nodeIdx = 0;
  for (let gi = 0; gi < nGroups && nodeIdx < nNodes; gi++, nodeIdx++) {
    const gid = groupId(gi);
    const g = groups.get(gid)!;
    const rect: Rect = randomNodeRectInGroup(g.bbox, grid);
    const nid = nodeId(nodeIdx);
    nodes.set(nid, { id: nid, bbox: rect, groupId: gid, ports: [] });
    g.children = [...g.children, nid];
    groups.set(gid, g);
  }

  // (b) 남은 노드: ungroupedRatio 확률로 루트 레벨, 이외는 임의 그룹
  for (; nodeIdx < nNodes; nodeIdx++) {
    const makeUngrouped = Math.random() < ungroupedRatio;
    if (makeUngrouped) {
      const rect: Rect = randomNodeRectInRoot(groups, grid);
      const nid = nodeId(nodeIdx);
      nodes.set(nid, { id: nid, bbox: rect, ports: [] }); // groupId 없음 = 루트 레벨
    } else {
      const gi = Math.floor(Math.random() * nGroups);
      const gid = groupId(gi);
      const g = groups.get(gid)!;
      const rect: Rect = randomNodeRectInGroup(g.bbox, grid);
      const nid = nodeId(nodeIdx);
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
  const existingEdgePairs = new Set<string>(); // ✨ [핵심 추가] 중복 엣지를 체크하기 위한 Set

  let e = 0;
  while (
    e < nEdges &&
    existingEdgePairs.size < (nodeIds.length * (nodeIds.length - 1)) / 2
  ) {
    const s = nodeIds[Math.floor(Math.random() * nodeIds.length)];
    let t = s;
    while (t === s) {
      t = nodeIds[Math.floor(Math.random() * nodeIds.length)];
    }

    // ✨ [핵심 추가] 중복 체크 로직
    // 노드 ID를 정렬하여 "n-1 -> n-2"와 "n-2 -> n-1"을 동일한 연결로 취급
    const pairKey = [s, t].sort().join("-");
    if (existingEdgePairs.has(pairKey)) {
      continue; // 이미 존재하는 엣지면 건너뛰기
    }
    existingEdgePairs.add(pairKey);

    const eid = edgeId(e++);

    const sourceNode = nodes.get(s)!;
    const targetNode = nodes.get(t)!;

    const sourceCenter = {
      x: sourceNode.bbox.x + sourceNode.bbox.w / 2,
      y: sourceNode.bbox.y + sourceNode.bbox.h / 2,
    };
    const targetCenter = {
      x: targetNode.bbox.x + targetNode.bbox.w / 2,
      y: targetNode.bbox.y + targetNode.bbox.h / 2,
    };

    edges.set(eid, {
      id: eid,
      sourceId: s,
      targetId: t,
      path: [sourceCenter, targetCenter],
    });
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
