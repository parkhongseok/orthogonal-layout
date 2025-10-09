import fs from "fs";
import path from "path";
import { createInitialGraph } from "../src/domain/scenario/generator";
import { CONFIG } from "../src/app/config";
import { Profiler } from "./profiler";
import { SCENARIOS, SEEDS, STRATEGIES } from "./benchmark.config";
import { cloneGraph } from "../src/domain/graph";

// 결과를 저장할 타입 정의
type BenchmarkResult = {
  scenario: string;
  seed: number;
  strategy: string;
  totalTime: number;
  details: Record<string, number>;
};

/**
 * Headless 벤치마크를 실행하는 메인 함수
 */
async function runBenchmark() {
  console.log("🚀 Starting Orthogonal Layout Benchmark...");

  const allResults: BenchmarkResult[] = [];
  const totalRuns = SCENARIOS.length * SEEDS.length * STRATEGIES.size;
  let currentRun = 1;

  for (const scenario of SCENARIOS) {
    for (const seed of SEEDS) {
      // 1. 시나리오와 시드를 기반으로 기준 그래프 생성
      const baseGraph = createInitialGraph(
        scenario.nodes,
        scenario.edges,
        scenario.groups,
        CONFIG.gridSize,
        seed
      );

      for (const [strategyName, strategy] of STRATEGIES.entries()) {
        console.log(
          `[${currentRun++}/${totalRuns}] Running: ${
            scenario.name
          } | Seed: ${seed} | Strategy: ${strategyName}`
        );

        // 2. 각 실행마다 새로운 프로파일러 사용
        const profiler = new Profiler();
        const totalTimeProfiler = new Profiler();

        // 3. 전체 실행 시간 측정 시작
        totalTimeProfiler.start("total");

        // 그래프 복제하여 원본 보존
        const graphClone = cloneGraph(baseGraph);

        // 4. 전략 실행 (내부적으로 세부 시간 측정)
        strategy.execute(graphClone, CONFIG, profiler);

        totalTimeProfiler.stop("total");

        // 5. 결과 수집
        const detailedDurations = Object.fromEntries(
          profiler.getResults().entries()
        );

        allResults.push({
          scenario: scenario.name,
          seed: seed,
          strategy: strategyName,
          totalTime: totalTimeProfiler.getResults().get("total")!,
          details: detailedDurations,
        });
      }
    }
  }

  // 6. 결과 파일로 저장
  saveResults(allResults);
  console.log("✅ Benchmark finished!");
}

function saveResults(results: BenchmarkResult[]) {
  // YYYY-MM-DD_HH-MM-SS 형식의 타임스탬프 생성
  const date = new Date();
  const timestamp =
    [
      date.getFullYear(),
      (date.getMonth() + 1).toString().padStart(2, "0"),
      date.getDate().toString().padStart(2, "0"),
    ].join("-") +
    "_" +
    [
      date.getHours().toString().padStart(2, "0"),
      date.getMinutes().toString().padStart(2, "0"),
      date.getSeconds().toString().padStart(2, "0"),
    ].join("-");

  // 타임스탬프 이름으로 된 새로운 결과 폴더 경로 설정
  const outputDir = path.join(process.cwd(), "analysis", "results", timestamp);

  // 결과 폴더 생성
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // JSON 파일명 및 최종 경로
  const fileName = "benchmark-results.json";
  const filePath = path.join(outputDir, fileName);

  fs.writeFileSync(filePath, JSON.stringify(results, null, 2));
  console.log(`📝 Results saved to: ${filePath}`);
}

// 스크립트 실행
runBenchmark().catch((error) => {
  console.error("Benchmark script failed:", error);
});
