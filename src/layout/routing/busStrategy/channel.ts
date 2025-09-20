import type { Graph, Rect, BusChannel, Node, Group } from "@domain/types";
import { computeWorldBounds } from "@render/world";

let channelIdCounter = 0;

/**
 * 노드와 그룹 사이의 빈 공간을 분석하여 수평/수직의 BusChannel들을 생성합니다.
 * @param g 노드 배치가 완료된 그래프
 * @param cfg 설정 객체
 * @returns 생성된 BusChannel의 배열
 */
/**
 * [수정] 계층적으로 채널을 탐색하도록 변경합니다.
 */
export function createBusChannels(g: Graph, cfg: any): BusChannel[] {
  console.log("Creating bus channels...");
  const minChannelWidth = (cfg.bus?.minChannelWidth ?? 3) * cfg.gridSize;

  // --- 1단계: 최상위 레벨 (그룹 간) 채널 탐색 ---
  const topLevelObstacles: Rect[] = [
    ...Array.from(g.groups.values()).map((grp) => grp.bbox),
    ...Array.from(g.nodes.values())
      .filter((n) => !n.groupId)
      .map((n) => n.bbox),
  ];
  const world = computeWorldBounds(g);

  const topLevelVertical = findCorridors(
    topLevelObstacles,
    world,
    "vertical",
    minChannelWidth
  );
  const topLevelHorizontal = findCorridors(
    topLevelObstacles,
    world,
    "horizontal",
    minChannelWidth
  );

  let allChannels = [...topLevelVertical, ...topLevelHorizontal];

  // --- 2단계: 각 그룹 내부 채널 탐색 ---
  for (const group of g.groups.values()) {
    const childrenNodes = group.children.map(
      (childId) => g.nodes.get(childId)!
    );
    if (childrenNodes.length < 2) continue; // 노드가 2개 미만이면 내부 채널 의미 없음

    const groupInternalObstacles = childrenNodes.map((n) => n.bbox);

    // 그룹 내부를 하나의 작은 'world'로 간주하여 탐색
    const inset = (cfg.layout?.groupInset ?? 2) * cfg.gridSize;
    const groupWorld: Rect = {
      x: group.bbox.x + inset,
      y: group.bbox.y + inset,
      w: group.bbox.w - inset * 2,
      h: group.bbox.h - inset * 2,
    };

    const innerVertical = findCorridors(
      groupInternalObstacles,
      groupWorld,
      "vertical",
      minChannelWidth
    );
    const innerHorizontal = findCorridors(
      groupInternalObstacles,
      groupWorld,
      "horizontal",
      minChannelWidth
    );

    allChannels.push(...innerVertical, ...innerHorizontal);
  }
  const optimizedChannels = optimizeChannels(allChannels);

  console.log(
    `Created ${allChannels.length} raw channels, optimized to ${optimizedChannels.length}.`
  );
  return optimizedChannels;
}

/**
 * 주어진 장애물 사이의 빈 공간(Corridor)을 찾아 채널로 반환합니다.
 * @param obstacles 모든 노드와 그룹의 bbox 배열
 * @param world 전체 그래프 영역
 * @param direction 수직('vertical') 또는 수평('horizontal') 채널 탐색 방향
 * @param minSize 채널로 인정할 최소 폭 또는 높이
 */
function findCorridors(
  obstacles: Rect[],
  world: Rect,
  direction: "vertical" | "horizontal",
  minSize: number
): BusChannel[] {
  const isVertical = direction === "vertical";

  // 1. 모든 장애물의 경계선을 추출하고 정렬합니다.
  const boundaries = new Set<number>();
  boundaries.add(isVertical ? world.x : world.y);
  for (const obs of obstacles) {
    boundaries.add(isVertical ? obs.x : obs.y);
    boundaries.add(isVertical ? obs.x + obs.w : obs.y + obs.h);
  }
  boundaries.add(isVertical ? world.x + world.w : world.y + world.h);

  const sortedBoundaries = Array.from(boundaries).sort((a, b) => a - b);

  const corridors: BusChannel[] = [];

  // 2. 인접한 두 경계선 사이의 '슬라이스'를 순회합니다.
  for (let i = 0; i < sortedBoundaries.length - 1; i++) {
    const start = sortedBoundaries[i];
    const end = sortedBoundaries[i + 1];
    const mid = start + (end - start) / 2;

    if (end - start < minSize) continue;

    // 3. 해당 슬라이스와 교차하는 장애물을 찾습니다.
    const intersectingObs = obstacles
      .filter((obs) =>
        isVertical
          ? obs.x < end && obs.x + obs.w > start
          : obs.y < end && obs.y + obs.h > start
      )
      .sort((a, b) => (isVertical ? a.y : a.x) - (isVertical ? b.y : b.x));

    // 4. 장애물 사이의 빈 공간을 찾아 채널로 추가합니다.
    let currentPos = isVertical ? world.y : world.x;
    const worldEnd = isVertical ? world.y + world.h : world.x + world.w;

    for (const obs of intersectingObs) {
      const obsStart = isVertical ? obs.y : obs.x;
      if (obsStart > currentPos && obsStart - currentPos >= minSize) {
        corridors.push(
          createChannel(
            isVertical ? start : currentPos,
            isVertical ? currentPos : start,
            isVertical ? end - start : obsStart - currentPos,
            isVertical ? obsStart - currentPos : end - start,
            direction
          )
        );
      }
      currentPos = Math.max(
        currentPos,
        isVertical ? obs.y + obs.h : obs.x + obs.w
      );
    }

    if (worldEnd > currentPos && worldEnd - currentPos >= minSize) {
      corridors.push(
        createChannel(
          isVertical ? start : currentPos,
          isVertical ? currentPos : start,
          isVertical ? end - start : worldEnd - currentPos,
          isVertical ? worldEnd - currentPos : end - start,
          direction
        )
      );
    }
  }

  return corridors;
}

function createChannel(
  x: number,
  y: number,
  w: number,
  h: number,
  direction: "vertical" | "horizontal"
): BusChannel {
  return {
    id: `ch-${channelIdCounter++}`,
    geometry: { x, y, w, h },
    direction,
  };
}
/**
 * [신규] 생성된 채널 목록을 최적화합니다.
 * - 다른 채널에 완전히 포함되는 중복 채널을 제거합니다.
 */
function optimizeChannels(channels: BusChannel[]): BusChannel[] {
  const optimized: BusChannel[] = [];

  // 채널을 크기(면적)의 내림차순으로 정렬합니다.
  channels.sort(
    (a, b) => b.geometry.w * b.geometry.h - a.geometry.w * a.geometry.h
  );

  for (const currentChannel of channels) {
    let isContained = false;
    // 현재 채널이 이미 추가된 더 큰 채널에 포함되는지 확인합니다.
    for (const biggerChannel of optimized) {
      const cur = currentChannel.geometry;
      const big = biggerChannel.geometry;
      if (
        cur.x >= big.x &&
        cur.y >= big.y &&
        cur.x + cur.w <= big.x + big.w &&
        cur.y + cur.h <= big.y + big.h
      ) {
        isContained = true;
        break;
      }
    }

    if (!isContained) {
      optimized.push(currentChannel);
    }
  }

  // ID를 재정렬하여 반환합니다.
  return optimized.map((ch, i) => ({ ...ch, id: `ch-${i}` }));
}
