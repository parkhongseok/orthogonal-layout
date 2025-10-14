# Measurement Levels & Timer Naming Convention

## Purpose
- Define a stable, explicit convention for performance instrumentation keys used by `.start(name)` / `.stop(name)` so analysis can parse levels and module hierarchy reliably.

## Key Format
- Pattern: `L{level}-{path}`
- Regex: `^L(?P<level>\d+)[-_](?P<path>[A-Za-z0-9:._-]+)$`
- Sub-path delimiter: `:` (colon)

## Levels
- L1: Top-level 3 steps (configurable via `analysis/config.yaml`)
  - Default names: `Placement`, `Routing`, `Post-Process`
  - Example keys:
    - `L1-Placement`
    - `L1-Routing`
    - `L1-Post-Process`
- L2: Breakdown of an L1 step
  - Use `:` to indicate hierarchical sub-paths
  - Examples:
    - `L2-Routing:GridBuild`
    - `L2-Routing:PathSearch`
- L3+: Deeper submodules (optional)
  - Examples:
    - `L3-Routing:GridBuild:Index`
    - `L3-Routing:PathSearch:Heuristic`

## Guidelines
- Use alphanumerics with `: . _ -` when needed. Avoid spaces.
- Keep names stable across runs to enable comparisons.
- Prefer nouns or concise verb-noun pairs (e.g., `GridBuild`, `PathSearch`).
- Only create deeper levels (L3+) when justified by bottlenecks or investigation.

## Backward Compatibility
- Existing keys without `L{n}-` can be mapped in analysis if needed, but new measurements should follow this convention.

## Analysis Parsing
- The analysis pipeline will:
  - Extract `level` and `path` via the regex.
  - Build a hierarchy by splitting `path` with `:`.
  - Aggregate metrics by level and by (scenario, strategy).

## Formatting Policy (Reporting)
- All numeric values displayed with 2 decimal places and right alignment.
- Charts (labels/tooltips) use the same numeric formatting.

## Examples
```
L1-Placement
L1-Routing
L2-Routing:GridBuild
L2-Routing:PathSearch
L3-Routing:GridBuild:Index
```
