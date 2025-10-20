**背景**
- Centralized “recipes” under `docs/recipes/` conflicted with the policy to co-locate each recipe with the source it explains.
- Goal: move each recipe next to its target code (one recipe per target directory), update links/tooling, and remove centralized references with minimal impact.

**変更概要**
- Co-located recipes next to code:
  - Examples: `backend/app/main.py.recipe.md`, `backend/app/routers/status_reports.py.recipe.md`, `frontend/src/app/core/api/status-reports-gateway.ts.recipe.md`, `frontend/src/app/features/reports/ReportAssistantPageComponent.recipe.md`.
- Removed centralized collection and added deprecation note:
  - Deleted `docs/recipes/*.recipe.md` and `docs/recipes/classes/frontend/src/app/**`.
  - Rewrote `docs/recipes/README.md` as a migration/deprecation notice.
- Updated docs and navigation:
  - `docs/README.md` and `docs/INDEX.md` now describe co-location and updated paths.
- Updated generators to emit co-located files:
  - `scripts/generate_file_recipes.py` writes `<source>.<ext>.recipe.md` next to the source.
  - `scripts/generate_class_recipes.py` writes `ClassName.recipe.md` next to the TS file.
- Removed centralized-path references in workflow/prompts (e.g., `workflow/README.md`, key `prompts/*.prompt.md`).

**影響**
- Readers and contributors now find recipes beside their source, improving discoverability and reducing drift.
- Any tooling or external docs that assumed `docs/recipes/` must be updated; internal references were adjusted.
- The deprecated `docs/recipes/` path remains only as a migration notice (no live documents).

**検証**
- Searched for stale references to centralized path: `rg -n "docs/recipes/" -S` (no remaining references except the deprecation notice).
- Spot-checked moved files resolve correctly from indices and local links:
  - `frontend/src/app/core/api/status-reports-gateway.ts.recipe.md`
  - `backend/app/routers/status_reports.py.recipe.md`
- Generators output verified to co-located destinations by path inspection.
- Documentation index updated; link resolution confirmed locally via link checks where available.

**レビュー観点**
- Confirm recipe-to-source mapping is correct for cross-cutting topics (choose the most representative directory).
- Ensure generators create files in the intended locations and do not reintroduce centralized paths.
- Validate that internal navigation and any CI docs checks still pass with new paths.
- Residual risks / open questions:
  - External references (wikis, PR templates, downstream docs) may still point to `docs/recipes/*`.
  - Hidden tooling or CI parsers that assumed a centralized directory might need small adjustments.
  - Multiple recipes in one directory (file-level and class-level) could require a naming convention decision.
  - If future recipes include assets, confirm policy to co-locate assets next to each recipe.