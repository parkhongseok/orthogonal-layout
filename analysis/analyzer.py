import pandas as pd


basic_columns = ['scenario', 'seed', 'strategy', 'totalTime']
three_step_column_names = ['Placement', 'Routing', 'Post-Process']

def analyze_data(df: pd.DataFrame) -> dict:
    """
    데이터프레임을 받아 전체 요약 통계와 모듈별 성능을 분석하고,
    결과를 딕셔너리 형태로 반환합니다.
    """
    summary_dict = {}

    # 1. 전체 성능 요약
    summary = df.groupby(['scenario', 'strategy'])['totalTime'].agg(['mean', 'std', 'min', 'max']).round(2)
    summary_dict['overall_summary'] = summary.to_dict('index')

    # 2. 'Large (Standard)' 시나리오 모듈별 성능 분석
    target_scenario = 'Large (Standard)'
    scenario_df = df[df['scenario'] == target_scenario]
    
    module_performance = {}
    if not scenario_df.empty:
        strategies = sorted(scenario_df['strategy'].unique())
        for strategy in strategies:
            # ... (기존 print_module_performance 함수의 로직을 사용하여 데이터를 계산)
            # 예시: module_avg = strategy_df[measured_modules].mean().round(2)
            # module_performance[strategy] = module_avg.to_dict()
            pass # 여기에 실제 계산 로직을 구현합니다.
            
    summary_dict['large_scenario_breakdown'] = module_performance
    
    return summary_dict

# def print_summary_statistics(df: pd.DataFrame):
#     """
#     시나리오별/전략별 전체 실행 시간(totalTime)에 대한 요약 통계를 출력합니다.

#     Args:
#         df (pd.DataFrame): 전처리된 벤치마크 데이터프레임.
#     """
#     print("📈 Performance Summary (totalTime in ms):")
    
#     # 각 시나리오와 전략별로 totalTime의 평균, 표준편차, 최소, 최대값을 계산
#     summary = df.groupby(['scenario', 'strategy'])['totalTime'].agg(['mean', 'std', 'min', 'max']).round(2)
    
#     print(summary)
#     print("\n" + "="*50 + "\n")

# def print_module_performance(df: pd.DataFrame, target_scenario: str = 'Large (Standard)'):
#     """
#     특정 시나리오에 대해, 각 전략의 내부 모듈별 평균 실행 시간을 출력합니다.

#     Args:
#         df (pd.DataFrame): 전처리된 벤치마크 데이터프레임.
#         target_scenario (str): 분석할 대상 시나리오의 이름.
#     """
#     print(f"🛠️ Module Performance for '{target_scenario}' Scenario (average time in ms):")
    
#     scenario_df = df[df['scenario'] == target_scenario]
    
#     if scenario_df.empty:
#         print(f"No data found for scenario: '{target_scenario}'")
#         return

#     # 각 전략별로 순회하며, 해당 전략에서 측정된 모듈들만 추려서 분석
#     strategies = scenario_df['strategy'].unique()
#     for strategy in sorted(strategies):
#         strategy_df = scenario_df[scenario_df['strategy'] == strategy]
        
#         # 측정값이 하나라도 있는 (NaN이 아닌) 모듈 컬럼만 선택
#         detail_columns = [
#             col for col in df.columns 
#             if col not in basic_columns
#         ]
        
#         # 해당 전략에서 한 번이라도 측정된 모듈만 필터링
#         measured_modules = strategy_df[detail_columns].dropna(axis=1, how='all').columns
        
#         if len(measured_modules) > 0:
#             module_avg = strategy_df[measured_modules].mean().round(2)
#             print(f"\n--- Strategy: {strategy} ---")
#             print(module_avg)
