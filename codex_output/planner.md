**Goal**
Add missing per-class/component “recipe” Markdown files for Angular (`frontend/src/app/**`) with the smallest, safe change set.

**Approach**
- Use the existing idempotent generator (`scripts/generate_class_recipes.py`) to create only missing recipes under `docs/recipes/classes/<mirrored path>/<ClassName>.recipe.md`.
- Exclude tests/mocks/stories; do not overwrite existing files.
- If the generator misses edge cases (e.g., `export default class`, multiline declarations), seed only those few stubs manually to keep the diff minimal.

**Why This Fits**
- Minimal impact: docs-only changes, no build/runtime effects, no new deps.
- Fast: single script run plus tiny manual stubs if needed, well within 30 minutes.
- Aligns with prior convention and user’s “per component/class” preference.

**Acceptance Criteria**
- Every targeted Angular class/component lacking a recipe now has `<ClassName>.recipe.md` with:
  - Short purpose/role section
  - Public methods/properties list with TODO one-liners
  - Notable variables/config and usage notes
- Files live under `docs/recipes/classes/` mirroring `frontend/src/app/`.
- Re-running the generator is a no-op (idempotent).

**Risks / Open Questions**
- Regex-based extraction may miss a few classes; covered by manual stubs for those specific cases only.
- Scope assumed to be Angular only. If backend classes are also in scope, that would expand work; not included here to keep changes minimal.

```json
{"steps":["coder"],"notes":"Run the existing idempotent generator to create only missing per-class/component recipes under docs/recipes/classes mirroring frontend/src/app. Avoid overwrites. If the script is unavailable or misses edge cases (e.g., export default class), seed only those few stubs manually to keep the diff small and contained.","tests":"1) Verify generator exists: `ls -l scripts/generate_class_recipes.py`. 2) Generate: `python scripts/generate_class_recipes.py`. 3) Idempotency: re-run and confirm `git status --porcelain` is empty. 4) Coverage sanity: compare counts `rg -n \"^export\\s+(default\\s+)?class\\s+\\w+\" frontend/src/app | wc -l` vs `rg --files docs/recipes/classes/frontend/src/app | rg '\\\\.recipe\\\\.md$' | wc -l`. 5) Spot-check a component and a service for created recipe files under mirrored paths and basic content structure."}
```