import { busChannelId } from "@domain/id";
import type {
  Graph,
  Rect,
  BusChannel,
  Group,
  BusChannelId,
} from "@domain/types";
import { computeWorldBounds } from "@render/world";

let channelIdCounter = 0;

/**
 * 그룹 내/외부를 포함한 완전한 버스 채널 네트워크를 생성하고, 등급과 비용을 할당
 * @param g 노드 배치가 완료된 그래프
 * @param cfg 설정 객체
 * @returns 생성된 BusChannel의 배열
 */
export function createBusChannels(g: Graph, cfg: any): BusChannel[] {
  console.log("Creating bus channels...");
  const minChannelWidth = (cfg.bus?.minChannelWidth ?? 3) * cfg.gridSize;

  // --- 1단계: 최상위 레벨 (그룹 간) 채널 탐색 ---
  // 장애물 목록에 그룹뿐만 아니라 '모든' 노드를 포함하여 노드 관통을 방지
  const topLevelObstacles: Rect[] = [
    ...Array.from(g.groups.values()).map((grp) => grp.bbox),
    ...Array.from(g.nodes.values()).map((n) => n.bbox),
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
    const childrenNodes = group.children
      .map((childId) => g.nodes.get(childId)!)
      .filter(Boolean);
    if (childrenNodes.length === 0) continue;

    const groupInternalObstacles: Rect[] = childrenNodes.map((n) => n.bbox);

    // [버그 수정 #2] 탐색 영역을 그룹 전체로 확장하고 가상 벽을 제거하여,
    // 그룹 경계와 노드 사이의 공간(inset)에도 채널이 생성되도록 함
    const searchArea: Rect = group.bbox;

    const innerVertical = findCorridors(
      groupInternalObstacles,
      searchArea, // world 대신 searchArea를 사용
      "vertical",
      minChannelWidth
    );
    const innerHorizontal = findCorridors(
      groupInternalObstacles,
      searchArea, // world 대신 searchArea를 사용
      "horizontal",
      minChannelWidth
    );

    allChannels.push(...innerVertical, ...innerHorizontal);
  }

  // --- 3단계 & 4단계는 이전과 동일 ---
  const optimizedChannels = optimizeChannels(allChannels);
  const finalChannelsWithCost = assignLevelAndCost(optimizedChannels, g, cfg);

  console.log(
    `Created ${allChannels.length} raw channels, optimized to ${finalChannelsWithCost.length}.`
  );
  return finalChannelsWithCost;
}

/**
 * [신규] 채널 목록에 등급(level)과 비용(cost)을 할당
 * @param channels 등급/비용을 할당할 채널 목록
 * @param g 전체 그래프 (그룹 위치 확인용)
 * @param cfg 설정 객체
 * @returns 등급과 비용이 할당된 채널 목록
 */
function assignLevelAndCost(
  channels: BusChannel[],
  g: Graph,
  cfg: any
): BusChannel[] {
  const groups = Array.from(g.groups.values());
  const costConfig = {
    level0Weight: cfg.bus?.level0Weight ?? 1, // 간선도로 가중치
    level1Weight: cfg.bus?.level1Weight ?? 5, // 지역도로 가중치
    widthFactor: cfg.bus?.widthFactor ?? 100, // 채널 폭에 대한 비용 계수
  };

  return channels.map((channel) => {
    const center_x = channel.geometry.x + channel.geometry.w / 2;
    const center_y = channel.geometry.y + channel.geometry.h / 2;

    // 채널의 중심점이 어떤 그룹 내부에 있는지 확인하여 등급 결정
    const isInsideGroup = groups.some(
      (group) =>
        center_x >= group.bbox.x &&
        center_x <= group.bbox.x + group.bbox.w &&
        center_y >= group.bbox.y &&
        center_y <= group.bbox.y + group.bbox.h
    );

    const level = isInsideGroup ? 1 : 0; // 1: 지역도로, 0: 간선도로

    // 비용 계산: 등급 가중치 + (폭이 좁을수록 높은 페널티)
    const width =
      channel.direction === "horizontal"
        ? channel.geometry.h
        : channel.geometry.w;
    const levelWeight =
      level === 0 ? costConfig.level0Weight : costConfig.level1Weight;
    const cost = levelWeight + costConfig.widthFactor / width;

    return { ...channel, level, cost };
  });
}

/**
 * 주어진 장애물 사이의 빈 공간(Corridor)을 찾아 채널로 반환
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

  // 2. 인접한 두 경계선 사이의 '슬라이스'를 순회
  for (let i = 0; i < sortedBoundaries.length - 1; i++) {
    const start = sortedBoundaries[i];
    const end = sortedBoundaries[i + 1];

    if (end - start < minSize) continue;

    // 3. 해당 슬라이스와 교차하는 장애물 탐색
    const intersectingObs = obstacles
      .filter((obs) =>
        isVertical
          ? obs.x < end && obs.x + obs.w > start
          : obs.y < end && obs.y + obs.h > start
      )
      .sort((a, b) => (isVertical ? a.y : a.x) - (isVertical ? b.y : b.x));

    // 4. 장애물 사이의 빈 공간을 찾아 채널로 추가
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
/**
 * 생성된 채널 목록을 최적화
 * 1. 다른 채널에 완전히 포함되는 중복 채널을 제거
 * 2. 인접하거나 겹치는 채널들을 하나로 통합
 * @param channels 최적화할 BusChannel 배열
 * @returns 최적화된 BusChannel 배열
 */
function optimizeChannels(channels: BusChannel[]): BusChannel[] {
  // 1. 방향에 따라 채널을 분리
  const horizontals = channels.filter((c) => c.direction === "horizontal");
  const verticals = channels.filter((c) => c.direction === "vertical");

  // 2. 각 방향별로 채널 통합을 수행
  const mergedHorizontals = mergeChannels(horizontals);
  const mergedVerticals = mergeChannels(verticals);

  // 3. 통합된 채널 목록을 합치고, 중복 포함 관계를 마지막으로 정리
  let combined = [...mergedHorizontals, ...mergedVerticals];

  const finalChannels: BusChannel[] = [];
  combined.sort(
    (a, b) => b.geometry.w * b.geometry.h - a.geometry.w * a.geometry.h
  );

  for (const current of combined) {
    let isContained = false;
    for (const bigger of finalChannels) {
      const curGeom = current.geometry;
      const bigGeom = bigger.geometry;
      if (
        curGeom.x >= bigGeom.x &&
        curGeom.y >= bigGeom.y &&
        curGeom.x + curGeom.w <= bigGeom.x + bigGeom.w &&
        curGeom.y + curGeom.h <= bigGeom.y + bigGeom.h
      ) {
        isContained = true;
        break;
      }
    }
    if (!isContained) {
      finalChannels.push(current);
    }
  }

  // 4. 최종 ID를 재할당하여 반환
  return finalChannels.map((ch, i) => ({ ...ch, id: busChannelId(i) }));
}

/**
 * 동일한 방향의 채널 목록을 받아, 합칠 수 있는 채널들을 모두 통합
 * @param channels 동일한 방향을 가진 BusChannel 배열
 * @returns 통합된 BusChannel 배열
 */
function mergeChannels(channels: BusChannel[]): BusChannel[] {
  let merged = [...channels];
  let wasChanged = true;

  while (wasChanged) {
    wasChanged = false;
    const nextMerged: BusChannel[] = [];
    const consumed = new Set<BusChannelId>(); // 이미 통합된 채널을 추적

    for (let i = 0; i < merged.length; i++) {
      if (consumed.has(merged[i].id)) continue;

      let current = { ...merged[i] };

      for (let j = i + 1; j < merged.length; j++) {
        if (consumed.has(merged[j].id)) continue;

        const other = merged[j];
        const canMerge =
          current.direction === "horizontal"
            ? // 수평 채널 통합 조건: y축 범위가 겹치고 x축이 인접/겹침
              Math.max(current.geometry.y, other.geometry.y) <
                Math.min(
                  current.geometry.y + current.geometry.h,
                  other.geometry.y + other.geometry.h
                ) &&
              Math.max(current.geometry.x, other.geometry.x) <=
                Math.min(
                  current.geometry.x + current.geometry.w,
                  other.geometry.x + other.geometry.w
                )
            : // 수직 채널 통합 조건: x축 범위가 겹치고 y축이 인접/겹침
              Math.max(current.geometry.x, other.geometry.x) <
                Math.min(
                  current.geometry.x + current.geometry.w,
                  other.geometry.x + other.geometry.w
                ) &&
              Math.max(current.geometry.y, other.geometry.y) <=
                Math.min(
                  current.geometry.y + current.geometry.h,
                  other.geometry.y + other.geometry.h
                );

        if (canMerge) {
          // 두 채널을 포함하는 새로운 경계 상자를 계산
          const minX = Math.min(current.geometry.x, other.geometry.x);
          const minY = Math.min(current.geometry.y, other.geometry.y);
          const maxX = Math.max(
            current.geometry.x + current.geometry.w,
            other.geometry.x + other.geometry.w
          );
          const maxY = Math.max(
            current.geometry.y + current.geometry.h,
            other.geometry.y + other.geometry.h
          );
          current.geometry = {
            x: minX,
            y: minY,
            w: maxX - minX,
            h: maxY - minY,
          };

          consumed.add(other.id); // 'other' 채널은 'current'에 통합되었으므로 소모 처리
          wasChanged = true;
        }
      }
      nextMerged.push(current);
    }
    merged = nextMerged;
  }
  return merged;
}

/**
 * BusChannel 객체를 생성하고 고유 ID를 부여
 */
function createChannel(
  x: number,
  y: number,
  w: number,
  h: number,
  direction: "vertical" | "horizontal"
): BusChannel {
  return {
    id: busChannelId(channelIdCounter++),
    geometry: { x, y, w, h },
    direction,
    lanes: new Map(),
  };
}
