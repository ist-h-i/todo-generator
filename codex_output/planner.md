Summary
- Objective: Add “recipes” to each source folder that describe functions and variables with minimal, maintainable change.
- Interpretation: Use per-folder `RECIPE.md` files that summarize exported functions and variables found in `.ts` files.
- Rationale: No existing `docs/recipes` convention is present in this repo; per-folder docs satisfy the issue title directly with the smallest sustainable footprint.

Plan
- Convention: Create `RECIPE.md` per folder under `frontend/src/app/**`.
- Generator: Add a small Node script (`scripts/generate-folder-recipes.mjs`) to scan `.ts` files (excluding `*.spec.ts`) and extract exported functions and variables via simple regex.
- Seed docs: Run the script to generate/refresh `RECIPE.md` across relevant folders.
- Doc guide: Add `docs/recipes/README.md` describing the convention, template, and how to regenerate.

Scope
- Include: `frontend/src/app/**` production code.
- Exclude: `*.spec.ts`, `.html`, `.scss`, `public`, build/test configs.
- Entities: `export function`, `export const/let/var`. (Optional class/interface documentation can be added later, but not required now.)

Why this is minimal
- One script + generated markdown files; no external deps, no build/toolchain changes.
- Idempotent generation to minimize churn; incremental updates easy.
- Avoids introducing a competing per-file recipe convention.

Risks / Open Questions
- Regex extraction may miss edge cases (e.g., re-exports, multi-line exports). Acceptable for initial pass; can refine later.
- Depth: We will scaffold entries with TODO description placeholders; subject-matter owners can fill details incrementally.
- Scope ambiguity (“each folder”): Planning assumes folders under `frontend/src/app/**`; backend or scripts don’t exist here.
- Drift risk: Recommend re-running generator in CI or pre-commit later, if desired.

Execution Steps (high level)
- Implement generator script with directory traversal and export parsing.
- Generate initial `RECIPE.md` files for all folders in scope.
- Add a concise guide at `docs/recipes/README.md` with template and usage.
- Keep the diff small and focused on docs and one script.

Stage Selection
- Choose coder only. The change is self-contained, low-risk, and does not require extra QA or release steps. A code quality pass is optional but not essential for a single script and markdown output.

Tests / Validation
- Run the generator; verify:
  - A few representative folders (e.g., `frontend/src/app/core/api`, `frontend/src/app/features/board`) have `RECIPE.md` with exported functions/variables listed and placeholders for descriptions.
  - Idempotency: running the script twice doesn’t change output absent code changes.
  - No files created outside intended folders; no changes to `.spec.ts` handling.

```json
{"steps":["coder"],"notes":"Adopt per-folder RECIPE.md convention under frontend/src/app/**. Implement a small Node script to parse exported functions/variables from .ts files (excluding tests) and generate RECIPE.md per folder. Seed docs and add a brief guide at docs/recipes/README.md. This minimizes diff and aligns with the issue title while staying within the 30-minute cap.","tests":"1) Run scripts/generate-folder-recipes.mjs. 2) Inspect RECIPE.md in frontend/src/app/core/api and frontend/src/app/features/board for correct listings. 3) Re-run script to confirm idempotency. 4) Spot-check that no test or non-TS files are included."}
```