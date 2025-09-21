export const CONFIG = {
  gridSize: 12, // px
  portPerSide: 6, // 면당 기본 포트 후보 수
  cost: {
    distance: 3, // 1칸 이동 비용
    bend: 40, // 1번 꺾는 비용 (거리 50칸을 손해 보는 것과 같음)
    obstacle: 1000,
    congestion: 100, // 이미 다른 엣지가 지나간 길을 피하는 비용
  },
  routing: {
    bboxExpand: 1, // 바운딩 박스 확장(그리드셀 단위)
    maxExpandSteps: 3,
  },

  layout: {
    nodeGapX: 4, // 노드 간 가로 간격(격자 셀 수)
    nodeGapY: 4, // 노드 간 세로 간격(격자 셀 수)
    groupInset: 4, // 그룹 안쪽 여백(격자 셀 수)
    groupGapX: 8,
    groupGapY: 8,
    spreadIterations: 20, // 스프레드 반복 횟수
    spreadStep: 0.5, // 1이면 한 번에, 0.2면 서서히
  },
};
