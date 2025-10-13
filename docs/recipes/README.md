# Recipe Documentation Overview

Each source file in the todo-generator project must have a companion recipe that explains how it works so future agents can perform high-context updates safely.

## File Naming
- Store recipes under `docs/recipes/` using the relative path to the source file.
- Replace directory separators with double underscores (`__`) and append `.recipe.md`.
  - Example: `backend/app/routers/todos.py` → `docs/recipes/backend__app__routers__todos.py.recipe.md`.

## Required Content
Include the following sections for every recipe:
1. **Purpose & Entry Points** – Describe the feature, public functions, classes, and how callers reach them.
2. **Key Variables & Data Flow** – Document important variables, state interactions, and database or API dependencies.
3. **Interactions & UI Links** – Explain how the file collaborates with other modules or UI components, including signal or observable flows.
4. **Testing Notes** – Reference related tests, fixtures, and expected validation or error scenarios.
5. **Change History** – Summarize notable updates with links to workflow logs when available.

Update recipes whenever the corresponding code changes. If a file has no recipe yet, create one using the naming convention above.
