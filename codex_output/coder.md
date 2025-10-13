**What I Implemented**
- Added a generator script to create per-file recipe stubs that match the existing convention in docs/recipes/README.md.
- Seeded representative recipe files for key backend and frontend areas to demonstrate the pattern.
- Updated the recipes README with simple usage instructions.

**Files Added**
- `scripts/generate_file_recipes.py:1` – Python script that:
  - Scans `backend/app/**/*.py` and `frontend/src/**/*.ts` (excludes tests and specs).
  - Creates missing recipe stubs in `docs/recipes/` with the naming `relative_path` using `__` separators + `.recipe.md`.
  - Extracts a best-effort list of top-level functions/variables (Python via `ast`, TypeScript via regex for `export function` and exported vars).
  - Never overwrites existing recipes.

- `docs/recipes/backend__app__main.py.recipe.md:1` – Seeded stub for API entrypoint.
- `docs/recipes/backend__app__routers__status_reports.py.recipe.md:1` – Seeded stub for status reports API router.
- `docs/recipes/backend__app__services__status_reports.py.recipe.md:1` – Seeded stub for service orchestration.
- `docs/recipes/frontend__src__app__app.ts.recipe.md:1` – Seeded stub for Angular root component.
- `docs/recipes/frontend__src__app__core__api__status-reports-gateway.ts.recipe.md:1` – Seeded stub for gateway service.

**File Updated**
- `docs/recipes/README.md:1` – Added “Generator (optional)” section showing how to seed missing recipes.

**How to Use**
- Seed recipes for default scopes (backend/app and frontend/src):
  - `python scripts/generate_file_recipes.py`
- Limit to a folder:
  - `python scripts/generate_file_recipes.py backend/app/routers`
- Limit to a specific file:
  - `python scripts/generate_file_recipes.py frontend/src/app/core/api/status-reports-gateway.ts`

**Notes**
- I aligned to the repo’s existing per-file recipe standard at `docs/recipes/README.md` rather than introducing a per-folder format, to avoid conflicts and minimize churn.
- The generator is idempotent and will not overwrite existing recipe files.
- Extraction is intentionally simple; it may miss complex/indirect exports (re-exports, multiline declarations). Stubs include clear TODOs for owners to fill in details.

**Open Questions / Risks**
- Scope breadth: The issue title mentions “per-folder,” while the repository standard is per-file. If per-folder summaries are also desired, I can add a lightweight folder-level `RECIPE.md` convention that references per-file recipes.
- Depth of “variables”: I currently document top-level module variables (Python) and exported variables (TypeScript). If deeper coverage (e.g., class fields, method params) is required, the parser can be extended.
- If you want me to run the generator repo-wide and add all missing recipes now, I can do that next.