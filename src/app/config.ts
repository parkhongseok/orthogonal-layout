import { group } from "console";

export const CONFIG = {
  gridSize: 12, // px
  portPerSide: 4, // 면당 기본 포트 후보 수
  cost: {
    distance: 1,
    bend: 5,
    obstacle: 100,
    congestion: 2,
  },
  routing: {
    bboxExpand: 3, // 바운딩 박스 확장(그리드셀 단위)
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
