import { BusRoutingStrategy } from "./../layout/routing/busStrategy/busRoutingStrategy";
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
import { Graph } from "@domain/types";
import { LegacyAStarStrategy } from "@layout/routing/aStarStrategy/legacyAStarStrategy";
import { clearDebugData } from "@render/debug";


const canvas = document.getElementById("stage") as HTMLCanvasElement;
const metricsEl = document.getElementById("metrics")!;
const infoPanelEl = document.getElementById("info-panel")!; // 정보 패널

// 컨트롤 요소들
const btnAuto = document.getElementById("btn-auto")!;
const btnBusAuto = document.getElementById("btn-bus-auto")!;
const btnReset = document.getElementById("btn-reset")!;
const numNodesInput = document.getElementById("num-nodes") as HTMLInputElement;
const numEdgesInput = document.getElementById("num-edges") as HTMLInputElement;

// 카메라 요소
const chkGrid = document.getElementById("chk-grid") as HTMLInputElement;
const chkObs = document.getElementById("chk-obstacles") as HTMLInputElement;
const chkChnn = document.getElementById("chk-chnn") as HTMLInputElement;
const chkBox = document.getElementById("chk-bbox") as HTMLInputElement;

// ===== 카메라 상태 =====
const camera = makeCamera();

const ctx = initCanvas(canvas);
const nNodes = 7;
const nEdges = 3;
const nGroups = 2;
const initPadding = 10;
let graph: Graph = createInitialGraph(nNodes, nEdges, nGroups, CONFIG.gridSize);

// 정포 페널 갱신 함수
function updateInfoPanel(g: Graph) {
  const nodeCount = g.nodes.size;
  const edgeCount = g.edges.size;
  const groupCount = g.groups.size;

  let groupInfo = "<span>";
  for (const group of g.groups.values()) {
    groupInfo += `{${group.id}: ${group.children.length} nodes}, `;
  }
  groupInfo += "</span>";

  infoPanelEl.innerHTML = ` 
    <span><b>Total Nodes:</b> ${nodeCount}</span>
    <span><b>Total Edges:</b> ${edgeCount}</span>
    <span><b>Total Groups:</b> ${groupCount}</span>
    <span><b>Nodes per Group:</b> ${groupInfo}</span>
  `;
}

// 그래프를 (재)생성하는 로직을 함수로 분리
function regenerateGraph() {
  // 재생성 시 이전 레이아웃의 장애물 정보를 깨끗이 지웁니다.
  clearDebugData();
  const nNodes = parseInt(numNodesInput.value, 10) || 12;
  const nEdges = parseInt(numEdgesInput.value, 10) || 18;

  graph = createInitialGraph(nNodes, nEdges, nGroups, CONFIG.gridSize);

  const rect = canvas.getBoundingClientRect();
  const world = computeWorldBounds(graph);
  fitTopLeft(camera, rect.width, rect.height, world, initPadding);

  updateInfoPanel(graph); // 정보 패널 업데이트

  render();
}

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
      showChennals: chkChnn.checked,
      showBBox: chkBox.checked,
      camera: camera, 
    },
    CONFIG,
  );
}

// ===== Auto Layout =====
btnBusAuto.addEventListener("click", () => {
  const t0 = performance.now();
  const busRoutingStrategy = new BusRoutingStrategy();

  // 파이프라인에 전략을 전달
  graph = autoLayoutPipeline(graph, CONFIG, busRoutingStrategy);
  const t1 = performance.now();
  setMetrics(metricsEl, { elapsedMs: (t1 - t0).toFixed(1) });

  const rect = canvas.getBoundingClientRect();
  const world = computeWorldBounds(graph);
  fitTopLeft(camera, rect.width, rect.height, world, initPadding);

  updateInfoPanel(graph); // 레이아웃 후 정보 패널 업데이트
  render();
});

btnAuto.addEventListener("click", () => {
  const t0 = performance.now();
  const legacyStrategy = new LegacyAStarStrategy();

  // 파이프라인에 전략을 전달
  graph = autoLayoutPipeline(graph, CONFIG, legacyStrategy);
  const t1 = performance.now();
  setMetrics(metricsEl, { elapsedMs: (t1 - t0).toFixed(1) });

  const rect = canvas.getBoundingClientRect();
  const world = computeWorldBounds(graph);
  fitTopLeft(camera, rect.width, rect.height, world, initPadding);

  updateInfoPanel(graph); // 레이아웃 후 정보 패널 업데이트
  render();
});

// ===== Reset Graph =====
btnReset.addEventListener("click", regenerateGraph);

// ===== 오버레이 토글 =====
[chkGrid, chkObs, chkChnn, chkBox].forEach((el) =>
  el.addEventListener("change", () => {
    setOverlaysVisible({
      grid: chkGrid.checked,
      obstacles: chkObs.checked,
      channels: chkChnn.checked,
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
// ===== 초기 실행 =====
regenerateGraph();

// ===== 리사이즈 대응 =====
window.addEventListener("resize", render);
