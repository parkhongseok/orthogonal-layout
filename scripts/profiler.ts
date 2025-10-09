/**
 * 코드 블록의 실행 시간을 측정하기 위한 간단한 프로파일러 유틸리티.
 * performance.now()를 사용하여 마이크로초 단위의 정밀한 시간 측정을 지원합니다.
 */
export class Profiler {
  // 각 측정 항목의 시작 시간을 기록하는 Map
  private startTimeMap: Map<string, number> = new Map();
  // 측정된 최종 실행 시간(ms)을 기록하는 Map
  private durations: Map<string, number> = new Map();

  /**
   * 지정된 이름으로 시간 측정을 시작합니다.
   * @param name - 측정 항목의 고유 이름 (예: 'initialPlacement')
   */
  public start(name: string): void {
    this.startTimeMap.set(name, performance.now());
  }

  /**
   * 지정된 이름의 시간 측정을 중지하고, 실행 시간을 기록합니다.
   * start()가 먼저 호출되어야 합니다.
   * @param name - 측정 항목의 고유 이름
   */
  public stop(name: string): void {
    const startTime = this.startTimeMap.get(name);
    if (startTime === undefined) {
      console.warn(`Profiler: stop('${name}') called without start.`);
      return;
    }

    const duration = performance.now() - startTime;
    const accumulatedTime = (this.durations.get(name) || 0) + duration;
    this.durations.set(name, accumulatedTime);
    this.startTimeMap.delete(name); // 시작 시간 기록 삭제
  }

  /**
   * 측정된 모든 결과를 Map 형태로 반환합니다.
   * @returns {Map<string, number>} 측정 항목 이름과 실행 시간(ms)을 담은 Map
   */
  public getResults(): Map<string, number> {
    return this.durations;
  }

  /**
   * 모든 측정 기록을 초기화합니다.
   */
  public clear(): void {
    this.startTimeMap.clear();  
    this.durations.clear();
  }
}

// 싱글턴 인스턴스를 만들어 프로젝트 전역에서 쉽게 사용할 수 있도록 export 합니다.
export const profiler = new Profiler();

/*
사용 예시 :

import { profiler } from './profiler';

function someExpensiveTask() {
  // ... 복잡한 연산 ...
}

// 1. 프로파일러 초기화 (벤치마크 시작 시)
profiler.clear();

// 2. 특정 작업 시간 측정
profiler.start('expensiveTask');
someExpensiveTask();
profiler.stop('expensiveTask');

// 3. 다른 작업 시간 측정
profiler.start('anotherTask');
// ... 다른 연산 ...
profiler.stop('anotherTask');

// 4. 모든 결과 출력
const results = profiler.getResults();
console.log(results); // Map(2) { 'expensiveTask' => 123.45, 'anotherTask' => 67.89 }
*/