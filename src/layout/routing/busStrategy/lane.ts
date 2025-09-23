import type { Graph, Point, VisibilityGraph } from "@domain/types";
import { cleanupCollinearPoints } from "@layout/routing/aStarStrategy/pathSmoother";

/**
 * [최종 개선] 라우팅이 완료된 경로들을 순회하며, 겹치는 경로 세그먼트에 '차선'을 할당하여 시각적으로 분리합니다.
 * 이 함수는 오프셋 적용 시 직교성이 깨지지 않도록 중간점을 추가하여 경로를 재구성합니다.
 */
export function finalizePaths(g: Graph, visibilityGraph: VisibilityGraph, cfg: any): Graph {
  const out = { ...g, edges: new Map(g.edges) };
  const laneWidth = cfg.bus?.laneWidth ?? 8;

  // 1. 차선 할당 정보 계산 (이전과 동일)
  const segmentUsage = new Map<string, string[]>();
  for (const edge of out.edges.values()) {
    if (!edge.vertexPath) continue;
    for (let i = 0; i < edge.vertexPath.length - 1; i++) {
      const segKey = [edge.vertexPath[i], edge.vertexPath[i + 1]].sort().join('-');
      if (!segmentUsage.has(segKey)) segmentUsage.set(segKey, []);
      segmentUsage.get(segKey)!.push(edge.id);
    }
  }
  const laneAssignments = new Map<string, number>();
  segmentUsage.forEach((edgeIds, segKey) => {
    edgeIds.sort();
    edgeIds.forEach((edgeId, index) => {
      laneAssignments.set(`${edgeId}-${segKey}`, index);
    });
  });

  // 2. 경로 재구성 (오프셋 로직을 버그 없이 재작성)
  for (const edge of out.edges.values()) {
    if (!edge.vertexPath || !edge.path || edge.path.length < 2) continue;

    const newPath: Point[] = [];
    const vertices = visibilityGraph.vertices;

    // A. 시작 포트와 첫번째 코너 연결
    const startPort = edge.path[0];
    newPath.push(startPort);

    const firstVertexId = edge.vertexPath[0];
    const firstVertex = vertices[firstVertexId];
    const nextToFirstVertexId = edge.vertexPath.length > 1 ? edge.vertexPath[1] : null;

    let firstCornerOffsetX = 0;
    let firstCornerOffsetY = 0;
    if (nextToFirstVertexId !== null) {
      const segKey = [firstVertexId, nextToFirstVertexId].sort().join("-");
      const laneIndex = laneAssignments.get(`${edge.id}-${segKey}`)!;
      const totalLanes = segmentUsage.get(segKey)!.length;
      const offset = (laneIndex - (totalLanes - 1) / 2) * laneWidth;
      const nextToFirstVertex = vertices[nextToFirstVertexId];
      if (Math.abs(firstVertex.x - nextToFirstVertex.x) < 1)
        firstCornerOffsetX = offset;
      else firstCornerOffsetY = offset;
    }
    const firstCorner = {
      x: firstVertex.x + firstCornerOffsetX,
      y: firstVertex.y + firstCornerOffsetY,
    };

    // 포트와 첫 코너를 직교로 연결 (중간점 추가)
    if (
      Math.abs(startPort.x - firstCorner.x) > 1 &&
      Math.abs(startPort.y - firstCorner.y) > 1
    ) {
      const p1 = edge.path[1]; // 라우터가 생성한 첫번째 중간점
      if (Math.abs(startPort.y - p1.y) < 1) { // 시작이 수평이면
        newPath.push({ x: firstCorner.x, y: startPort.y });
      } else { // 시작이 수직이면
        newPath.push({ x: startPort.x, y: firstCorner.y });
      }
    }
    newPath.push(firstCorner);

    // B. 중간 코너들 처리
    for (let i = 1; i < edge.vertexPath.length - 1; i++) {
      const v_curr_id = edge.vertexPath[i];
      const v_prev_id = edge.vertexPath[i-1];
      const v_next_id = edge.vertexPath[i+1];
      const v_curr = vertices[v_curr_id];
      const v_prev = vertices[v_prev_id];
      const v_next = vertices[v_next_id];

      let offsetX = 0;
      let offsetY = 0;

      // 들어오는 경로의 오프셋
      const inSegKey = [v_prev_id, v_curr_id].sort().join("-");
      const inLaneIndex = laneAssignments.get(`${edge.id}-${inSegKey}`)!;
      const inTotalLanes = segmentUsage.get(inSegKey)!.length;
      const inOffset = (inLaneIndex - (inTotalLanes - 1) / 2) * laneWidth;
      if (Math.abs(v_prev.x - v_curr.x) < 1) offsetX = inOffset;
      else offsetY = inOffset;

      // 나가는 경로의 오프셋
      const outSegKey = [v_curr_id, v_next_id].sort().join("-");
      const outLaneIndex = laneAssignments.get(`${edge.id}-${outSegKey}`)!;
      const outTotalLanes = segmentUsage.get(outSegKey)!.length;
      const outOffset = (outLaneIndex - (outTotalLanes - 1) / 2) * laneWidth;
      if (Math.abs(v_curr.x - v_next.x) < 1) offsetX = outOffset;
      else offsetY = outOffset;

      newPath.push({ x: v_curr.x + offsetX, y: v_curr.y + offsetY });
    }

    // C. 마지막 코너와 끝 포트 연결
    if (edge.vertexPath.length > 1) {
      const lastVertexId = edge.vertexPath[edge.vertexPath.length - 1];
      const lastVertex = vertices[lastVertexId];
      const prevToLastVertexId = edge.vertexPath[edge.vertexPath.length - 2];

      let lastCornerOffsetX = 0;
      let lastCornerOffsetY = 0;
      const segKey = [prevToLastVertexId, lastVertexId].sort().join("-");
      const laneIndex = laneAssignments.get(`${edge.id}-${segKey}`)!;
      const totalLanes = segmentUsage.get(segKey)!.length;
      const offset = (laneIndex - (totalLanes - 1) / 2) * laneWidth;
      const prevToLastVertex = vertices[prevToLastVertexId];
      if (Math.abs(lastVertex.x - prevToLastVertex.x) < 1)
        lastCornerOffsetX = offset;
      else lastCornerOffsetY = offset;

      const lastCorner = {
        x: lastVertex.x + lastCornerOffsetX,
        y: lastVertex.y + lastCornerOffsetY,
      };
      newPath.push(lastCorner);

      const endPort = edge.path[edge.path.length - 1];
      if (
        Math.abs(endPort.x - lastCorner.x) > 1 &&
        Math.abs(endPort.y - lastCorner.y) > 1
      ) {
        if (Math.abs(prevToLastVertex.y - lastVertex.y) < 1) { // 마지막 세그먼트가 수평이면
          newPath.push({ x: lastCorner.x, y: endPort.y });
        } else { // 마지막 세그먼트가 수직이면
          newPath.push({ x: endPort.x, y: lastCorner.y });
        }
      }
    }

    newPath.push(edge.path[edge.path.length - 1]);
    
    out.edges.set(edge.id, { ...edge, path: cleanupCollinearPoints(newPath) });
  }

  return out;
}