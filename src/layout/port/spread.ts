// src/layout/port/spread.ts

import type { Graph, NodeId, PortSide } from "@domain/types";
import { getCandidateSides } from "@layout/routing/portSelector";

export function spreadPorts(g: Graph, cfg: any): Graph {
  const out = { ...g, nodes: new Map(g.nodes) };

  // 1. 각 노드의 면(side) 별로 연결될 엣지 수를 예측하여 카운트합니다.
  const portCounts = new Map<NodeId, Map<PortSide, number>>();

  for (const edge of out.edges.values()) {
    const sourceNode = out.nodes.get(edge.sourceId);
    const targetNode = out.nodes.get(edge.targetId);
    if (!sourceNode || !targetNode) continue;

    // 두 노드에 대한 최적의 연결면 후보 중 첫 번째(가장 유력한) 것을 선택합니다.
    const candidates = getCandidateSides(sourceNode, targetNode);
    if (candidates.length > 0) {
      const [sourceSide, targetSide] = candidates[0];

      // 소스 노드의 포트 카운트 증가
      if (!portCounts.has(sourceNode.id)) portCounts.set(sourceNode.id, new Map());
      const sCounts = portCounts.get(sourceNode.id)!;
      sCounts.set(sourceSide, (sCounts.get(sourceSide) || 0) + 1);

      // 타겟 노드의 포트 카운트 증가
      if (!portCounts.has(targetNode.id)) portCounts.set(targetNode.id, new Map());
      const tCounts = portCounts.get(targetNode.id)!;
      tCounts.set(targetSide, (tCounts.get(targetSide) || 0) + 1);
    }
  }

  // 2. 카운트된 수에 맞춰 각 면에 포트를 균등하게 재배치합니다.
  for (const [nodeId, sideCounts] of portCounts.entries()) {
    const node = out.nodes.get(nodeId);
    if (!node) continue;

    const newPorts: { side: PortSide; offset: number }[] = [];
    for (const [side, count] of sideCounts.entries()) {
      for (let i = 0; i < count; i++) {
        // 오프셋을 1/(count+1), 2/(count+1), ... 로 균등하게 배분
        newPorts.push({ side, offset: (i + 1) / (count + 1) });
      }
    }
    out.nodes.set(nodeId, { ...node, ports: newPorts });
  }

  return out;
}