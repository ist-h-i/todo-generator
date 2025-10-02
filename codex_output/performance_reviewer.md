**Scope**

- Change is linting/docs only; no runtime code paths affected.
- Performance focus limited to developer/CI workflows (ESLint execution) and ensuring zero impact on build/bundle/runtime.

**Baseline Assumptions**

- Frontend lint runs in CI with `--max-warnings=0`.
- No existing `any` in TS sources; elevating the rule does not increase lint workload.
- Build and bundle outputs are unchanged functionally.

**SLO Targets**

- CI lint step duration: p95 ≤ 3m per job, and ≤ +10% vs. prior 14‑day baseline (whichever is stricter).
- Local lint duration: p95 ≤ 30s on a warm cache (developer machines).
- Node memory for lint: p95 ≤ 1.5 GB RSS during CI lint.
- Build time and bundle size: 0 functional change; enforce ≤ +1% build duration and ≤ +1 KB gzip bundle delta.

**Expected Load**

- Per-commit/PR lint runs on `frontend/**` as today; no increase in frequency or scope.
- No additional processes, watchers, or analyzers introduced.

**Regression Thresholds (Alert/Block)**

- CI lint duration increases by >10% for 3 consecutive runs on main: alert.
- Any individual CI lint job > 5m: alert; > 8m: block merge.
- Node OOM or memory > 1.5 GB at p95 during lint: block until investigated.
- Build duration > +1% average over 10 runs: alert; > +3%: block.
- Bundle gzip size delta > +1 KB for `main.*.js`: block (should be 0 for this change).

**Measurement & Validation**

- Use existing CI step timings and resource metrics; compare to rolling baseline (no new tooling).
- Spot-check negative test locally (temporary `: any`) to confirm rule triggers; remove before commit.
- Verify no build/bundle diffs by comparing CI artifact sizes (existing output logs/artifacts).

**Risks & Mitigations**

- Risk: ESLint version/matrix variance causes timing spikes.
  - Mitigation: Pin versions; cache `node_modules` and ESLint cache in CI.
- Risk: Hidden `any` in a new PR causes repeated CI failures (process, not performance).
  - Mitigation: Clear error messaging; small adapter/suppression patterns documented.

**Rollback**

- Low risk: revert ESLint severity or temporarily downgrade to `warn` to unblock, then re-land with fixes.
- No data migrations or runtime toggles involved.