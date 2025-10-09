# Performance Benchmark Report

## 📈 Overall Performance Summary (totalTime in ms)

### Performance Visualization

<img src="/Users/keinmall/개발/개발 프로젝트/orthogonal-layout/analysis/results/2025-10-09_14-28-02/total_time_comparison.png" alt="Overall Performance Chart" >

|                                          |     mean |      std |      min |      max |
|:-----------------------------------------|---------:|---------:|---------:|---------:|
| ('Large (Standard)', 'A-Star')           |  1975.16 |   289.56 |  1694.38 |  2348.9  |
| ('Large (Standard)', 'Bus-Channel')      | 51692.8  | 17894.8  | 31590.1  | 71258.3  |
| ('Large (Standard)', 'Vertices-Network') | 23762.4  |  4040.09 | 18961.7  | 28792.6  |
| ('Medium', 'A-Star')                     |   594.48 |    55.19 |   512.9  |   660.56 |
| ('Medium', 'Bus-Channel')                | 24962    |  7103.85 | 18751.7  | 36231.3  |
| ('Medium', 'Vertices-Network')           |  5262.77 |  1267.99 |  3681.7  |  6468.81 |
| ('Small', 'A-Star')                      |    23.8  |     8.41 |    15.8  |    36.85 |
| ('Small', 'Bus-Channel')                 |   461.61 |   130.74 |   309.11 |   581.52 |
| ('Small', 'Vertices-Network')            |    69.28 |    25.77 |    38.62 |   110.19 |

<br/>
<br/>


## 🛠️ Performance for 'Large (Standard)' Scenario (average time in ms)

### Strategy: A-Star

#### three step result 

<img src="/Users/keinmall/개발/개발 프로젝트/orthogonal-layout/analysis/results/2025-10-09_14-28-02/three_step_breakdown_pie_A-Star.png" alt="3-Step Performance Chart" width="60%" >

|              |   Average Time (ms) |
|:-------------|--------------------:|
| Placement    |                1.59 |
| Routing      |             1972.61 |
| Post-Process |                0.49 |

<br/>
<br/>


#### routing breakdown result

<img src="/Users/keinmall/개발/개발 프로젝트/orthogonal-layout/analysis/results/2025-10-09_14-28-02/three_step_breakdown_pie_A-Star.png" alt="3-Step Performance Chart" width="60%" >

|            |   Average Time (ms) |
|:-----------|--------------------:|
| buildGrid  |                1.49 |
| aStar_Loop |             1970.86 |

<br/>
<br/>


### Strategy: Bus-Channel

#### three step result 

<img src="/Users/keinmall/개발/개발 프로젝트/orthogonal-layout/analysis/results/2025-10-09_14-28-02/three_step_breakdown_pie_Bus-Channel.png" alt="3-Step Performance Chart" width="60%" >

|              |   Average Time (ms) |
|:-------------|--------------------:|
| Placement    |                1.67 |
| Routing      |            51690.1  |
| Post-Process |                0.58 |

<br/>
<br/>


#### routing breakdown result

<img src="/Users/keinmall/개발/개발 프로젝트/orthogonal-layout/analysis/results/2025-10-09_14-28-02/three_step_breakdown_pie_Bus-Channel.png" alt="3-Step Performance Chart" width="60%" >

|                      |   Average Time (ms) |
|:---------------------|--------------------:|
| createBusChannels    |                3.08 |
| buildBusNetworkGraph |                0.05 |
| routeEdgesOnBus      |            51686.8  |
| Routing Fallback     |                0.16 |

<br/>
<br/>


### Strategy: Vertices-Network

#### three step result 

<img src="/Users/keinmall/개발/개발 프로젝트/orthogonal-layout/analysis/results/2025-10-09_14-28-02/three_step_breakdown_pie_Vertices-Network.png" alt="3-Step Performance Chart" width="60%" >

|              |   Average Time (ms) |
|:-------------|--------------------:|
| Placement    |                1.63 |
| Routing      |            23750.3  |
| Post-Process |                9.86 |

<br/>
<br/>


#### routing breakdown result

<img src="/Users/keinmall/개발/개발 프로젝트/orthogonal-layout/analysis/results/2025-10-09_14-28-02/three_step_breakdown_pie_Vertices-Network.png" alt="3-Step Performance Chart" width="60%" >

|                        |   Average Time (ms) |
|:-----------------------|--------------------:|
| createRoutingVertices  |               37.83 |
| buildVisibilityGraph   |             5247.97 |
| routeOnVisibilityGraph |            18464.5  |

<br/>
<br/>


