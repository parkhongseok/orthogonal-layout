import type { Node, PortSide, Point } from "@domain/types";
import { portPosition } from "@layout/port/assign";

function center(n: Node) {
  return { x: n.bbox.x + n.bbox.w / 2, y: n.bbox.y + n.bbox.h / 2 };
}
// [수정] 두 노드의 상대 위치에 따라 가능한 연결 면(side) 조합을 반환합니다.
export function getCandidateSides(a: Node, b: Node): [PortSide, PortSide][] {
  const ca = center(a),
    cb = center(b);
  const dx = cb.x - ca.x,
    dy = cb.y - ca.y;

  if (Math.abs(dx) > Math.abs(dy)) {
    // 주로 수평 관계일 때
    const primary: [PortSide, PortSide] =
      ca.x < cb.x ? ["right", "left"] : ["left", "right"];
    return [
      primary, // 1순위: 가장 직접적인 연결 (예: right -> left)
      ["top", "top"], // 2순위 후보군
      ["bottom", "bottom"],
      [primary[0], "top"], // 3순위 후보군 (다양성 확보)
      [primary[0], "bottom"],
      ["top", primary[1]],
      ["bottom", primary[1]],
    ];
  } else {
    // 주로 수직 관계일 때
    const primary: [PortSide, PortSide] =
      ca.y < cb.y ? ["bottom", "top"] : ["top", "bottom"];
    return [
      primary, // 1순위: 가장 직접적인 연결 (예: bottom -> top)
      ["right", "right"], // 2순위 후보군
      ["left", "left"],
      [primary[0], "left"], // 3순위 후보군 (다양성 확보)
      [primary[0], "right"],
      ["left", primary[1]],
      ["right", primary[1]],
    ];
  }
}

/**
 * 두 노드를 연결할 최적의 포트 '쌍'을 찾습니다.
 * @returns { sourcePort: Point, targetPort: Point, sourceSide: PortSide, targetSide: PortSide }
 */
export function findBestPortPair(sourceNode: Node, targetNode: Node) {
  const candidateSides = getCandidateSides(sourceNode, targetNode);
  let bestPair = null;
  let minCost = Infinity;

  for (const [sourceSide, targetSide] of candidateSides) {
    const sourcePorts = (sourceNode.ports || []).filter(
      (p) => p.side === sourceSide
    );
    const targetPorts = (targetNode.ports || []).filter(
      (p) => p.side === targetSide
    );
    if (sourcePorts.length === 0 || targetPorts.length === 0) continue;

    for (const sPortInfo of sourcePorts) {
      for (const tPortInfo of targetPorts) {
        const sPos = portPosition(sourceNode, sPortInfo.side, sPortInfo.offset);
        const tPos = portPosition(targetNode, tPortInfo.side, tPortInfo.offset);

        // 비용 = 맨해튼 거리 + (축이 어긋난 정도 * 페널티)
        // 이 비용 함수가 좋은 포트 선택의 핵심입니다.
        const distance = Math.abs(sPos.x - tPos.x) + Math.abs(sPos.y - tPos.y);
        let alignmentPenalty = 0;
        if (sourceSide === "left" || sourceSide === "right") {
          alignmentPenalty = Math.abs(sPos.y - tPos.y) * 2; // Y축이 어긋날수록 페널티
        } else {
          alignmentPenalty = Math.abs(sPos.x - tPos.x) * 2; // X축이 어긋날수록 페널티
        }

        const cost = distance + alignmentPenalty;

        if (cost < minCost) {
          minCost = cost;
          bestPair = {
            sourcePort: sPos,
            targetPort: tPos,
            sourceSide: sourceSide,
            targetSide: targetSide,
          };
        }
      }
    }
  }

  // 만약 적절한 포트 쌍을 찾지 못하면, 노드 중앙을 사용합니다.
  if (!bestPair) {
    const sSide = candidateSides[0][0];
    const tSide = candidateSides[0][1];
    return {
      sourcePort: center(sourceNode),
      targetPort: center(targetNode),
      sourceSide: sSide,
      targetSide: tSide,
    };
  }

  return bestPair;
}
