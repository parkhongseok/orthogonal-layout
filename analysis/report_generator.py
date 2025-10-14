import os
import pandas as pd
from jinja2 import Environment, FileSystemLoader

basic_columns = ['scenario', 'seed', 'strategy', 'totalTime']
three_step_column_names = ['Placement', 'Routing', 'Post-Process']

def resolve_three_step_columns(df: pd.DataFrame):
    """
    Determine which columns to treat as the three main steps (L1), supporting
    both legacy names (e.g., 'Placement') and new L1-prefixed names (e.g., 'L1-Placement').
    Returns a tuple: (selected_columns_in_df, rename_map_for_display)
    where rename_map maps dataframe column name -> display name.
    """
    # Prefer L1-* columns if present
    l1_prefixed = {f"L1-{name}": name for name in three_step_column_names if f"L1-{name}" in df.columns}
    if len(l1_prefixed) > 0:
        return list(l1_prefixed.keys()), l1_prefixed

    # Fallback to legacy column names
    legacy = [col for col in three_step_column_names if col in df.columns]
    legacy_map = {name: name for name in legacy}
    return legacy, legacy_map

def format_numbers(df: pd.DataFrame, decimals: int = 2) -> pd.DataFrame:
    """Format all numeric columns to fixed decimals as strings (e.g., 12.40)."""
    formatted = df.copy()
    for col in formatted.columns:
        if pd.api.types.is_numeric_dtype(formatted[col]):
            formatted[col] = formatted[col].map(lambda x: f"{x:.{decimals}f}" if pd.notna(x) else "")
    return formatted

def md_table(df: pd.DataFrame) -> str:
    """Render DataFrame to GitHub-flavor markdown with proper right alignment.
    - Numeric columns get header separators with ---: so they right-align in GitHub.
    - Values in numeric columns are formatted to 2 decimals.
    - Index is emitted as the first (left-aligned) column.
    """
    if df is None or df.empty:
        return ""

    # Prepare a copy for formatting numeric values
    out = df.copy()
    numeric_cols = []
    for col in out.columns:
        if pd.api.types.is_numeric_dtype(out[col]):
            numeric_cols.append(col)
            out[col] = out[col].map(lambda x: f"{x:.2f}" if pd.notna(x) else "")
        else:
            out[col] = out[col].map(lambda x: str(x) if pd.notna(x) else "")

    # Headers
    index_name = out.index.name if out.index.name is not None else ""
    headers = [index_name] + list(out.columns)

    # Alignment row: index left, numeric columns right, others left
    align = ["---"]
    for col in out.columns:
        align.append("---:" if col in numeric_cols else ":---")

    # Data rows
    lines = []
    lines.append("| " + " | ".join(headers) + " |")
    lines.append("| " + " | ".join(align) + " |")
    for idx, row in out.iterrows():
        values = [str(idx)] + [str(row[c]) for c in out.columns]
        lines.append("| " + " | ".join(values) + " |")

    return "\n".join(lines)

def caption_figure(section_prefix: str, idx: int, title: str) -> str:
    return f"그림 {section_prefix}.{idx}. {title}"

def caption_table(section_prefix: str, idx: int, title: str) -> str:
    return f"표 {section_prefix}.{idx}. {title} "

class Numbering:
    """Simple hierarchical numbering for sections and captions.
    Levels: 2 (scenario), 3 (strategy), 4 (sub-sections like three-step/routing)
    """
    def __init__(self):
        self.counters = {2: 0, 3: 0, 4: 0}

    def _reset_below(self, level: int):
        for k in list(self.counters.keys()):
            if k > level:
                self.counters[k] = 0

    def sec(self, level: int) -> str:
        self._reset_below(level)
        self.counters[level] += 1
        parts = []
        for lv in (2, 3, 4):
            if lv > level:
                break
            if self.counters[lv] == 0:
                parts.append('0')
            else:
                parts.append(str(self.counters[lv]))
        return '.'.join(parts) + '.'

def save_report_to_markdown(df: pd.DataFrame, summary_data: dict, output_dir: str):
    """
    분석된 통계 데이터를 Markdown 형식의 리포트 파일로 저장합니다.

    Args:
        df (pd.DataFrame): 전처리된 벤치마크 데이터프레임.
        output_dir (str): 리포트 파일을 저장할 디렉터리 경로.
    """
    report_path = os.path.join(output_dir, 'report_frame.md')
    charts_dir = os.path.join(output_dir, 'charts')
    num = Numbering()

    # Build summary context
    summary_df = pd.DataFrame.from_dict(summary_data['overall_summary'], orient='index')
    total_time_chart_filename = None
    total_chart_path = os.path.join(charts_dir, 'total_time_comparison.png')
    if os.path.exists(total_chart_path):
        total_time_chart_filename = os.path.basename(total_chart_path)

    # Sections (currently only 'Large (Standard)')
    sections = []
    target_scenario = 'Large (Standard)'
    scenario_df = df[df['scenario'] == target_scenario]
    if not scenario_df.empty:
        sec2 = num.sec(2)
        section = {
            'scenario_name': target_scenario,
            'sec2': sec2,
            'strategies': []
        }
        for strategy in sorted(scenario_df['strategy'].unique()):
            strategy_df = scenario_df[scenario_df['strategy'] == strategy]
            sec3 = num.sec(3)

            # Three-step
            three_step_cols, rename_map = resolve_three_step_columns(strategy_df)
            three_step_has = len(strategy_df[three_step_cols].dropna(axis=1, how='all').columns) > 0
            three_step = {'has': False}
            if three_step_has:
                sec4 = num.sec(4)
                display_df = strategy_df[three_step_cols].rename(columns=rename_map)
                module_avg = display_df.mean().to_frame(name='Average Time (ms)')
                three_step = {
                    'has': True,
                    'sec4': sec4,
                    'chart_filename': f'three_step_breakdown_pie_{strategy}.png' if os.path.exists(os.path.join(charts_dir, f'three_step_breakdown_pie_{strategy}.png')) else None,
                    'table_md': md_table(module_avg),
                    'fig_caption': caption_figure(f"{num.counters[2]}.{num.counters[3]}", num.counters[4], f'three-Step Phase Breakdown for "{strategy}"'),
                    'tbl_caption': caption_table(f"{num.counters[2]}.{num.counters[3]}", num.counters[4], f'three-Step Phase Breakdown for "{strategy}"')
                }

            # Routing breakdown (exclude basics and the per-strategy three-step columns)
            routing_cols = [c for c in df.columns if c not in basic_columns + list(three_step_cols)]
            measured = strategy_df[routing_cols].dropna(axis=1, how='all').columns
            routing = {'has': False}
            if len(measured) > 0:
                sec4_r = num.sec(4)
                module_avg_r = strategy_df[measured].mean().to_frame(name='Average Time (ms)')
                routing = {
                    'has': True,
                    'sec4': sec4_r,
                    'chart_filename': f'routing_breakdown_pie_{strategy}.png' if os.path.exists(os.path.join(charts_dir, f'routing_breakdown_pie_{strategy}.png')) else None,
                    'table_md': md_table(module_avg_r),
                    'fig_caption': caption_figure(f"{num.counters[2]}.{num.counters[3]}", num.counters[4], f'Routing Phase Breakdown for "{strategy}"'),
                    'tbl_caption': caption_table(f"{num.counters[2]}.{num.counters[3]}", num.counters[4], f'Routing Phase Breakdown for "{strategy}"')
                }
            # Analysis section numbering
            analysis_sec4 = num.sec(4)

            section['strategies'].append({
                'name': strategy,
                'sec3': sec3,
                'three_step': three_step,
                'routing_breakdown': routing,
                'analysis_sec4': analysis_sec4,
            })

        sections.append(section)

    # Prepare template context
    templates_dir = os.path.join(os.path.dirname(__file__), 'templates')
    env = Environment(loader=FileSystemLoader(templates_dir))
    template = env.get_template('report.md.j2')
    context = {
        'date': os.path.basename(output_dir),
        'total_time_chart_filename': total_time_chart_filename,
        'summary_table_md': md_table(summary_df),
        'sections': sections,
    }

    # Render and write
    content = template.render(**context)
    with open(report_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"📜 Report saved to: {report_path}")