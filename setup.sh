#!/usr/bin/env bash
# 파일명: setup.sh
# 사용법: orthogonal-layout/ 디렉터리에서 `bash setup.sh`
set -euo pipefail

# 0) 기본 디렉터리
mkdir -p public src/{app,domain,domain/scenario,layout/{placement,port,routing,compaction},render,ui,utils,workers} tests/{unit,e2e} docs

# 1) 루트 파일들
cat > .gitignore << 'EOF'
# Node
node_modules/
dist/
.vite/
.DS_Store

# Logs
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Editor
.idea/
.vscode/
EOF

cat > package.json << 'EOF'
{
  "name": "orthogonal-layout",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "typecheck": "tsc --noEmit",
    "test": "echo \"(todo) add test runner\" && exit 0"
  },
  "devDependencies": {
    "typescript": "^5.6.0",
    "vite": "^5.4.0"
  }
}
EOF

cat > tsconfig.json << 'EOF'
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "baseUrl": ".",
    "paths": {
      "@app/*": ["src/app/*"],
      "@domain/*": ["src/domain/*"],
      "@layout/*": ["src/layout/*"],
      "@render/*": ["src/render/*"],
      "@ui/*": ["src/ui/*"],
      "@utils/*": ["src/utils/*"]
    },
    "jsx": "react-jsx",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "skipLibCheck": true
  },
  "include": ["src"]
}
EOF

cat > vite.config.ts << 'EOF'
import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  server: { port: 5173 },
  build: { outDir: 'dist' }
});
EOF

# 2) 정적 HTML
mkdir -p public
cat > public/index.html << 'EOF'
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <title>Orthogonal Auto Layout</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <link rel="stylesheet" href="/src/index.css" />
</head>
<body>
  <div id="app">
    <div id="toolbar">
      <button id="btn-auto">Auto Layout</button>
      <button id="btn-reset">Reset</button>
      <label><input type="checkbox" id="chk-grid" checked /> Grid</label>
      <label><input type="checkbox" id="chk-obstacles" /> Obstacles</label>
      <label><input type="checkbox" id="chk-bbox" /> BoundingBox</label>
      <span id="metrics"></span>
    </div>
    <canvas id="stage"></canvas>
  </div>
  <script type="module" src="/src/app/main.ts"></script>
</body>
</html>
EOF

# 3) 스타일 최소
cat > src/index.css << 'EOF'
html, body, #app { margin: 0; padding: 0; height: 100%; }
#toolbar {
  display: flex; gap: 8px; align-items: center;
  padding: 8px; border-bottom: 1px solid #ddd; font-family: system-ui, sans-serif;
}
#stage { display: block; width: 100vw; height: calc(100vh - 42px); }
label { user-select: none; }
EOF

# 4) 앱 엔트리/설정
cat > src/app/config.ts << 'EOF'
export const CONFIG = {
  gridSize: 12,          // px
  portPerSide: 4,        // 면당 기본 포트 후보 수
  cost: {
    distance: 1,
    bend: 5,
    obstacle: 100,
    congestion: 2
  },
  routing: {
    bboxExpand: 3,       // 바운딩 박스 확장(그리드셀 단위)
    maxExpandSteps: 3
  },
};
EOF

cat > src/app/main.ts << 'EOF'
import { createInitialGraph } from '@domain/scenario/generator';
import { autoLayoutPipeline } from '@layout/pipeline';
import { drawAll, initCanvas, setOverlaysVisible, setMetrics } from '@render/canvasLayer';
import { CONFIG } from './config';

const canvas = document.getElementById('stage') as HTMLCanvasElement;
const metricsEl = document.getElementById('metrics')!;
const chkGrid = document.getElementById('chk-grid') as HTMLInputElement;
const chkObs  = document.getElementById('chk-obstacles') as HTMLInputElement;
const chkBox  = document.getElementById('chk-bbox') as HTMLInputElement;

const ctx = initCanvas(canvas);
let graph = createInitialGraph(120, 180, 4, CONFIG.gridSize);

function render() {
  drawAll(ctx, graph, {
    showGrid: chkGrid.checked,
    showObstacles: chkObs.checked,
    showBBox: chkBox.checked
  }, CONFIG);
}

document.getElementById('btn-auto')!.addEventListener('click', () => {
  const t0 = performance.now();
  graph = autoLayoutPipeline(graph, CONFIG);
  const t1 = performance.now();
  setMetrics(metricsEl, { elapsedMs: (t1 - t0).toFixed(1) });
  render();
});

document.getElementById('btn-reset')!.addEventListener('click', () => {
  graph = createInitialGraph(120, 180, 4, CONFIG.gridSize);
  render();
});

[chkGrid, chkObs, chkBox].forEach(el => el.addEventListener('change', () => {
  setOverlaysVisible({ grid: chkGrid.checked, obstacles: chkObs.checked, bbox: chkBox.checked });
  render();
}));

render();
EOF

# 5) 도메인 타입/그래프 유틸/시나리오
cat > src/domain/types.ts << 'EOF'
export type NodeId = string & { readonly brand: unique symbol };
export type EdgeId = string & { readonly brand: unique symbol };
export type GroupId = string & { readonly brand: unique symbol };

export interface Point { x: number; y: number; }
export interface Rect { x: number; y: number; w: number; h: number; }
export type PortSide = 'top' | 'bottom' | 'left' | 'right';

export interface Node {
  id: NodeId;
  bbox: Rect;
  groupId?: GroupId;
  ports?: ReadonlyArray<{ side: PortSide; offset: number }>;
}

export interface Group {
  id: GroupId;
  bbox: Rect;
  children: ReadonlyArray<NodeId>;
}

export interface Edge {
  id: EdgeId;
  sourceId: NodeId;
  targetId: NodeId;
  path?: ReadonlyArray<Point>;
}

export interface Graph {
  nodes: Map<NodeId, Node>;
  edges: Map<EdgeId, Edge>;
  groups: Map<GroupId, Group>;
}
EOF

cat > src/domain/graph.ts << 'EOF'
import type { Graph, Node, NodeId, Rect } from './types';

export function cloneGraph(g: Graph): Graph {
  return {
    nodes: new Map(g.nodes),
    edges: new Map(g.edges),
    groups: new Map(g.groups),
  };
}

export function moveNode(g: Graph, id: NodeId, to: Rect): Graph {
  const n = g.nodes.get(id);
  if (!n) return g;
  const nn: Node = { ...n, bbox: to };
  const nodes = new Map(g.nodes);
  nodes.set(id, nn);
  return { ...g, nodes };
}
EOF

cat > src/domain/scenario/generator.ts << 'EOF'
import type { Graph, NodeId, EdgeId, GroupId, Rect } from '@domain/types';

function id<T extends string>(prefix: T, i: number) {
  return `${prefix}-${i}` as unknown as any;
}

export function createInitialGraph(nNodes: number, nEdges: number, nGroups: number, grid: number): Graph {
  const nodes = new Map();
  const edges = new Map();
  const groups = new Map();

  // groups: simple tiled groups
  const gw = Math.ceil(Math.sqrt(nGroups));
  const gh = Math.ceil(nGroups / gw);
  const groupW = 20 * grid, groupH = 14 * grid, gap = 4 * grid;

  for (let i = 0; i < nGroups; i++) {
    const gx = i % gw, gy = Math.floor(i / gw);
    const rect: Rect = { x: gx*(groupW+gap), y: gy*(groupH+gap) + 40, w: groupW, h: groupH };
    groups.set(id<GroupId>('g', i), { id: id<GroupId>('g', i), bbox: rect, children: [] });
  }

  // nodes: random within canvas-ish bounds (may exceed group; later placement fixes)
  for (let i = 0; i < nNodes; i++) {
    const gid = id<GroupId>('g', i % nGroups);
    const g = groups.get(gid)!;
    const nx = g.bbox.x + (2 + Math.random()*(g.bbox.w/grid - 6) | 0) * grid;
    const ny = g.bbox.y + (2 + Math.random()*(g.bbox.h/grid - 6) | 0) * grid;
    const rect: Rect = { x: nx, y: ny, w: 6*grid, h: 4*grid };
    const nid = id<NodeId>('n', i);
    nodes.set(nid, { id: nid, bbox: rect, groupId: gid, ports: [] });
    g.children = [...g.children, nid];
    groups.set(gid, g);
  }

  // edges: random pairs
  for (let i = 0; i < nEdges; i++) {
    const s = id<NodeId>('n', Math.floor(Math.random()*nNodes));
    const t = id<NodeId>('n', Math.floor(Math.random()*nNodes));
    if (s === t) continue;
    const eid = id<EdgeId>('e', i);
    edges.set(eid, { id: eid, sourceId: s, targetId: t });
  }

  return { nodes, edges, groups };
}
EOF

# 6) 레이아웃 파이프라인(스텁)
cat > src/layout/pipeline.ts << 'EOF'
import type { Graph } from '@domain/types';
import { initialPlacement } from '@layout/placement/initPlacement';
import { resolveOverlap } from '@layout/placement/resolveOverlap';
import { assignPorts } from '@layout/port/assign';
import { spreadPorts } from '@layout/port/spread';
import { routeAll } from '@layout/routing/routeAll';
import { sweepCompact } from '@layout/compaction/sweep';

export function autoLayoutPipeline(g: Graph, cfg: any): Graph {
  let cur = g;
  cur = initialPlacement(cur, cfg);
  cur = resolveOverlap(cur, cfg);
  cur = assignPorts(cur, cfg);
  cur = spreadPorts(cur, cfg);
  cur = routeAll(cur, cfg);
  cur = sweepCompact(cur, cfg);
  return cur;
}
EOF

# 6-1) placement stubs
cat > src/layout/placement/initPlacement.ts << 'EOF'
import type { Graph } from '@domain/types';

export function initialPlacement(g: Graph, cfg: any): Graph {
  // TODO: 레벨/BFS 또는 간단 타일 배치 후 격자 스냅
  return g;
}
EOF

cat > src/layout/placement/resolveOverlap.ts << 'EOF'
import type { Graph } from '@domain/types';

export function resolveOverlap(g: Graph, cfg: any): Graph {
  // TODO: 행/열 스윕으로 겹침 제거/간격 보장
  return g;
}
EOF

# 6-2) port stubs
cat > src/layout/port/assign.ts << 'EOF'
import type { Graph } from '@domain/types';

export function assignPorts(g: Graph, cfg: any): Graph {
  // TODO: 상대 위치 기반 상/하/좌/우 우선 할당
  return g;
}
EOF

cat > src/layout/port/spread.ts << 'EOF'
import type { Graph } from '@domain/types';

export function spreadPorts(g: Graph, cfg: any): Graph {
  // TODO: 같은 면의 포트를 균등 간격으로 분산
  return g;
}
EOF

# 6-3) routing stubs
cat > src/layout/routing/grid.ts << 'EOF'
import type { Graph } from '@domain/types';
export function buildGrid(g: Graph, cfg: any) {
  // TODO: 격자/장애물 맵 구성
  return {};
}
EOF

cat > src/layout/routing/cost.ts << 'EOF'
export function costManhattan(ax: number, ay: number, bx: number, by: number) {
  return Math.abs(ax - bx) + Math.abs(ay - by);
}
EOF

cat > src/layout/routing/aStar.ts << 'EOF'
export function routeAStar(start: any, goal: any, grid: any, cfg: any) {
  // TODO: A* 구현 (맨해튼 + 굴곡/장애물 페널티)
  return [];
}
EOF

cat > src/layout/routing/routeAll.ts << 'EOF'
import type { Graph } from '@domain/types';

export function routeAll(g: Graph, cfg: any): Graph {
  // TODO: 전체 엣지 라우팅 오케스트레이션
  return g;
}
EOF

# 6-4) compaction stub
cat > src/layout/compaction/sweep.ts << 'EOF'
import type { Graph } from '@domain/types';

export function sweepCompact(g: Graph, cfg: any): Graph {
  // TODO: 행/열 스윕으로 빈칸 당기기
  return g;
}
EOF

# 7) 렌더 레이어(간단 동작)
cat > src/render/theme.ts << 'EOF'
export const THEME = {
  nodeFill: '#f7f7fb',
  nodeStroke: '#2c3e50',
  edgeStroke: '#3b82f6',
  grid: '#e5e7eb',
  groupStroke: '#9ca3af'
};
EOF

cat > src/render/canvasLayer.ts << 'EOF'
import { THEME } from './theme';
import type { Graph, Rect } from '@domain/types';

let _ctx: CanvasRenderingContext2D;
let _overlays = { grid: true, obstacles: false, bbox: false };

export function initCanvas(canvas: HTMLCanvasElement) {
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const resize = () => {
    canvas.width = canvas.clientWidth * dpr;
    canvas.height = canvas.clientHeight * dpr;
    const ctx = canvas.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    _ctx = ctx;
  };
  const style = getComputedStyle(canvas);
  if (!canvas.style.width) {
    canvas.style.width = '100vw';
    canvas.style.height = 'calc(100vh - 42px)';
  }
  window.addEventListener('resize', resize);
  resize();
  return _ctx;
}

export function setOverlaysVisible(v: Partial<typeof _overlays>) {
  _overlays = { ..._overlays, ...v };
}

export function setMetrics(el: HTMLElement, m: { elapsedMs: string }) {
  el.textContent = `elapsed: ${m.elapsedMs} ms`;
}

export function drawAll(ctx: CanvasRenderingContext2D, g: Graph, opts: any, cfg: any) {
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
    for (let i = 1; i < e.path.length; i++) ctx.lineTo(e.path[i].x, e.path[i].y);
    ctx.stroke();
  }
}

function drawGrid(ctx: CanvasRenderingContext2D, grid: number) {
  const w = ctx.canvas.width, h = ctx.canvas.height;
  ctx.save();
  ctx.strokeStyle = THEME.grid;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 0; x < w; x += grid) { ctx.moveTo(x, 0); ctx.lineTo(x, h); }
  for (let y = 0; y < h; y += grid) { ctx.moveTo(0, y); ctx.lineTo(w, y); }
  ctx.stroke();
  ctx.restore();
}

function strokeRect(ctx: CanvasRenderingContext2D, r: Rect) {
  ctx.strokeRect(r.x, r.y, r.w, r.h);
}
function fillRect(ctx: CanvasRenderingContext2D, r: Rect) {
  ctx.fillRect(r.x, r.y, r.w, r.h);
}
EOF

# 8) UI (필요 시 확장)
cat > src/ui/controls.ts << 'EOF'
// dom-based controls are wired in index.html (ids). This file is a placeholder for future UI logic.
export {};
EOF

# 9) 유틸
cat > src/utils/math.ts << 'EOF'
export const manhattan = (a: {x:number;y:number}, b:{x:number;y:number}) =>
  Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

export const snap = (v:number, grid:number) => Math.round(v / grid) * grid;

export const intersects = (a:{x:number;y:number;w:number;h:number}, b:{x:number;y:number;w:number;h:number}) =>
  !(a.x+a.w <= b.x || b.x+b.w <= a.x || a.y+a.h <= b.y || b.y+b.h <= a.y);
EOF

cat > src/utils/priorityQueue.ts << 'EOF'
export class PriorityQueue<T> {
  #a: T[] = [];
  constructor(private cmp: (x: T, y: T) => number) {}
  push(x: T) { this.#a.push(x); this.#siftUp(); }
  pop(): T | undefined {
    if (this.#a.length === 0) return undefined;
    const top = this.#a[0], last = this.#a.pop()!;
    if (this.#a.length) { this.#a[0] = last; this.#siftDown(); }
    return top;
  }
  get size() { return this.#a.length; }
  #siftUp() {
    let i = this.#a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.cmp(this.#a[p], this.#a[i]) <= 0) break;
      [this.#a[p], this.#a[i]] = [this.#a[i], this.#a[p]];
      i = p;
    }
  }
  #siftDown() {
    let i = 0;
    while (true) {
      let l = i*2+1, r = l+1, m = i;
      if (l < this.#a.length && this.cmp(this.#a[l], this.#a[m]) < 0) m = l;
      if (r < this.#a.length && this.cmp(this.#a[r], this.#a[m]) < 0) m = r;
      if (m === i) break;
      [this.#a[i], this.#a[m]] = [this.#a[m], this.#a[i]];
      i = m;
    }
  }
}
EOF

cat > src/utils/time.ts << 'EOF'
export const now = () => performance.now();
EOF

# 10) 테스트/문서 (자리표시자)
cat > tests/unit/pq.spec.ts << 'EOF'
// (todo) add a real test runner (vitest/jest). placeholder.
import { PriorityQueue } from '../../src/utils/priorityQueue';
const pq = new PriorityQueue<number>((a,b)=>a-b);
[pq.push(3), pq.push(1), pq.push(2)];
console.assert(pq.pop() === 1);
console.assert(pq.pop() === 2);
console.assert(pq.pop() === 3);
EOF

cat > docs/architecture.md << 'EOF'
# Architecture (Draft)
- domain: 타입/그래프 관리(불변 업데이트)
- layout: 배치→포트→라우팅→컴팩션 파이프라인
- render: Canvas 렌더(디버그 오버레이)
- ui: DOM 컨트롤
EOF

cat > docs/algorithms.md << 'EOF'
# Algorithms (Draft)
- Placement: grid-based init, overlap resolve (sweep)
- Routing: A* on grid (Manhattan + bend/obstacle/crowding)
- Compaction: simple row/col sweep
EOF

echo " 초기 스캐폴딩이 생성되었습니다! 다음을 실행하세요:
  1) npm install
  2) npm run dev
브라우저에서 http://localhost:5173 열기"
