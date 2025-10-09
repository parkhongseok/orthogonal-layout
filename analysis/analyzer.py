import pandas as pd
import os
import base64

basic_columns = ['scenario', 'seed', 'strategy', 'totalTime']
three_step_column_names = ['Placement', 'Routing', 'Post-Process']

def print_summary_statistics(df: pd.DataFrame):
    """
    시나리오별/전략별 전체 실행 시간(totalTime)에 대한 요약 통계를 출력합니다.

    Args:
        df (pd.DataFrame): 전처리된 벤치마크 데이터프레임.
    """
    print("📈 Performance Summary (totalTime in ms):")
    
    # 각 시나리오와 전략별로 totalTime의 평균, 표준편차, 최소, 최대값을 계산
    summary = df.groupby(['scenario', 'strategy'])['totalTime'].agg(['mean', 'std', 'min', 'max']).round(2)
    
    print(summary)
    print("\n" + "="*50 + "\n")

def print_module_performance(df: pd.DataFrame, target_scenario: str = 'Large (Standard)'):
    """
    특정 시나리오에 대해, 각 전략의 내부 모듈별 평균 실행 시간을 출력합니다.

    Args:
        df (pd.DataFrame): 전처리된 벤치마크 데이터프레임.
        target_scenario (str): 분석할 대상 시나리오의 이름.
    """
    print(f"🛠️ Module Performance for '{target_scenario}' Scenario (average time in ms):")
    
    scenario_df = df[df['scenario'] == target_scenario]
    
    if scenario_df.empty:
        print(f"No data found for scenario: '{target_scenario}'")
        return

    # 각 전략별로 순회하며, 해당 전략에서 측정된 모듈들만 추려서 분석
    strategies = scenario_df['strategy'].unique()
    for strategy in sorted(strategies):
        strategy_df = scenario_df[scenario_df['strategy'] == strategy]
        
        # 측정값이 하나라도 있는 (NaN이 아닌) 모듈 컬럼만 선택
        detail_columns = [
            col for col in df.columns 
            if col not in basic_columns
        ]
        
        # 해당 전략에서 한 번이라도 측정된 모듈만 필터링
        measured_modules = strategy_df[detail_columns].dropna(axis=1, how='all').columns
        
        if len(measured_modules) > 0:
            module_avg = strategy_df[measured_modules].mean().round(2)
            print(f"\n--- Strategy: {strategy} ---")
            print(module_avg)

# def image_to_base64_str(image_path):
#     """
#     # 이미지를 Base64 문자열로 변환합니다.

#     Args:
#         image_path (str): 이미지 파일의 경로.
#     """
#     with open(image_path, "rb") as image_file:
#         return base64.b64encode(image_file.read()).decode('utf-8')

def save_report_to_markdown(df: pd.DataFrame, output_dir: str):
    """
    분석된 통계 데이터를 Markdown 형식의 리포트 파일로 저장합니다.

    Args:
        df (pd.DataFrame): 전처리된 벤치마크 데이터프레임.
        output_dir (str): 리포트 파일을 저장할 디렉터리 경로.
    """
    report_path = os.path.join(output_dir, 'report.md')
    
    with open(report_path, 'w') as f:
        f.write("# Performance Benchmark Report\n\n")
        
        # --- 1. 전체 성능 요약 테이블 ---
        f.write("## 📈 Overall Performance Summary (totalTime in ms)\n\n")
        image_path = os.path.join(output_dir, 'total_time_comparison.png')
        if image_path and os.path.exists(image_path):
            f.write(f'### Performance Visualization\n\n')
            # f.write(f'<img src="data:image/png;base64,{base64_image}" alt="3-Step Performance Chart" width="60%" >\n\n')
            f.write(f'<img src="{image_path}" alt="Overall Performance Chart" >\n\n')

        summary = df.groupby(['scenario', 'strategy'])['totalTime'].agg(['mean', 'std', 'min', 'max']).round(2)
        f.write(summary.to_markdown())
        f.write('\n\n')
        f.write('<br/>\n')
        f.write('<br/>\n')
        f.write('\n\n')

        # --- 2. 'Large' 시나리오 모듈별 성능 분석 테이블 ---
        target_scenario = 'Large (Standard)'
        f.write(f"## 🛠️ Performance for '{target_scenario}' Scenario (average time in ms)\n\n")
        
        scenario_df = df[df['scenario'] == target_scenario]
        
        if scenario_df.empty:
            f.write(f"No data found for scenario: '{target_scenario}'\n")
            return

        strategies = sorted(scenario_df['strategy'].unique())
        for strategy in strategies:
            strategy_df = scenario_df[scenario_df['strategy'] == strategy]
            
            f.write(f"### Strategy: {strategy}\n\n")

            # three step result (Large Case)
            three_step_columns = [
                col for col in df.columns 
                if col in three_step_column_names
            ]
            
            measured_modules = strategy_df[three_step_columns].dropna(axis=1, how='all').columns
            
            if len(measured_modules) > 0:
                f.write("#### three step result \n\n")

                image_path = os.path.join(output_dir, f'three_step_breakdown_pie_{strategy}.png')
                if image_path and os.path.exists(image_path):
                    # base64_image = image_to_base64_str(image_path)
                    # f.write(f'<img src="data:image/png;base64,{base64_image}" alt="3-Step Performance Chart" width="60%" >\n\n')
                    f.write(f'<img src="{image_path}" alt="3-Step Performance Chart" width="60%" >\n\n')

                module_avg = strategy_df[measured_modules].mean().round(2).to_frame(name='Average Time (ms)')
                f.write(module_avg.to_markdown())
                f.write('\n\n')
                f.write('<br/>\n')
                f.write('<br/>\n')
                f.write('\n\n')

            routing_breakedown_columns = [
                col for col in df.columns 
                if col not in three_step_column_names + basic_columns
            ]
            
            measured_modules = strategy_df[routing_breakedown_columns].dropna(axis=1, how='all').columns
            
            if len(measured_modules) > 0:
                f.write("#### routing breakdown result\n\n")

                image_path = os.path.join(output_dir, f'three_step_breakdown_pie_{strategy}.png')
                if image_path and os.path.exists(image_path):
                    # base64_image = image_to_base64_str(image_path)
                    # f.write(f'<img src="data:image/png;base64,{base64_image}" alt="3-Step Performance Chart" width="60%" >\n\n')
                    f.write(f'<img src="{image_path}" alt="3-Step Performance Chart" width="60%" >\n\n')

                module_avg = strategy_df[measured_modules].mean().round(2).to_frame(name='Average Time (ms)')
                f.write(module_avg.to_markdown())
                f.write('\n\n')
                f.write('<br/>\n')
                f.write('<br/>\n')
                f.write('\n\n')

    print(f"📜 Report saved to: {report_path}")

