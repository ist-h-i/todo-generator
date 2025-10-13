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
