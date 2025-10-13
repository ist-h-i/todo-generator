# Recipe Documentation Overview

Each source file in the todo-generator project must have a companion recipe that explains how it works so future agents can perform high-context updates safely. Treat recipes as living design records that evolve with every change.

## File Naming
- Store recipes under `docs/recipes/` using the relative path to the source file.
- Replace directory separators with double underscores (`__`) and append `.recipe.md`.
  - Example: `backend/app/routers/todos.py` → `docs/recipes/backend__app__routers__todos.py.recipe.md`.

## Required Content
Include the following sections for every recipe and update them whenever behaviour changes:
1. **Purpose & Entry Points** – Describe the feature, public functions, classes, exposed routes, and how callers reach them.
2. **Key Variables & Data Flow** – Document important variables (meanings, default values, mutation points), state interactions, and database or API dependencies. Call out where each variable is used in code or templates.
3. **Interactions & UI Links** – Explain how the file collaborates with other modules or UI components, including signal/observable flows, dependency injection wiring, and UI binding details.
4. **Testing Notes** – Reference related tests, fixtures, validation paths, and expected error scenarios.
5. **Change History** – Summarize notable updates with links to workflow logs and upstream/downstream recipe dependencies.

Update recipes whenever the corresponding code changes or new context emerges. If a file has no recipe yet, create one using the naming convention above, and keep prior sections intact while appending new knowledge instead of overwriting history.

## Generator (optional)
You can seed missing recipes using a helper script:

- Generate for defaults (backend/app and frontend/src):
  - `python scripts/generate_file_recipes.py`
- Limit to a specific folder or file:
  - `python scripts/generate_file_recipes.py backend/app/routers`
  - `python scripts/generate_file_recipes.py frontend/src/app/core/api/status-reports-gateway.ts`

The generator creates recipe stubs only when missing and will not overwrite existing files.

## Per-Class/Component Recipes (Angular)
- Purpose: When documenting Angular, prefer per-class/component “recipes” focused on public APIs.
- Location: `docs/recipes/classes/<frontend/src/... mirrored directories>/<ClassName>.recipe.md`.
- Generate stubs (idempotent):
  - All Angular classes: `python scripts/generate_class_recipes.py`
  - Scoped path: `python scripts/generate_class_recipes.py frontend/src/app/core/profile`

Each class recipe should include:
1) Purpose & Responsibilities – one or two sentences.
2) Public API – methods and properties with one-line explanations.
3) Notable Dependencies – injected services, inputs/outputs.
4) Usage Notes – typical call patterns and pitfalls.
5) Change History – key modifications and rationale.
