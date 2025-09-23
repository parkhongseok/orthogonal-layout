import { Camera } from "./camera";
import { THEME } from "./theme";
import type { Graph, Point, Rect, VisibilityGraph } from "@domain/types";
import { portPosition } from "@layout/port/assign";
import { Grid } from "@layout/routing/aStarStrategy/grid";
import {
  lastBuiltGrid,
  lastBusChannels,
  lastRoutingVertices,
  lastVisibilityGraph,
} from "./debug";

export let OPTIONS = {
  grid: true,
  obstacles: true,
  channels: true,
  vertices: true,
  networks: true,
  bbox: true,
};

let _overlays = OPTIONS;
let _ctx: CanvasRenderingContext2D;

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
    canvas.style.width = "100%";
    canvas.style.height = "calc(100vh - 82px)";
  }
  window.addEventListener("resize", resize);
  resize();
  return _ctx;
}

export function setOverlaysVisible(v: Partial<typeof _overlays>) {
  _overlays = { ..._overlays, ...v };
}

export function setMetrics(el: HTMLElement, m: { elapsedMs: string }) {
  el.innerHTML = `<span><b>ELAPSED TIME</b>: ${m.elapsedMs} ms<span/>`;
}

export function drawAll(
  ctx: CanvasRenderingContext2D,
  g: Graph,
  opts: any,
  cfg: any
) {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  if (_overlays.grid) drawGrid(ctx, cfg.gridSize, opts.camera);

  drawGroups(ctx, g);

  if (_overlays.obstacles && lastBuiltGrid) {
    drawObstacles(ctx, lastBuiltGrid);
  }
  if (_overlays.channels && lastBusChannels) {
    drawBusChannels(ctx);
  }

  // 가시성 그래프(네트워크) 그리기 로직 추가
  if (_overlays.networks && lastVisibilityGraph) {
    // 'channels' 옵션을 재활용
    drawVisibilityGraph(ctx, lastVisibilityGraph);
  }

  // 라우팅 정점 그리기 로직 추가
  if (_overlays.vertices && lastRoutingVertices) {
    drawRoutingVertices(ctx, lastRoutingVertices);
  }

  drawNodes(ctx, g);
  drawNodeNames(ctx, g);
  // drawPorts(ctx, g);
  drawEdges(ctx, g);
}

function drawVisibilityGraph(
  ctx: CanvasRenderingContext2D,
  graph: VisibilityGraph
) {
  ctx.save();
  ctx.strokeStyle = THEME.network;
  ctx.lineWidth = 1;

  for (const [vIdx, neighbors] of graph.adjacency.entries()) {
    const v1 = graph.vertices[vIdx];
    for (const neighborIdx of neighbors) {
      // 중복해서 그리지 않도록 인덱스가 더 큰 경우에만 그림
      if (vIdx < neighborIdx) {
        const v2 = graph.vertices[neighborIdx];
        ctx.beginPath();
        ctx.moveTo(v1.x, v1.y);
        ctx.lineTo(v2.x, v2.y);
        ctx.stroke();
      }
    }
  }
  ctx.restore();
}

// 💡 라우팅 정점을 작은 점으로 시각화하는 함수
function drawRoutingVertices(ctx: CanvasRenderingContext2D, vertices: Point[]) {
  ctx.save();
  const radius = 1.5;
  ctx.fillStyle = THEME.vertices;
  for (const v of vertices) {
    ctx.beginPath();
    ctx.arc(v.x, v.y, radius, 0, 2 * Math.PI); // 반지름 1px 원
    ctx.fill();
  }
  ctx.restore();
}

export function drawBusChannels(ctx: CanvasRenderingContext2D) {
  if (!lastBusChannels) return;

  ctx.save();
  for (const channel of lastBusChannels) {
    const { x, y, w, h } = channel.geometry;
    ctx.fillStyle =
      channel.direction === "vertical"
        ? THEME.channelVertical
        : THEME.channelHorizontal; // Horizontal: Blue

    ctx.lineWidth = 1;
    ctx.fillRect(x, y, w, h);
  }
  ctx.restore();
}

// 장애물 그리드를 시각화하는 새로운 함수
function drawObstacles(ctx: CanvasRenderingContext2D, grid: Grid) {
  ctx.save();
  ctx.fillStyle = THEME.obstacles;
  for (let y = 0; y < grid.rows; y++) {
    for (let x = 0; x < grid.cols; x++) {
      const cell = grid.cells[y * grid.cols + x];
      if (cell.blocked) {
        const worldX = grid.originX + x * grid.size;
        const worldY = grid.originY + y * grid.size;
        ctx.fillRect(worldX, worldY, grid.size, grid.size);
      }
    }
  }
  ctx.restore();
}

export function drawGroups(ctx: CanvasRenderingContext2D, g: Graph) {
  ctx.strokeStyle = THEME.groupStroke;
  ctx.lineWidth = 1;
  for (const [, grp] of g.groups) {
    // 1. 그룹의 메인 사각형을 먼저 그림
    strokeRect(ctx, grp.bbox);

    // 그룹 이름 라벨을 그리는 로직
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

    // 2. 라벨 배경을 흰색으로 칠해서 그룹 테두리를 가리기
    ctx.fillStyle = "white";
    ctx.fillRect(labelRect.x, labelRect.y - 1, labelRect.w, labelRect.h + 2);

    // 3. 라벨 테두리를 다시 그림
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
}

export function drawNodes(ctx: CanvasRenderingContext2D, g: Graph) {
  for (const [, node] of g.nodes) {
    ctx.fillStyle = THEME.nodeFill;
    ctx.strokeStyle = THEME.nodeStroke;
    fillRect(ctx, node.bbox);
    strokeRect(ctx, node.bbox);
  }
}

export function drawNodeNames(ctx: CanvasRenderingContext2D, g: Graph) {
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
}

export function drawEdges(ctx: CanvasRenderingContext2D, g: Graph) {
  ctx.strokeStyle = THEME.edgeStroke;
  ctx.lineWidth = 1;
  for (const [, e] of g.edges) {
    if (!e.path || e.path.length === 0) continue;
    ctx.beginPath();
    ctx.moveTo(e.path[0].x, e.path[0].y);
    for (let i = 1; i < e.path.length; i++)
      ctx.lineTo(e.path[i].x, e.path[i].y);
    ctx.stroke();
  }
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
      ctx.fillStyle = THEME.port;
      ctx.fill();
    }
  }
  ctx.restore();
}

function drawGrid(ctx: CanvasRenderingContext2D, grid: number, cam: Camera) {
  const viewW = ctx.canvas.width / (window.devicePixelRatio || 1);
  const viewH = ctx.canvas.height / (window.devicePixelRatio || 1);

  // 화면 좌표(0,0)와 (viewW, viewH)가 월드 좌표의 어디에 해당하는지 계산
  const worldX1 = (0 - cam.tx) / cam.scale;
  const worldY1 = (0 - cam.ty) / cam.scale;
  const worldX2 = (viewW - cam.tx) / cam.scale;
  const worldY2 = (viewH - cam.ty) / cam.scale;

  ctx.save();
  ctx.strokeStyle = THEME.grid;
  ctx.lineWidth = 1 / cam.scale; // 줌 아웃해도 선 두께가 일정하게 보이도록 보정

  ctx.beginPath();

  // 보이는 영역에 대해서만 세로선 그리기
  const startX = Math.floor(worldX1 / grid) * grid;
  for (let x = startX; x < worldX2; x += grid) {
    ctx.moveTo(x, worldY1);
    ctx.lineTo(x, worldY2);
  }

  // 보이는 영역에 대해서만 가로선 그리기
  const startY = Math.floor(worldY1 / grid) * grid;
  for (let y = startY; y < worldY2; y += grid) {
    ctx.moveTo(worldX1, y);
    ctx.lineTo(worldX2, y);
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
