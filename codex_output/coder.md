**Summary**
- Implemented per-component/class “recipe” docs for the Angular app with minimal impact.
- Added an idempotent generator that creates one recipe per exported class under a mirrored docs path.
- Seeded 3 representative class recipes.

**What Changed**
- New generator: `scripts/generate_class_recipes.py:1`
  - Scans `frontend/src/app/**.ts` (excludes `*.spec.ts`, `test.ts`).
  - Finds `export class ...` and extracts a best‑effort list of public methods/properties.
  - Writes one file per class under `docs/recipes/classes/<mirrored path>/<ClassName>.recipe.md`.
  - Idempotent: skips existing files; no overwrites.
- Updated guide: `docs/recipes/README.md:1`
  - Adds “Per-Class/Component Recipes (Angular)” section with convention and usage.
- Seeded examples:
  - `docs/recipes/classes/frontend/src/app/App.recipe.md:1`
  - `docs/recipes/classes/frontend/src/app/features/board/BoardPage.recipe.md:1`
  - `docs/recipes/classes/frontend/src/app/core/profile/ProfileService.recipe.md:1`

**How To Use**
- Generate all Angular class recipes:
  - `python scripts/generate_class_recipes.py`
- Limit to a folder:
  - `python scripts/generate_class_recipes.py frontend/src/app/core/profile`
- Edit the generated stubs to fill in descriptions for methods and properties.

**Why This Fits The Request**
- Aligns to “per component/class” preference while keeping changes small and additive.
- Keeps existing per-file recipe tooling (`scripts/generate_file_recipes.py:1`) intact for backend and file-level docs.

**Notes / Risks**
- Extraction is regex-based and may miss edge cases (multiline signatures, complex getters/setters, decorators on separate lines).
- Visibility filter is simple (skips `private`/`protected` on the same line).
- Scope limited to Angular classes; does not generate for backend Python (covered by existing per-file generator).

**Optional Next Steps**
- If desired, I can run the class generator across `frontend/src/app` to pre-seed more recipes, or extend parsing to capture inputs/outputs and decorators.
