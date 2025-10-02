**Performance SLOs**

- Web Vitals
  - LCP: ≤ 2.5s p75 (Slow 4G, 4× CPU throttle), ≤ 1.8s p75 (desktop)
  - CLS: ≤ 0.02 p75 (no new layout shifts from flex change)
  - INP: ≤ 200ms p75 (≤ 100ms p95 for card click/DnD start)
- Rendering
  - FPS: ≥ 55 avg during board scroll and DnD; < 5% dropped frames p95
  - Long Tasks (>50ms): ≤ 5/min p95 on board route
- Memory/CPU
  - Heap: ≤ 150MB p95 on mid‑tier device with 300 visible cards
  - Script eval + style/layout work for initial board render: ≤ 800ms p75 (desktop), ≤ 1200ms p75 (mid‑tier mobile)

**Expected Load & Scenarios**

- Board size: 5–10 columns; 20–60 items/column; each item with 0–5 subtasks
- Stress case: 300–500 total visible cards; long titles (wrapping), varied statuses
- Devices: mid‑tier Android/iOS (2020+), desktop Chrome/Edge/Firefox; Safari 15+ (flex gap consideration)
- Interactions: vertical scroll, open card dialog, start DnD, filter/sort

**Regression Thresholds (This Change)**

- DOM/Style
  - DOM nodes per subtask card: +0; child order changed only
  - Per‑card height: ≤ +24px p75 vs. baseline (to avoid virtualization/DnD drift)
  - Style recalcs/layouts per card render: no increase > +10% p75
- Web Vitals deltas (board route)
  - LCP: ≤ +5% relative; CLS: no increase; INP: ≤ +5ms p95
- Rendering
  - Dropped frames during fast scroll: ≤ +2% absolute p95
  - Long tasks: no net increase; ≤ +1/min p95
- Interaction
  - DnD start latency: ≤ 50ms p95; no degradation vs. baseline
  - Click-to-open card: ≤ 100ms p95

**Measurement Plan**

- Synthetic: Lighthouse (desktop + mobile), Web Vitals in CI on board route
- Runtime: capture INP/LCP/CLS via web-vitals library behind sampling (staging/prod)
- Profiling: Chrome Performance trace during scroll + DnD on a large board fixture
- Visual stability: assert no new layout shifts when cards mount (CLS geo)

**Risk Notes & Mitigations**

- Increased card height can affect virtualization/DnD targets → validate hitboxes; adjust truncation or add `w-full` if needed
- Flex gap on older Safari → if in support matrix, add local `mb-2` fallback for spacing
- Wrapping may expose more text → retain existing truncation/line‑clamp to keep heights predictable

**Go/No‑Go Checks**

- No increase in CLS; INP and dropped frames within thresholds
- Large board scroll smoothness maintained; DnD latency within SLO
- Memory and long tasks within budgets on mid‑tier devices

**Rollback**

- Revert template change to restore horizontal layout if SLOs regress beyond thresholds