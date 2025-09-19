import { THEME } from "./theme";
import type { Graph, Rect } from "@domain/types";

let _ctx: CanvasRenderingContext2D;
let _overlays = { grid: true, obstacles: false, bbox: false };

export function initCanvas(canvas: HTMLCanvasElement) {
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const resize = () => {
    canvas.width = canvas.clientWidth * dpr;
    canvas.height = canvas.clientHeight * dpr;
    const ctx = canvas.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    _ctx = ctx;
  };
  const style = getComputedStyle(canvas);
  if (!canvas.style.width) {
    canvas.style.width = "100vw";
    canvas.style.height = "calc(100vh - 42px)";
  }
  window.addEventListener("resize", resize);
  resize();
  return _ctx;
}

export function setOverlaysVisible(v: Partial<typeof _overlays>) {
  _overlays = { ..._overlays, ...v };
}

export function setMetrics(el: HTMLElement, m: { elapsedMs: string }) {
  el.textContent = `elapsed: ${m.elapsedMs} ms`;
}

export function drawAll(
  ctx: CanvasRenderingContext2D,
  g: Graph,
  opts: any,
  cfg: any
) {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  if (_overlays.grid) drawGrid(ctx, cfg.gridSize);

  // groups
  ctx.strokeStyle = THEME.groupStroke;
  ctx.lineWidth = 1;
  for (const [, grp] of g.groups) {
    strokeRect(ctx, grp.bbox);
  }

  // nodes
  for (const [, node] of g.nodes) {
    ctx.fillStyle = THEME.nodeFill;
    ctx.strokeStyle = THEME.nodeStroke;
    fillRect(ctx, node.bbox);
    strokeRect(ctx, node.bbox);
  }

  // edges (if path exists, draw orthogonal polyline)
  ctx.strokeStyle = THEME.edgeStroke;
  ctx.lineWidth = 2;
  for (const [, e] of g.edges) {
    if (!e.path || e.path.length === 0) continue;
    ctx.beginPath();
    ctx.moveTo(e.path[0].x, e.path[0].y);
    for (let i = 1; i < e.path.length; i++)
      ctx.lineTo(e.path[i].x, e.path[i].y);
    ctx.stroke();
  }
}

function drawGrid(ctx: CanvasRenderingContext2D, grid: number) {
  const w = ctx.canvas.width,
    h = ctx.canvas.height;
  ctx.save();
  ctx.strokeStyle = THEME.grid;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 0; x < w; x += grid) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
  }
  for (let y = 0; y < h; y += grid) {
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
  }
  ctx.stroke();
  ctx.restore();
}

function strokeRect(ctx: CanvasRenderingContext2D, r: Rect) {
  ctx.strokeRect(r.x, r.y, r.w, r.h);
}
function fillRect(ctx: CanvasRenderingContext2D, r: Rect) {
  ctx.fillRect(r.x, r.y, r.w, r.h);
}