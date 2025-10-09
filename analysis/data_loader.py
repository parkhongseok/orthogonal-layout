import pandas as pd
import json
import os
from typing import Optional

# --- 설정 ---
# 이 파일의 위치를 기준으로 data 디렉터리의 절대 경로를 설정합니다.
RESULTS_DIR = os.path.join(os.path.dirname(__file__), 'results')

def find_latest_benchmark_file() -> Optional[str]:
    """
    results 디렉터리에서 가장 최근에 생성된 타임스탬프 폴더를 찾아
    그 안의 'benchmark-results.json' 파일 경로를 반환합니다.
    
    Returns:
        Optional[str]: 최신 결과 JSON 파일의 전체 경로. 없으면 None.
    """
    if not os.path.exists(RESULTS_DIR):
        print(f"Error: Results directory not found at '{RESULTS_DIR}'")
        return None
        
    # results 폴더 내의 모든 하위 디렉터리 목록을 가져옴
    subdirectories = [
        d for d in os.listdir(RESULTS_DIR) 
        if os.path.isdir(os.path.join(RESULTS_DIR, d))
    ]

    if not subdirectories:
        return None
    
    # 디렉터리 이름을 기준으로 최신순으로 정렬하여 가장 최신 폴더를 찾음
    latest_dir = sorted(subdirectories, reverse=True)[0]
    
    # 최신 폴더 안의 JSON 파일 경로를 구성
    json_file_path = os.path.join(RESULTS_DIR, latest_dir, 'benchmark-results.json')

    if os.path.exists(json_file_path):
        return json_file_path
    else:
        print(f"Error: 'benchmark-results.json' not found in the latest directory '{latest_dir}'")
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