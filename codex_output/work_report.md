**背景**
- Goal: Ensure every Angular component/class has a concise “recipe” doc describing purpose, public methods, and key variables.
- Scope: `frontend/src/app/**` only; exclude tests/mocks/stories/generated files.
- Constraints: Minimal diff, docs-only, idempotent; avoid runtime/build changes.

**変更概要**
- Generated missing per-class/component recipe stubs using the existing idempotent tool.
  - Script: `scripts/generate_class_recipes.py`
  - Output convention: `docs/recipes/classes/<mirrored path>/<ClassName>.recipe.md`
  - Excludes `*.spec.ts` and `test.ts`; skips existing files (no overwrites).
- Added stubs for all detected classes lacking recipes (34 files). Examples:
  - `docs/recipes/classes/frontend/src/app/App.recipe.md`
  - `docs/recipes/classes/frontend/src/app/core/profile/ProfileService.recipe.md`
  - `docs/recipes/classes/frontend/src/app/features/board/BoardPage.recipe.md`
  - `docs/recipes/classes/frontend/src/app/shared/ui/select/UiSelectComponent.recipe.md`

**影響**
- Docs-only change; no code, build, or runtime impact.
- Enables consistent, per-class documentation with a mirrored docs path.
- Safe to re-run the generator; no churn due to idempotency.

**検証**
- Generate recipes: `python scripts/generate_class_recipes.py`
- Re-run to confirm idempotency (no new files on second run).
- Sanity-check coverage:
  - Count classes: `rg -n "^\s*export\s+(default\s+)?class\s+\w+" frontend/src/app | wc -l`
  - Count recipes: `find docs/recipes/classes/frontend/src/app -type f -name "*.recipe.md" | wc -l`
- Spot-check created examples to confirm structure and public API listing:
  - `docs/recipes/classes/frontend/src/app/core/logger/Logger.recipe.md`
  - `docs/recipes/classes/frontend/src/app/features/reports/ReportAssistantPageComponent.recipe.md`

**レビュー観点**
- Convention alignment: Per-class under `docs/recipes/classes/` matches user preference; avoids cluttering source.
- Coverage limits: Lightweight parsing may miss rare patterns (e.g., complex multiline class declarations, `export default class`, `static` members).
- Clarity/completeness: Stubs include sections for Purpose, Public API (methods/properties), Dependencies, Usage Notes; owners can fill details incrementally.
- Optional improvements (small/safe):
  - Extend parsing to capture `static` members and `export default class`.
  - Basic `@Input/@Output` awareness for Angular components.
- Open questions:
  - Language depth (English-only vs bilingual JP/EN).
  - Whether to extend beyond Angular to other areas later.
