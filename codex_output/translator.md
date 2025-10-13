**Request Summary**
- Add “recipes” documenting source code. Specifically: create .md files that describe each function and variable. Title suggests per-folder recipes; body suggests per-source-file documentation.

**Assumptions**
- Use the existing recipe standard in `docs/recipes/README.md` (per-file “recipe” docs with naming `docs/recipes/<relative_path with __>.recipe.md`).
- Scope includes both backend (`backend/app/**`) and frontend Angular app (`frontend/src/**`), excluding tests and generated assets unless requested.
- Focus on public-facing functions/classes and important variables; internal/private items documented when they materially affect behavior.

**Constraints**
- Minimize changes and churn; prefer a small, targeted set of docs or stubs that align with the existing recipe convention.
- Fit within a 30-minute window; avoid attempting exhaustive coverage in one pass.
- Keep consistent with the Development Governance Handbook and Angular guidelines linked in `docs/`.

**Unknowns**
- Whether “per-folder” recipes are required in addition to (or instead of) the existing per-file recipe convention.
- Exact coverage: all files vs. selected “core” files; include tests?
- Depth: brief summaries vs. exhaustive descriptions for every variable.
- Priority areas (e.g., critical services, APIs, or high-churn modules).

**Clarifying Questions**
- Should we follow the current per-file recipe convention in `docs/recipes/README.md`, or create per-folder recipes (or both)?
- Which code areas are in-scope first: backend, frontend, or both? Any priority directories?
- Do you want to include tests and scripts, or only production code?
- What depth is expected for “variables”: only exported/public, or all locals where relevant?
- Is an initial set of stubs acceptable (to minimize diff), with a plan to incrementally fill details?

**Risks / Impacts**
- Exhaustive documentation of every function/variable across the repo is large and time-consuming; high risk of drift if not incrementally maintained.
- Introducing a new per-folder pattern may conflict with the existing per-file recipe standard unless explicitly aligned.