import type { Graph } from "@domain/types";

export function spreadPorts(g: Graph, cfg: any): Graph {
  // TODO: 같은 면의 포트를 균등 간격으로 분산
  /**
   * spread(g, cfg)
   *
   * 목적:
   *  - 초기 배치(initialPlacement)와 겹침해소(resolveOverlap) 이후,
   *    그룹/노드 사이 간격을 미세하게 펴서(컴팩션/스프레드) 미적 품질을 높인다.
   *
   * 언제 필요한가:
   *  - 그룹 간 박스가 가까워 보이거나, 루트 레벨 노드가 가로/세로로 너무 빽빽할 때
   *  - 레이아웃만으로는 빈 공간이 들쭉날쭉할 때(‘격자 정렬’은 맞지만 보기 답답)
   *  - 대규모 N에서, resolveOverlap이 충돌만 없앴지 배치 품질은 낮을 때
   *
   * 전후 관계(권장 파이프라인):
   *  initialPlacement → resolveOverlap → [spread] → assignPorts → routing
   *
   * 입력/출력:
   *  - 입력: Graph (노드/그룹 bbox는 확정된 상태)
   *  - 출력: Graph (bbox만 소폭 이동; 위상/연결/크기는 불변)
   *
   * 구현 아이디어(추후):
   *  - 최소 간격 유지: cfg.layout.nodeGapX/Y, groupGapX/Y 준수
   *  - 행/열 기준의 타일 ‘컴팩션’ (좌→우, 상→하 스윕으로 빈 칸 채우기)
   *  - 그룹 레벨 우선 정렬 후, 루트 레벨 노드 별도 스프레드
   *  - 반복 횟수, 이동 한계치(최대 이동량), 스냅 유지
   *
   * 주의:
   *  - bbox를 움직인 후에는 그룹 bbox 재계산 필요(updateGroupBBox)
   *  - 카메라 Fit/TopLeft 등 뷰 맞춤은 렌더 단계에서 처리
   */
  return g;
}
