import type { Graph, Point, VisibilityGraph } from "@domain/types"; // VisibilityGraph 임포트
import { cleanupCollinearPoints } from "@layout/routing/aStarStrategy/pathSmoother";

/**
 * [최종 개선] 라우팅이 완료된 경로들을 순회하며, 겹치는 경로 세그먼트에 '차선'을 할당하여 시각적으로 분리합니다.
 */
export function separatedPaths(
  g: Graph,
  visibilityGraph: VisibilityGraph | null,
  cfg: any
): Graph {
  if (!visibilityGraph) {
    console.warn("Visibility graph not available for beautifying paths.");
    return g;
  }

  const out = { ...g, edges: new Map(g.edges) };
  const laneWidth = cfg.bus?.laneWidth ?? 8;

  // 가시성 그래프의 모든 간선에 대해 차선 정보를 계산합니다.
  for (const [edgeKey, usage] of visibilityGraph.edgeUsage.entries()) {
    if (usage < 2) continue; // 엣지가 2개 이상 지나간 간선만 처리

    const [v1Id, v2Id] = edgeKey.split("-").map(Number);
    const v1 = visibilityGraph.vertices[v1Id];
    const v2 = visibilityGraph.vertices[v2Id];

    if (!v1 || !v2) continue; // 안전장치

    const isHorizontal = Math.abs(v1.y - v2.y) < 1;

    const totalWidth = (usage - 1) * laneWidth;
    const startOffset = -totalWidth / 2;

    let laneCounter = 0;
    // 이 간선을 사용한 모든 엣지를 찾아서 경로를 수정합니다.
    for (const edge of out.edges.values()) {
      if (!edge.path) continue;

      // 엣지의 경로에서 이 간선(v1-v2) 부분을 찾습니다.
      for (let i = 0; i < edge.path.length - 1; i++) {
        const p1 = edge.path[i];
        const p2 = edge.path[i + 1];

        // 정점 v1, v2와 거의 일치하는 경로 세그먼트를 찾습니다.
        const isMatch =
          (Math.abs(p1.x - v1.x) < 1 &&
            Math.abs(p1.y - v1.y) < 1 &&
            Math.abs(p2.x - v2.x) < 1 &&
            Math.abs(p2.y - v2.y) < 1) ||
          (Math.abs(p1.x - v2.x) < 1 &&
            Math.abs(p1.y - v2.y) < 1 &&
            Math.abs(p2.x - v1.x) < 1 &&
            Math.abs(p2.y - v1.y) < 1);

        if (isMatch) {
          const offset = startOffset + laneCounter * laneWidth;
          if (offset === 0) {
            // 중앙 차선은 수정할 필요 없음
            laneCounter++;
            continue;
          }

          const newPath = [...edge.path];

          if (isHorizontal) {
            newPath[i] = { ...p1, y: p1.y + offset };
            newPath[i + 1] = { ...p2, y: p2.y + offset };
          } else {
            // Vertical
            newPath[i] = { ...p1, x: p1.x + offset };
            newPath[i + 1] = { ...p2, x: p2.x + offset };
          }

          // // 꺾이는 부분도 자연스럽게 연결되도록 앞/뒤 포인트를 조정합니다.
          // if (i > 0) {
          //   const prevPoint = newPath[i - 1];
          //   if (isHorizontal)
          //     newPath[i - 1] = { ...prevPoint, y: newPath[i].y };
          //   else newPath[i - 1] = { ...prevPoint, x: newPath[i].x };
          // }
          // if (i < newPath.length - 2) {
          //   const nextPoint = newPath[i + 2];
          //   if (isHorizontal)
          //     newPath[i + 2] = { ...nextPoint, y: newPath[i + 1].y };
          //   else newPath[i + 2] = { ...nextPoint, x: newPath[i + 1].x };
          // }

          out.edges.set(edge.id, {
            ...edge,
            path: cleanupCollinearPoints(newPath),
          });
          laneCounter++;
          break; // 한 엣지당 한 번만 수정
        }
      }
    }
  }

  return out;
}

export function finalizePaths(g: Graph, visibilityGraph: VisibilityGraph, cfg: any): Graph {
  const out = { ...g, edges: new Map(g.edges) };
  const laneWidth = cfg.bus?.laneWidth ?? 8;

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
    edgeIds.sort(); // ID 기준 정렬로 차선 할당 순서 고정
    edgeIds.forEach((edgeId, index) => {
      laneAssignments.set(`${edgeId}-${segKey}`, index);
    });
  });

  for (const edge of out.edges.values()) {
    if (!edge.vertexPath || edge.vertexPath.length < 1 || !edge.path) continue;

    const newPath: Point[] = [edge.path[0]]; // 1. 시작 포트
    const vertices = visibilityGraph.vertices;

    for (let i = 0; i < edge.vertexPath.length; i++) {
      const v_curr_id = edge.vertexPath[i];
      const v_prev_id = i > 0 ? edge.vertexPath[i - 1] : null;
      const v_next_id = i < edge.vertexPath.length - 1 ? edge.vertexPath[i + 1] : null;

      const v_curr = vertices[v_curr_id];
      let offsetX = 0, offsetY = 0;

      if (v_prev_id !== null) {
        const segKey = [v_prev_id, v_curr_id].sort().join('-');
        const laneIndex = laneAssignments.get(`${edge.id}-${segKey}`)!;
        const totalLanes = segmentUsage.get(segKey)!.length;
        const offset = (laneIndex - (totalLanes - 1) / 2) * laneWidth;
        const v_prev = vertices[v_prev_id];
        if (Math.abs(v_prev.y - v_curr.y) < 1) offsetY = offset;
        else offsetX = offset;
      }
      
      if (v_next_id !== null) {
        const segKey = [v_curr_id, v_next_id].sort().join('-');
        const laneIndex = laneAssignments.get(`${edge.id}-${segKey}`)!;
        const totalLanes = segmentUsage.get(segKey)!.length;
        const offset = (laneIndex - (totalLanes - 1) / 2) * laneWidth;
        const v_next = vertices[v_next_id];
        if (Math.abs(v_curr.y - v_next.y) < 1) offsetY = offset;
        else offsetX = offset;
      }
      
      const cornerPoint = { x: v_curr.x + offsetX, y: v_curr.y + offsetY };
      const lastPoint = newPath[newPath.length - 1];

      // 2. 직교 연결점 추가
      if (Math.abs(lastPoint.x - cornerPoint.x) > 1 && Math.abs(lastPoint.y - cornerPoint.y) > 1) {
        // ✅ 런타임 에러 해결: 이전 세그먼트의 방향을 안전하게 결정
        let lastSegmentWasHorizontal;
        if (i === 0) {
          const p1 = edge.path[1];
          lastSegmentWasHorizontal = Math.abs(lastPoint.y - p1.y) < 1;
        } else {
          const v_prev = vertices[edge.vertexPath[i-1]];
          lastSegmentWasHorizontal = Math.abs(v_prev.y - v_curr.y) < 1;
        }

        if (lastSegmentWasHorizontal) {
          newPath.push({ x: cornerPoint.x, y: lastPoint.y });
        } else {
          newPath.push({ x: lastPoint.x, y: cornerPoint.y });
        }
      }
      
      // 3. 오프셋이 적용된 코너
      newPath.push(cornerPoint);
    }
    
    // 4. 끝 포트
    const finalPort = edge.path[edge.path.length - 1];
    const lastCorner = newPath[newPath.length - 1];

    if (Math.abs(lastCorner.x - finalPort.x) > 1 && Math.abs(lastCorner.y - finalPort.y) > 1) {
        const v_last_id = edge.vertexPath[edge.vertexPath.length - 1];
        const v_second_last_id = edge.vertexPath[edge.vertexPath.length - 2];
        const v_last = vertices[v_last_id];
        const v_second_last = vertices[v_second_last_id];
        if (Math.abs(v_second_last.y - v_last.y) < 1) {
             newPath.push({ x: lastCorner.x, y: finalPort.y });
        } else {
             newPath.push({ x: finalPort.x, y: lastCorner.y });
        }
    }
    newPath.push(finalPort);
    
    out.edges.set(edge.id, { ...edge, path: cleanupCollinearPoints(newPath) });
  }

  return out;
}