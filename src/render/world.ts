import type { Graph, Rect } from "@domain/types";

export function computeWorldBounds(graph: Graph) {
  const rects: Rect[] = [];
  for (const [, g] of graph.groups) rects.push(g.bbox);
  for (const [, n] of graph.nodes) rects.push(n.bbox);
  if (rects.length === 0) return { x: 0, y: 0, w: 1, h: 1 };

  const minX = Math.min(...rects.map((r) => r.x));
  const minY = Math.min(...rects.map((r) => r.y));
  const maxX = Math.max(...rects.map((r) => r.x + r.w));
  const maxY = Math.max(...rects.map((r) => r.y + r.h));
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}
