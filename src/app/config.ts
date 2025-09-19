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
