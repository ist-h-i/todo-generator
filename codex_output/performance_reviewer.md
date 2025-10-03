**Scope**

- UI-only layout tweak in Board subtask cards; no backend impact.
- Expect zero-to-negligible perf impact; set guardrails to prevent regressions.

**Load Assumptions**

- Typical board: ~6 columns, 40–60 cards, 120–200 subtasks.
- Peak board: up to 10 columns, 100 cards, 300–500 subtasks.
- Devices: mid‑tier mobile (throttled 4× CPU), average laptop; SPA route navigation (warm cache).

**SLO Targets (p75 unless noted)**

- Route render (Board view): ≤ 800 ms desktop, ≤ 1.5 s mobile.
- INP (overall interactions on Board): ≤ 200 ms.
- Tap/click to open card detail: ≤ 150 ms.
- DnD start latency (pointerdown → drag preview): ≤ 100 ms.
- Smoothness while scrolling board lists: ≥ 55 FPS; dropped frames ≤ 5% (p95).
- CLS on Board: ≤ 0.02.
- Memory steady state on Board: ≤ 128 MB tab heap; GC spikes acceptable but recover within 2 s.
- Idle CPU on Board (5 s window): ≤ 10%.

**Regression Thresholds (vs. baseline on same dataset)**

- Route render time: ≤ +5% or +50 ms (whichever greater).
- INP: ≤ +10 ms; DnD start: ≤ +10 ms.
- CLS: Δ ≤ +0.01.
- Scroll jank: dropped frames Δ ≤ +2 pp.
- Board chunk size (brotli): ≤ +0.5 KB; gzip: ≤ +1.0 KB.
- DOM node count per subtask/card: ≤ +2%.
- Style/layout recalcs per frame: ≤ +5%.
- Paint time per frame (p75): ≤ 8 ms.

**Test Data & Scenarios**

- Medium: 6×50 cards, 150 subtasks; Large: 10×100 cards, 400 subtasks.
- Measure cold route to Board, warm route transitions, scroll through two columns, DnD between columns, open/close detail drawer.

**Verification Approach**

- CI budgets: Lighthouse CI (SPA route), bundle-size check for board chunk.
- Local traces: Chrome Performance profile for scroll/DnD; INP via Web Vitals polyfill.
- DOM/CLS: Capture CLS and node counts before/after; confirm no layout thrash on title wrap.

**Notes**

- Change should not increase JS size or CPU; any deviation likely indicates unintended reflows or extra wrappers.
- Keep DOM order aligned with visual order to avoid CSS reordering costs and a11y drift.