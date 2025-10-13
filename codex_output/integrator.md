**Integrator Findings**

- Implemented per-component/class recipe convention for Angular with minimal impact.
  - Generator added: `scripts/generate_class_recipes.py:1` (idempotent; skips existing; excludes `*.spec.ts` and `test.ts`).
  - Output location: `docs/recipes/classes/<mirrored path>/<ClassName>.recipe.md`.
  - Captures public methods/properties via lightweight parsing.

- Docs updated to guide usage.
  - `docs/recipes/README.md:1` includes “Per-Class/Component Recipes (Angular)” with commands and structure.
  - Existing per-file generator retained for backend/frontend files: `scripts/generate_file_recipes.py:1`.

- Seeded representative class recipes (ready for owners to refine).
  - `docs/recipes/classes/frontend/src/app/App.recipe.md:1`
  - `docs/recipes/classes/frontend/src/app/features/board/BoardPage.recipe.md:1`
  - `docs/recipes/classes/frontend/src/app/core/profile/ProfileService.recipe.md:1`

- Scope & alignment
  - Matches request to document at the component/class level.
  - Keeps codebase untouched; changes are scripts + docs only.
  - Idempotent generation to minimize churn and future maintenance burden.

- Residual risks / open items
  - Regex-based extraction may miss edge cases (multiline signatures, getters/setters on same line, decorators split across lines). Acceptable for starter stubs.
  - Coverage currently seeded; repo-wide generation would add many files. Run selectively to keep diffs small.

- Next actions (optional)
  - Generate additional class recipes where needed: `python scripts/generate_class_recipes.py frontend/src/app/<target-folder>`.
  - Team can iteratively fill descriptions in created stubs while keeping structure consistent.