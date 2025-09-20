import { THEME } from "./theme";
import type { Graph, Rect } from "@domain/types";
import { portPosition } from "@layout/port/assign";

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
    // 1. 그룹의 메인 사각형을 먼저 그립니다.
    strokeRect(ctx, grp.bbox);

    // [추가] 그룹 이름 라벨을 그리는 로직
    const labelHeight = 12;
    const labelPadding = 5;
    // 라벨의 너비를 텍스트 길이에 맞게 동적으로 계산
    const groupName = `Group ${grp.id.replace("g-", "")}`;
    ctx.font = "bold 7.6px sans-serif"; // 폰트를 먼저 설정해야 너비 계산이 정확
    const textMetrics = ctx.measureText(groupName);
    const labelWidth = textMetrics.width + labelPadding * 2;

    const labelRect = {
      x: grp.bbox.x,
      y: grp.bbox.y,
      w: labelWidth,
      h: labelHeight,
    };

    // 2. 라벨 배경을 흰색으로 칠해서 그룹 테두리를 가립니다.
    ctx.fillStyle = "white";
    ctx.fillRect(labelRect.x, labelRect.y - 1, labelRect.w, labelRect.h + 2);

    // 3. 라벨 테두리를 다시 그립니다.
    strokeRect(ctx, labelRect);

    // 4. 라벨 텍스트를 씁니다.
    ctx.fillStyle = THEME.groupStroke; // 텍스트 색상
    ctx.textAlign = "left"; // 왼쪽 정렬
    ctx.textBaseline = "middle"; // 세로 중앙 정렬
    ctx.fillText(
      groupName,
      grp.bbox.x + labelPadding,
      grp.bbox.y + labelHeight / 2
    );
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

  // nodes
  for (const [, node] of g.nodes) {
    ctx.fillStyle = THEME.nodeFill;
    ctx.strokeStyle = THEME.nodeStroke;
    fillRect(ctx, node.bbox);
    strokeRect(ctx, node.bbox);
  }

  for (const [, node] of g.nodes) {
    ctx.fillStyle = THEME.nodeFill;
    ctx.strokeStyle = THEME.nodeStroke;
    ctx.lineWidth = 1; // 텍스트를 그리기 전에 선 두께를 재설정

    fillRect(ctx, node.bbox);
    strokeRect(ctx, node.bbox);

    // 노드 ID 텍스트를 그리는 로직
    ctx.fillStyle = THEME.nodeStroke; // 텍스트 색상
    ctx.font = "12px sans-serif"; // 폰트 설정
    ctx.textAlign = "center"; // 가로 중앙 정렬
    ctx.textBaseline = "middle"; // 세로 중앙 정렬

    const textX = node.bbox.x + node.bbox.w / 2;
    const textY = node.bbox.y + node.bbox.h / 2;

    // 노드 ID에서 'n-' 접두사를 제거하고 숫자만 표시
    const nodeIdText = node.id.replace("n-", "");
    ctx.fillText(nodeIdText, textX, textY);
  }

  drawPorts(ctx, g);
}

export function drawPorts(ctx: CanvasRenderingContext2D, graph: Graph) {
  ctx.save();
  ctx.lineWidth = 1;
  for (const [, n] of graph.nodes) {
    if (!n.ports?.length) continue;
    for (const p of n.ports) {
      const pos = portPosition(n, p.side, p.offset);
      ctx.beginPath();
      ctx.rect(pos.x - 2, pos.y - 2, 4, 4); // 작은 정사각형 포트
      ctx.fillStyle = "#1f6feb";
      ctx.fill();
      // ctx.stroke();
    }
  }
  ctx.restore();
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
