import type { Graph, Node, PortSide, NodeId } from "@domain/types";

/**
 * 각 노드의 4면(top, bottom, left, right)에 균등 분산된 포트를 생성한다.
 * - 현재는 edge 수와 관계없이 기본 개수만 배치
 * - 추후 edge 연결 수에 따라 동적으로 늘릴 수도 있음
 */
export function assignPorts(g: Graph, cfg: any): Graph {
  const portsPerSide = cfg.portPerSide;

  const out: Graph = {
    nodes: new Map(g.nodes),
    edges: new Map(g.edges),
    groups: new Map(g.groups),
  };

  let edited = 0;
  for (const [id, n] of out.nodes) {
    // out.nodes 기준으로 순회
    const ports: { side: PortSide; offset: number }[] = [];

    (["top", "bottom", "left", "right"] as PortSide[]).forEach((side) => {
      for (let i = 0; i < portsPerSide; i++) {
        ports.push({ side, offset: (i + 1) / (portsPerSide + 1) });
      }
    });

    out.nodes.set(id, { ...n, ports });
    edited++;
  }
  return out;
}

/**
 * 특정 포트의 절대 좌표를 계산
 */
export function portPosition(node: Node, side: PortSide, offset: number) {
  const { x, y, w, h } = node.bbox;
  switch (side) {
    case "top":
      return { x: x + w * offset, y };
    case "bottom":
      return { x: x + w * offset, y: y + h };
    case "left":
      return { x, y: y + h * offset };
    case "right":
      return { x: x + w, y: y + h * offset };
  }
}
