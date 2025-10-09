# 각 모듈에서 필요한 함수들을 import 합니다.
import data_loader
import analyzer
import visualizer
import os

def main():
    """
    성능 분석 및 시각화 파이프라인 전체를 실행하는 메인 함수입니다.
    """
    print("🚀 Starting Analysis and Visualization Pipeline...")

    # 1. 데이터 로딩
    # data_loader 모듈을 사용해 가장 최신 벤치마크 파일을 찾습니다.
    latest_file_path = data_loader.find_latest_benchmark_file()

    if not latest_file_path:
        print("❌ Error: No benchmark result file found.")
        print("Please run 'npm run benchmark' first to generate data.")
        return # 데이터 파일이 없으면 실행을 중단합니다.

    # 찾은 파일을 로드하고 데이터프레임으로 전처리합니다.
    df = data_loader.load_and_preprocess_data(latest_file_path)

    if df is None:
        print("❌ Error: Failed to load or process data. Aborting.")
        return # 데이터 로딩에 실패하면 실행을 중단합니다.
    
    # 결과물을 저장할 현재 실행의 고유 디렉터리 경로를 가져옴
    output_dir = os.path.dirname(latest_file_path)
    print("\n" + "="*50 + "\n")

    # 2. 통계 분석 (콘솔 출력)
    # analyzer 모듈을 사용해 요약 통계와 모듈별 성능을 콘솔에 출력합니다.
    analyzer.print_summary_statistics(df)
    analyzer.print_module_performance(df, target_scenario='Large (Standard)')
    
    print("\n" + "="*50 + "\n")

    # 3. 데이터 시각화
    # visualizer 모듈을 사용해 분석 결과를 차트로 생성하고 파일로 저장합니다.
    print("🎨 Generating charts...")
    visualizer.plot_total_time_comparison(df, output_dir)
    visualizer.plot_three_step_breakdown(df, output_dir)
    visualizer.plot_routing_breakdown_pie(df, output_dir)
    visualizer.plot_three_step_breakdown_pie(df, output_dir)
    print("\n" + "="*50 + "\n")

    # 4. Markdown 리포트 생성 (리포트 파일 저장)
    analyzer.save_report_to_markdown(df, output_dir)
    
    print("\n✅ Pipeline finished successfully!")

if __name__ == '__main__':
    # 이 스크립트가 직접 실행될 때 main() 함수를 호출합니다.
    main()