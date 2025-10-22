**Restated Request**
- Resolve all lint errors and ensure all tests pass.
- Keep diffs minimal and behavior-preserving across backend and Angular frontend.
- Respect repo guidance: language-agnostic rules vs. Angular-specific guidelines.

**Assumptions**
- Backend and frontend each have established lint/test commands.
- No dependency or toolchain changes are allowed (network is restricted).
- Prior minor refactors (string formatting, signal update) are acceptable and behavior-neutral.
- CI gates lint, tests, and possibly formatting.

**Constraints**
- Minimal-impact, targeted changes only; no broad cleanups.
- No new dependencies or substantial config changes.
- Deliver a self-contained, finished outcome quickly (≈30 minutes).
- Follow repo governance and coding conventions.

**Unknowns**
- Exact linters in use (e.g., ruff/flake8, ESLint) and their configs.
- Which rules/tests currently fail and their scope.
- CI-required commands, coverage thresholds, and format requirements.
- Runtime versions (Python/Node) used in CI.

**Clarifying Questions**
- What are the authoritative commands for lint and tests for backend and frontend?
- Are there known failing rules/tests to prioritize?
- Any files/directories to exclude from this pass (generated/legacy)?
- Should we update snapshots (if any) or treat them as failures requiring code changes?
- Is disabling lint rules acceptable, or should we prefer code fixes only?

**Residual Risks / Open Questions**
- Widespread lint issues could expand scope; we will fix only blockers.
- Small refactors might affect edge-case tests; careful, localized changes are required.
- Angular Signals API differences by version could affect “direct updater” usage.
- CI might enforce formatters (Black/Prettier); formatting mismatches could fail builds.