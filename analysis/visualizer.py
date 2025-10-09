import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
import os

# --- 설정 ---
basic_columns = ['scenario', 'seed', 'strategy', 'totalTime']
three_step_columns = ['Placement', 'Routing', 'Post-Process']


def plot_total_time_comparison(df: pd.DataFrame, output_dir: str):
    """
    시나리오별/전략별 전체 실행 시간을 비교하는 막대 차트를 생성하고 저장합니다.

    Args:
        df (pd.DataFrame): 전처리된 벤치마크 데이터프레임.
        output_dir (str): 차트 파일을 저장할 디렉터리 경로.
    """
    output_path = os.path.join(output_dir, 'total_time_comparison.png')

    plt.figure(figsize=(12, 7))
    sns.barplot(data=df, x='scenario', y='totalTime', hue='strategy', palette='viridis')
    
    plt.title('Overall Performance Comparison by Scenario', fontsize=16)
    plt.ylabel('Average Total Time (ms) - Log Scale')
    plt.xlabel('Scenario')
    plt.yscale('log')
    plt.tight_layout()
    
    plt.savefig(output_path)
    plt.close()
    print(f"📊 Chart saved to: {output_path}")

def plot_three_step_breakdown(df: pd.DataFrame, output_dir: str):
    """
    각 전략의 시나리오별 모듈 실행 시간을 보여주는 누적 막대 차트를 생성하고 저장합니다.
    전략별로 차트 파일을 분리하여 생성합니다.

    Args:
        df (pd.DataFrame): 전처리된 벤치마크 데이터프레임.
        output_dir (str): 차트 파일을 저장할 디렉터리 경로.
    """
    strategies = df['strategy'].unique()
    
    for strategy in strategies:
        strategy_df = df[df['strategy'] == strategy].dropna(axis=1, how='all')
        
        detail_columns = [col for col in strategy_df.columns if col not in basic_columns and col in three_step_columns]
        if not detail_columns:
            continue

        module_avg = strategy_df.groupby('scenario')[detail_columns].mean()
        
        module_avg.plot(kind='bar', stacked=True, figsize=(12, 7), colormap='tab20c')
        
        plt.title(f'3-Step Breakdown for "{strategy}" Strategy', fontsize=16)
        plt.ylabel('Average Time (ms)')
        plt.xlabel('Scenario')
        plt.xticks(rotation=0)
        plt.legend(title='Modules', bbox_to_anchor=(1.05, 1), loc='upper left')
        plt.tight_layout(rect=[0, 0, 0.85, 1])
        
        safe_strategy_name = strategy.replace(' ', '-').replace('*', 'Star')
        output_path = os.path.join(output_dir, f'three_step_breakdown_{safe_strategy_name}.png')
        
        plt.savefig(output_path)
        plt.close()
        print(f"🛠️ Chart saved to: {output_path}")



def plot_three_step_breakdown_pie(df: pd.DataFrame, output_dir: str, target_scenario: str = 'Large (Standard)'):
    """
    특정 시나리오에 대해, 각 전략의 3단계 별 비중을 파이 차트로 생성합니다.

    Args:
        df (pd.DataFrame): 전처리된 벤치마크 데이터프레임.
        output_dir (str): 차트를 저장할 디렉터리 경로.
        target_scenario (str): 분석할 대상 시나리오의 이름.
    """
    scenario_df = df[df['scenario'] == target_scenario]
    if scenario_df.empty:
        return

    strategies = scenario_df['strategy'].unique()

    for strategy in strategies:
        strategy_df = scenario_df[scenario_df['strategy'] == strategy]
        
        # 'Routing' 단계에 속하는 세부 모듈들을 식별합니다. (Placement, Post-Process, totalTime 제외)
        routing_detail_cols = [
            col for col in df.columns
            if col in three_step_columns
        ]
        
        # 해당 전략에서 측정된 값들만 필터링
        measured_modules = strategy_df[routing_detail_cols].dropna(axis=1, how='all')
        
        if measured_modules.empty:
            continue
            
        # 각 세부 모듈의 평균 시간을 계산
        module_avg = measured_modules.mean()
        
        # 파이 차트 생성
        plt.figure(figsize=(10, 8))
        plt.pie(
            module_avg, 
            labels=module_avg.index, 
            autopct='%1.1f%%', # 소수점 첫째 자리까지 비율 표시
            startangle=90,
            colors=sns.color_palette('tab20c', n_colors=len(module_avg))
        )
        
        plt.title(f'Routing Phase Breakdown for "{strategy}"\n({target_scenario} Scenario)', fontsize=16)
        plt.axis('equal')  # 파이를 원형으로 유지
        
        # 파일 저장
        safe_strategy_name = strategy.replace(' ', '-').replace('*', 'Star')
        output_path = os.path.join(output_dir, f'three_step_breakdown_pie_{safe_strategy_name}.png')
        plt.savefig(output_path)
        plt.close()
        print(f"🥧 Pie chart saved to: {output_path}")


def plot_routing_breakdown_pie(df: pd.DataFrame, output_dir: str, target_scenario: str = 'Large (Standard)'):
    """
    특정 시나리오에 대해, 각 전략의 'Routing' 단계 내부 시간 비중을 파이 차트로 생성합니다.

    Args:
        df (pd.DataFrame): 전처리된 벤치마크 데이터프레임.
        output_dir (str): 차트를 저장할 디렉터리 경로.
        target_scenario (str): 분석할 대상 시나리오의 이름.
    """
    scenario_df = df[df['scenario'] == target_scenario]
    if scenario_df.empty:
        return

    strategies = scenario_df['strategy'].unique()

    for strategy in strategies:
        strategy_df = scenario_df[scenario_df['strategy'] == strategy]
        
        # 'Routing' 단계에 속하는 세부 모듈들을 식별합니다. (Placement, Post-Process, totalTime 제외)
        routing_detail_cols = [
            col for col in df.columns
            if col not in basic_columns + three_step_columns
        ]
        
        # 해당 전략에서 측정된 값들만 필터링
        measured_modules = strategy_df[routing_detail_cols].dropna(axis=1, how='all')
        
        if measured_modules.empty:
            continue
            
        # 각 세부 모듈의 평균 시간을 계산
        module_avg = measured_modules.mean()
        
        # 파이 차트 생성
        plt.figure(figsize=(10, 8))
        plt.pie(
            module_avg, 
            labels=module_avg.index, 
            autopct='%1.1f%%', # 소수점 첫째 자리까지 비율 표시
            startangle=90,
            colors=sns.color_palette('tab20c', n_colors=len(module_avg))
        )
        
        plt.title(f'Routing Phase Breakdown for "{strategy}"\n({target_scenario} Scenario)', fontsize=16)
        plt.axis('equal')  # 파이를 원형으로 유지
        
        # 파일 저장
        safe_strategy_name = strategy.replace(' ', '-').replace('*', 'Star')
        output_path = os.path.join(output_dir, f'routing_breakdown_pie_{safe_strategy_name}.png')
        plt.savefig(output_path)
        plt.close()
        print(f"🥧 Pie chart saved to: {output_path}")