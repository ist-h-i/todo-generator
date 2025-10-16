Summary
- Confirmed repository-wide index exists at docs/INDEX.md and cross-links are present in README.md and docs/README.md.
- Made one precise improvement: updated the Angular route search tip in docs/INDEX.md to match the actual `appRoutes: Routes = [...]` pattern.

What changed
- docs/INDEX.md
  - Search Tips → Routes: corrected ripgrep pattern to match real usage.
    - Updated to: `rg -n "export const .*Routes|appRoutes|Routes\\s*=\\s*\\[" frontend/src/app`

Verification
- Cross-links present:
  - README.md:150: [Repository Index & Map](docs/INDEX.md)
  - docs/README.md:42: [Repository Index & Map](INDEX.md)
- Key docs exist:
  - docs/governance/development-governance-handbook.md
  - docs/guidelines/angular-coding-guidelines.md
  - docs/ui-design-system.md
  - docs/ui-layout-requirements.md
- Index exists:
  - docs/INDEX.md

Why this meets the goal
- Newcomers can find top-level areas in 1–2 clicks from the root README, and the index gives clear entry points across frontend, backend, docs, scripts, and CI.
- Kept scope minimal (single-line fix) and avoided structural changes.

Residual risks / notes
- The index intentionally focuses on high-traffic directories for brevity; extend as new top-level areas are added.
- If routing conventions change (e.g., renaming `appRoutes`), update the search tip accordingly.