**Build & CI**
- ESLint enforces no `any` and fails on violations:
  - Rule set to error: frontend/.eslintrc.cjs:30
  - Lint script blocks warnings: frontend/package.json:12
  - CI runs frontend lint on push/PR: .github/workflows/lint.yml:57
- Baseline clean: no `: any`, `<any>`, or `as any` found in `frontend/src/**`.

**Deploy**
- No build or runtime behavior change; Angular build unaffected.
- Existing workflows remain valid; no deploy pipeline updates required.

**Monitoring**
- No telemetry/runtime impact. Lint rule acts as preventive control in CI.
- Optional follow-up: template linting for `$any(...)` if adopted later (out of scope now).

**Rollback**
- Safe and trivial: revert ESLint/docs commit or temporarily downgrade the rule to `warn` in frontend/.eslintrc.cjs:30 if needed to unblock a release.

**Risks**
- Future PRs introducing `any` will fail CI; intended and clearly signaled.
- Third‑party typings leaking `any` may require scoped, justified disables at boundaries.

**Readiness Verdict**
- Ready to ship. CI gates are in place; no deploy/monitoring changes needed; rollback is low risk.