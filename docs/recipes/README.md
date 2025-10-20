# Recipes Directory (Deprecated)

This centralized `docs/recipes/` folder is deprecated. Recipes are now co-located next to the source code they document to keep guidance close to implementation.

New policy (effective immediately):
- Per-file recipes: place a `*.recipe.md` next to the source file (e.g., `backend/app/main.py.recipe.md`).
- Angular class/component recipes: place `ClassName.recipe.md` in the same directory as the TypeScript file (e.g., `frontend/src/app/core/api/StatusReportsGateway.recipe.md`).

Content expectations remain the same:
1. Purpose & Entry Points – feature, public functions/classes, routes, and entry paths.
2. Key Variables & Data Flow – meanings, defaults, mutation points, dependencies, and where used.
3. Interactions & UI Links – collaborating modules, DI wiring, signals/observables, and bindings.
4. Testing Notes – tests, fixtures, validation paths, and error scenarios.
5. Change History – notable updates with links to workflow logs and related recipes.

Generators:
- File-level: `python scripts/generate_file_recipes.py` (creates `<file>.<ext>.recipe.md` next to the file when missing).
- Angular class-level: `python scripts/generate_class_recipes.py` (creates `ClassName.recipe.md` next to the TS file directory, one per exported class).

Do not add new recipe documents here. If you find an old file in this directory, relocate it next to its source and update links accordingly.
