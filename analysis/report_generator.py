import os
import pandas as pd

basic_columns = ['scenario', 'seed', 'strategy', 'totalTime']
three_step_column_names = ['Placement', 'Routing', 'Post-Process']

# def image_to_base64_str(image_path):
#     """
#     # 이미지를 Base64 문자열로 변환합니다.

#     """
#     with open(image_path, "rb") as image_file:
#         return base64.b64encode(image_file.read()).decode('utf-8')

def save_report_to_markdown(df: pd.DataFrame, summary_data: dict, output_dir: str):
    """
    분석된 통계 데이터를 Markdown 형식의 리포트 파일로 저장합니다.

    Args:
        df (pd.DataFrame): 전처리된 벤치마크 데이터프레임.
        output_dir (str): 리포트 파일을 저장할 디렉터리 경로.
    """
    report_path = os.path.join(output_dir, 'report.md')

    with open(report_path, 'w') as f:
        f.write("# Performance Benchmark Report\n\n")

        f.write(f'Date: {os.path.basename(output_dir)}\n\n')
        
        # --- 1. 전체 성능 요약 테이블 ---
        f.write("## 📈 Overall Performance Summary\n\n")
        image_path = os.path.join(output_dir, 'charts', 'total_time_comparison.png')
        if image_path and os.path.exists(image_path):
            # 절대 경로 대신 파일명만 사용하도록 변경
            image_filename = os.path.basename(image_path)
            f.write(f'### Performance Visualization\n\n')
            # f.write(f'<img src="data:image/png;base64,{base64_image}" alt="3-Step Performance Chart" width="60%" >\n\n')
            f.write(f'<img src="charts/{image_filename}" alt="Overall Performance Chart" >\n\n')

        # summary_data를 사용하여 표 생성
        summary_df = pd.DataFrame.from_dict(summary_data['overall_summary'], orient='index')
        f.write(summary_df.to_markdown())

        f.write("\n\n #### Analysis\n")
        f.write("[여기에 분석 내용을 직접 작성하세요]\n\n")
        
        f.write('\n\n')
        f.write('<br/>\n')
        f.write('<hr/>\n')
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

                image_path = os.path.join(output_dir, 'charts', f'three_step_breakdown_pie_{strategy}.png')
                if image_path and os.path.exists(image_path):
                    # base64_image = image_to_base64_str(image_path)
                    # f.write(f'<img src="data:image/png;base64,{base64_image}" alt="3-Step Performance Chart" width="60%" >\n\n')
                    image_filename = os.path.basename(image_path)
                    f.write(f'<img src="charts/{image_filename}" alt="3-Step Performance Chart" width="60%" >\n\n')

                module_avg = strategy_df[measured_modules].mean().round(2).to_frame(name='Average Time (ms)')
                f.write(module_avg.to_markdown())
                f.write('\n\n')
                f.write('<br/>\n')
                f.write('\n\n')

            routing_breakedown_columns = [
                col for col in df.columns 
                if col not in three_step_column_names + basic_columns
            ]

            measured_modules = strategy_df[routing_breakedown_columns].dropna(axis=1, how='all').columns

            if len(measured_modules) > 0:
                f.write("#### routing breakdown result\n\n")

                image_path = os.path.join(output_dir, 'charts', f'routing_breakdown_pie_{strategy}.png')
                if image_path and os.path.exists(image_path):
                    # base64_image = image_to_base64_str(image_path)
                    # f.write(f'<img src="data:image/png;base64,{base64_image}" alt="3-Step Performance Chart" width="60%" >\n\n')
                    image_filename = os.path.basename(image_path)
                    f.write(f'<img src="charts/{image_filename}" alt="Routing Detail Chart" width="60%" >\n\n')

                module_avg = strategy_df[measured_modules].mean().round(2).to_frame(name='Average Time (ms)')
                f.write(module_avg.to_markdown())

                f.write("\n\n #### Analysis\n")
                f.write("[여기에 분석 내용을 직접 작성하세요]\n\n")

                f.write('\n\n')
                f.write('<br/>\n')
                f.write('<hr/>\n')
                f.write('<br/>\n')
                f.write('\n\n')

    print(f"📜 Report saved to: {report_path}")