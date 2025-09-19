import { cloneGraph } from "@domain/graph";
import type { Graph, Node } from "@domain/types";

/**
 * 전체 그래프의 경계를 계산하고, 그래프의 중심이 캔버스 중앙에 오도록 모든 요소를 이동시킵니다.
 */
export function centerGraph(
  g: Graph,
  cfg: any,
  canvas: HTMLCanvasElement
): Graph {
  const graph = cloneGraph(g);
  const allNodes = Array.from(graph.nodes.values());

  if (allNodes.length === 0) return graph;

  // 전체 그래프의 경계를 계산합니다.
  let minX = Infinity,
    minY = Infinity;
  let maxX = -Infinity,
    maxY = -Infinity;

  for (const node of allNodes) {
    minX = Math.min(minX, node.bbox.x);
    minY = Math.min(minY, node.bbox.y);
    maxX = Math.max(maxX, node.bbox.x + node.bbox.w);
    maxY = Math.max(maxY, node.bbox.y + node.bbox.h);
  }

  const graphWidth = maxX - minX;
  const graphHeight = maxY - minY;
  const graphCenterX = minX + graphWidth / 2;
  const graphCenterY = minY + graphHeight / 2;

  // 캔버스의 중앙점을 계산합니다. (툴바 높이 등을 고려)
  const canvasCenterX = canvas.clientWidth / 2;
  const canvasCenterY = canvas.clientHeight / 2;

  // 이동할 오프셋을 계산합니다.
  const dx = canvasCenterX - graphCenterX;
  const dy = canvasCenterY - graphCenterY;

  // 모든 노드와 그룹을 오프셋만큼 이동시킵니다.
  for (const node of graph.nodes.values()) {
    node.bbox.x += dx;
    node.bbox.y += dy;
  }
  for (const group of graph.groups.values()) {
    group.bbox.x += dx;
    group.bbox.y += dy;
  }

  return graph;
}
