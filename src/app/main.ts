import { createInitialGraph } from "@domain/scenario/generator";
import { autoLayoutPipeline } from "@layout/pipeline";
import {
  drawAll,
  initCanvas,
  setOverlaysVisible,
  setMetrics,
} from "@render/canvasLayer";
import { CONFIG } from "./config";

const canvas = document.getElementById("stage") as HTMLCanvasElement;
const metricsEl = document.getElementById("metrics")!;
const chkGrid = document.getElementById("chk-grid") as HTMLInputElement;
const chkObs = document.getElementById("chk-obstacles") as HTMLInputElement;
const chkBox = document.getElementById("chk-bbox") as HTMLInputElement;

const ctx = initCanvas(canvas);
const nNodes = 120;
const nEdges = 180;
const nGroups = 4;
let graph = createInitialGraph(nNodes, nEdges, nGroups, CONFIG.gridSize);

function render() {
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

document.getElementById("btn-auto")!.addEventListener("click", () => {
  const t0 = performance.now();
  graph = autoLayoutPipeline(graph, CONFIG);
  const t1 = performance.now();
  setMetrics(metricsEl, { elapsedMs: (t1 - t0).toFixed(1) });
  render();
});

document.getElementById("btn-reset")!.addEventListener("click", () => {
  graph = createInitialGraph(nNodes, nEdges, nGroups, CONFIG.gridSize);
  render();
});

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

render();
