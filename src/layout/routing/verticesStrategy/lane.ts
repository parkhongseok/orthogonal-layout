import { portPosition } from "@layout/port/assign";
import { cleanupCollinearPoints } from "../aStarStrategy/pathSmoother";
import { Graph, Point, VisibilityGraph } from "@domain/types";

/**
 * 경로들을 순회하며, 차선을 할당하고 기하학적 오류를 모두 교정
 */
export function finalizePaths(
  g: Graph,
  visibilityGraph: VisibilityGraph,
  cfg: any
): Graph {
  const out = { ...g, edges: new Map(g.edges) };
  const laneWidth = cfg.bus?.laneWidth ?? 8;

  // 1. 차선 할당 정보 계산
  const segmentUsage = new Map<string, string[]>();
  for (const edge of out.edges.values()) {
    if (!edge.vertexPath) continue;
    for (let i = 0; i < edge.vertexPath.length - 1; i++) {
      const segKey = [edge.vertexPath[i], edge.vertexPath[i + 1]]
        .sort()
        .join("-");
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

  // 2. 경로 재구성
  for (const edge of out.edges.values()) {
    if (!edge.vertexPath || !edge.path || edge.path.length < 2) continue;

    const newPath: Point[] = [];
    const vertices = visibilityGraph.vertices;
    const sourceNode = g.nodes.get(edge.sourceId)!;

    // A. 시작 포트와 첫번째 코너 연결 (포트 방향성 보장)
    const startPort = edge.path[0];
    const startPortSide = (sourceNode.ports || []).find(
      (p) =>
        Math.abs(portPosition(sourceNode, p.side, p.offset).x - startPort.x) <
          1 &&
        Math.abs(portPosition(sourceNode, p.side, p.offset).y - startPort.y) < 1
    )?.side;

    newPath.push(startPort);

    const firstVertexId = edge.vertexPath[0];
    const firstVertex = vertices[firstVertexId];
    const nextToFirstVertexId =
      edge.vertexPath.length > 1 ? edge.vertexPath[1] : null;

    let firstCornerOffsetX = 0;
    let firstCornerOffsetY = 0;
    if (nextToFirstVertexId !== null) {
      const segKey = [firstVertexId, nextToFirstVertexId].sort().join("-");
      const laneIndex = laneAssignments.get(`${edge.id}-${segKey}`)!;
      const totalLanes = segmentUsage.get(segKey)!.length;
      const offset = (laneIndex - (totalLanes - 1) / 2) * laneWidth;
      const nextToFirstVertex = vertices[nextToFirstVertexId];
      if (Math.abs(firstVertex.x - nextToFirstVertex.x) < 1)
        firstCornerOffsetX = offset; // Vertical segment
      else firstCornerOffsetY = offset; // Horizontal segment
    }
    const firstCorner = {
      x: firstVertex.x + firstCornerOffsetX,
      y: firstVertex.y + firstCornerOffsetY,
    };

    // 포트 방향성에 따라 첫 분기점을 명시적으로 생성
    if (startPortSide === "left" || startPortSide === "right") {
      // 수평으로 먼저 나가야 함
      if (Math.abs(startPort.y - firstCorner.y) > 1) {
        newPath.push({ x: firstCorner.x, y: startPort.y });
      }
    } else {
      // top or bottom
      // 수직으로 먼저 나가야 함
      if (Math.abs(startPort.x - firstCorner.x) > 1) {
        newPath.push({ x: startPort.x, y: firstCorner.y });
      }
    }
    newPath.push(firstCorner);

    // B. 중간 코너들 처리 (단일 정점 오프셋 오류 해결)
    for (let i = 1; i < edge.vertexPath.length - 1; i++) {
      const v_curr_id = edge.vertexPath[i];
      const v_prev_id = edge.vertexPath[i - 1];
      const v_next_id = edge.vertexPath[i + 1];
      const v_curr = vertices[v_curr_id];
      const v_prev = vertices[v_prev_id];
      const v_next = vertices[v_next_id];

      // 들어오는 세그먼트의 오프셋 계산
      const inSegKey = [v_prev_id, v_curr_id].sort().join("-");
      const inLaneIndex = laneAssignments.get(`${edge.id}-${inSegKey}`)!;
      const inTotalLanes = segmentUsage.get(inSegKey)!.length;
      const inOffset = (inLaneIndex - (inTotalLanes - 1) / 2) * laneWidth;

      // 나가는 세그먼트의 오프셋 계산
      const outSegKey = [v_curr_id, v_next_id].sort().join("-");
      const outLaneIndex = laneAssignments.get(`${edge.id}-${outSegKey}`)!;
      const outTotalLanes = segmentUsage.get(outSegKey)!.length;
      const outOffset = (outLaneIndex - (outTotalLanes - 1) / 2) * laneWidth;

      // 들어오는 방향과 나가는 방향을 명확히 구분하여 새 코너 생성
      const isPrevHorizontal = Math.abs(v_prev.y - v_curr.y) < 1;
      let newCornerX, newCornerY;

      if (isPrevHorizontal) {
        // Prev: H, Next: V
        newCornerX = v_curr.x + outOffset;
        newCornerY = v_curr.y + inOffset;
      } else {
        // Prev: V, Next: H
        newCornerX = v_curr.x + inOffset;
        newCornerY = v_curr.y + outOffset;
      }

      const lastPt = newPath[newPath.length - 1];
      // 직전 지점과 새 코너를 직교로 연결
      if (isPrevHorizontal) {
        if (Math.abs(lastPt.x - newCornerX) > 1)
          newPath.push({ x: newCornerX, y: lastPt.y });
      } else {
        if (Math.abs(lastPt.y - newCornerY) > 1)
          newPath.push({ x: lastPt.x, y: newCornerY });
      }

      newPath.push({ x: newCornerX, y: newCornerY });
    }

    // C. 마지막 코너와 끝 포트 연결 (A와 대칭)
    if (edge.vertexPath.length > 1) {
      const lastVertexId = edge.vertexPath[edge.vertexPath.length - 1];
      const prevToLastVertexId = edge.vertexPath[edge.vertexPath.length - 2];
      const lastVertex = vertices[lastVertexId];
      const prevToLastVertex = vertices[prevToLastVertexId];

      const segKey = [prevToLastVertexId, lastVertexId].sort().join("-");
      const laneIndex = laneAssignments.get(`${edge.id}-${segKey}`)!;
      const totalLanes = segmentUsage.get(segKey)!.length;
      const offset = (laneIndex - (totalLanes - 1) / 2) * laneWidth;

      let lastCornerOffsetX = 0,
        lastCornerOffsetY = 0;
      if (Math.abs(lastVertex.x - prevToLastVertex.x) < 1)
        lastCornerOffsetX = offset; // Vertical
      else lastCornerOffsetY = offset; // Horizontal

      const lastCorner = {
        x: lastVertex.x + lastCornerOffsetX,
        y: lastVertex.y + lastCornerOffsetY,
      };

      const lastPt = newPath[newPath.length - 1];
      const isLastSegHorizontal = Math.abs(lastPt.y - lastCorner.y) < 1;

      if (!isLastSegHorizontal && Math.abs(lastPt.x - lastCorner.x) > 1) {
        newPath.push({ x: lastCorner.x, y: lastPt.y });
      } else if (isLastSegHorizontal && Math.abs(lastPt.y - lastCorner.y) > 1) {
        newPath.push({ x: lastPt.x, y: lastCorner.y });
      }

      newPath.push(lastCorner);

      const endPort = edge.path[edge.path.length - 1];
      if (
        Math.abs(endPort.x - lastCorner.x) > 1 &&
        Math.abs(endPort.y - lastCorner.y) > 1
      ) {
        if (Math.abs(prevToLastVertex.y - lastVertex.y) < 1) {
          // 마지막 세그먼트가 수평이면
          newPath.push({ x: lastCorner.x, y: endPort.y });
        } else {
          // 마지막 세그먼트가 수직이면
          newPath.push({ x: endPort.x, y: lastCorner.y });
        }
      }
    }

    newPath.push(edge.path[edge.path.length - 1]);

    out.edges.set(edge.id, { ...edge, path: cleanupCollinearPoints(newPath) });
  }

  return out;
}
