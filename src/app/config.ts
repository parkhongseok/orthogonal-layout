import { group } from "console";

export const CONFIG = {
  gridSize: 12, // px
  portPerSide: 4, // 면당 기본 포트 후보 수
  cost: {
    // [핵심 튜닝] 굴곡 비용을 거리 비용보다 훨씬 높게 설정합니다.
    distance: 1, // 1칸 이동 비용
    bend: 50, // 1번 꺾는 비용 (거리 50칸을 손해 보는 것과 같음)

    // [핵심 튜닝] 혼잡도와 장애물 비용을 매우 높게 설정합니다.
    obstacle: 1000, // (현재 코드에선 미사용하나 개념적으로 중요)
    congestion: 200, // 이미 다른 엣지가 지나간 길을 피하는 비용
  },
  routing: {
    bboxExpand: 1, // 바운딩 박스 확장(그리드셀 단위)
    maxExpandSteps: 3,
  },

  layout: {
    nodeGapX: 2, // 노드 간 가로 간격(격자 셀 수)
    nodeGapY: 2, // 노드 간 세로 간격(격자 셀 수)
    groupInset: 2, // 그룹 안쪽 여백(격자 셀 수)
    groupGapX: 6,
    groupGapY: 6,
    spreadIterations: 20, // 스프레드 반복 횟수
    spreadStep: 0.5, // 1이면 한 번에, 0.2면 서서히
  },
};
