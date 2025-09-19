import { createInitialGraph } from "@domain/scenario/generator";
import { autoLayoutPipeline } from "@layout/pipeline";
import {
  drawAll,
  initCanvas,
  setOverlaysVisible,
  setMetrics,
} from "@render/canvasLayer";
import { CONFIG } from "./config";

import { makeCamera, applyCamera, zoomAt, fitTopLeft } from "@render/camera";
import { computeWorldBounds } from "@render/world";

const canvas = document.getElementById("stage") as HTMLCanvasElement;
const metricsEl = document.getElementById("metrics")!;
const chkGrid = document.getElementById("chk-grid") as HTMLInputElement;
const chkObs = document.getElementById("chk-obstacles") as HTMLInputElement;
const chkBox = document.getElementById("chk-bbox") as HTMLInputElement;

// ===== 카메라 상태 =====
const camera = makeCamera();

const ctx = initCanvas(canvas);
const nNodes = 120;
const nEdges = 180;
const nGroups = 4;
const initPadding = 10;
let graph = createInitialGraph(nNodes, nEdges, nGroups, CONFIG.gridSize);

function render() {
  const dpr = window.devicePixelRatio || 1;
  const viewW = canvas.clientWidth;
  const viewH = canvas.clientHeight;
  canvas.width = viewW * dpr;
  canvas.height = viewH * dpr;

  // 1) 아이덴티티로 클리어
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, viewW, viewH);

  // 2) 카메라 적용 (이후 drawAll은 월드좌표로 그리기)
  applyCamera(ctx, dpr, camera);

  // 3) 기존 렌더
  drawAll(
    ctx,
    graph,
    {
      showGrid: chkGrid.checked,
      showObstacles: chkObs.checked,
      showBBox: chkBox.checked,
    },
    CONFIG
  );
}

// ===== Auto Layout =====
document.getElementById("btn-auto")!.addEventListener("click", () => {
  const t0 = performance.now();
  graph = autoLayoutPipeline(graph, CONFIG);
  const t1 = performance.now();
  setMetrics(metricsEl, { elapsedMs: (t1 - t0).toFixed(1) });

  const rect = canvas.getBoundingClientRect();
  const world = computeWorldBounds(graph);
  // 기존: fitToView(camera, rect.width, rect.height, world, 40);
  fitTopLeft(camera, rect.width, rect.height, world, initPadding);
  render();
});

// ===== Reset Graph =====
document.getElementById("btn-reset")!.addEventListener("click", () => {
  graph = createInitialGraph(nNodes, nEdges, nGroups, CONFIG.gridSize);

  const rect = canvas.getBoundingClientRect();
  const world = computeWorldBounds(graph);
  fitTopLeft(camera, rect.width, rect.height, world, initPadding);

  render();
});

// ===== 오버레이 토글 =====
[chkGrid, chkObs, chkBox].forEach((el) =>
  el.addEventListener("change", () => {
    setOverlaysVisible({
      grid: chkGrid.checked,
      obstacles: chkObs.checked,
      bbox: chkBox.checked,
    });
    render();
  })
);

// ===== 팬(드래그) =====
let panning = false;
let lastX = 0,
  lastY = 0;

canvas.addEventListener("mousedown", (e) => {
  panning = true;
  lastX = e.clientX;
  lastY = e.clientY;
});
window.addEventListener("mouseup", () => (panning = false));
window.addEventListener("mousemove", (e) => {
  if (!panning) return;
  camera.tx += e.clientX - lastX;
  camera.ty += e.clientY - lastY;
  lastX = e.clientX;
  lastY = e.clientY;
  render();
});

// ===== 휠 줌(커서 기준) =====
canvas.addEventListener(
  "wheel",
  (e) => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const zoom = Math.exp(-e.deltaY * 0.001); // deltaY>0 => 축소
    zoomAt(camera, mx, my, zoom);
    render();
  },
  { passive: false }
);

// ===== 줌/핏 버튼 =====
document.getElementById("btn-zoom-in")?.addEventListener("click", () => {
  const rect = canvas.getBoundingClientRect();
  zoomAt(camera, rect.width / 2, rect.height / 2, 1.2);
  render();
});
document.getElementById("btn-zoom-out")?.addEventListener("click", () => {
  const rect = canvas.getBoundingClientRect();
  zoomAt(camera, rect.width / 2, rect.height / 2, 1 / 1.2);
  render();
});
document.getElementById("btn-fit")?.addEventListener("click", () => {
  const rect = canvas.getBoundingClientRect();
  const world = computeWorldBounds(graph);
  fitTopLeft(camera, rect.width, rect.height, world, initPadding);
  render();
});

// ===== 초기 1회 Fit + 렌더 =====
(() => {
  const rect = canvas.getBoundingClientRect();
  const world = computeWorldBounds(graph);
  fitTopLeft(camera, rect.width, rect.height, world, initPadding);
  render();
})();

// ===== 리사이즈 대응 =====
window.addEventListener("resize", render);
