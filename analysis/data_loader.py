import pandas as pd
import json
import os
from typing import Optional

# --- 설정 ---
# 이 파일의 위치를 기준으로 data 디렉터리의 절대 경로를 설정합니다.
RESULTS_DIR = os.path.join(os.path.dirname(__file__), 'results')

def find_benchmark_file(target_prefix: Optional[str] = None) -> Optional[str]:
    """
    results 디렉터리에서 벤치마크 결과 파일을 찾습니다.
    target_prefix가 지정되면 해당 접두사로 시작하는 최신 파일을, 아니면 전체에서 최신 파일을 찾습니다.

    Args:
        target_prefix (Optional[str]): 'YYYY-MM-DD' 또는 'YYYY-MM-DD_HH-MM-SS' 형식의 대상 접두사.

    Returns:
        Optional[str]: 결과 JSON 파일의 전체 경로. 없으면 None.
    """
    if not os.path.exists(RESULTS_DIR):
        print(f"❌ Error: Results directory not found at '{RESULTS_DIR}'")
        return None

    subdirectories = sorted(
        [
            d for d in os.listdir(RESULTS_DIR)
            if os.path.isdir(os.path.join(RESULTS_DIR, d))
        ],
        reverse=True
    )

    if not subdirectories:
        return None

    target_dir = None
    if target_prefix:
        # 대상 접두사로 시작하는 디렉터리를 찾음
        for subdir in subdirectories:
            if subdir.startswith(target_prefix):
                target_dir = subdir
                break
        if not target_dir:
            print(f"❌ Error: No results found for prefix '{target_prefix}'")
            return None
    else:
        # 대상 접두사가 없으면 가장 최신 디렉터리를 사용
        target_dir = subdirectories[0]

    json_file_path = os.path.join(RESULTS_DIR, target_dir, 'raw_results.json')

    if os.path.exists(json_file_path):
        return json_file_path
    else:
        print(f"Error: 'raw_results.json' not found in the directory '{target_dir}'")
        return None


def load_and_preprocess_data(file_path: str) -> Optional[pd.DataFrame]:
    """
    주어진 경로의 JSON 파일을 로드하고, 분석하기 좋은 DataFrame 형태로 전처리합니다.

    Args:
        file_path (str): 로드할 JSON 파일의 경로.

    Returns:
        Optional[pd.DataFrame]: 전처리된 데이터프레임. 파일이 없거나 비어있으면 None을 반환합니다.
    """
    print(f"📄 Loading data from: {os.path.basename(file_path)}")
    
    try:
        with open(file_path, 'r') as f:
            raw_data = json.load(f)
        
        if not raw_data:
            print("Warning: Benchmark file is empty.")
            return None

        # 중첩된 'details' 데이터를 상위 레벨로 올겨서 평탄화(flatten)합니다.
        normalized_data = []
        for record in raw_data:
            flat_record = {
                'scenario': record.get('scenario'),
                'seed': record.get('seed'),
                'strategy': record.get('strategy'),
                'totalTime': record.get('totalTime'),
                **record.get('details', {}) # 'details' 객체의 모든 키-값을 풀어헤쳐 추가
            }
            normalized_data.append(flat_record)

        df = pd.DataFrame(normalized_data)
        print("✅ Data loaded and preprocessed successfully.")
        return df

    except (FileNotFoundError, json.JSONDecodeError) as e:
        print(f"Error loading or parsing file: {e}")
        return None