**Request Summary**
- Add “recipe” Markdown docs that explain source code elements with minimal changes.
- User preference: organize recipes per component/class (not per folder or per file).
- Content focus: describe functions and variables for each component/class.

**Assumptions**
- Target code: Angular SPA (`frontend/src/app/**`). Include services, components, directives, pipes, and core classes.
- Exclude tests, mocks, stories, generated files.
- Document public API first (public methods/properties); include private items only when essential.
- Language: English (per working language), with simple structure that collaborators can extend.

**Constraints**
- Keep the diff small; avoid large-scale restructuring or new dependencies.
- Finish with a self-contained, usable outcome in a short time box.
- Align with Development Governance and Angular Coding Guidelines.

**Proposed Approach (Minimal Impact)**
- Convention: one recipe per component/class unit named `<ClassOrComponent>.recipe.md`.
- Placement: either
  - A) alongside the source file, or
  - B) under `docs/recipes/<mirrored path>/`.
- Content: brief overview, responsibility, list of public methods/properties with one-line explanations, notable variables/config, and usage notes.

**Unknowns**
- Exact placement preference (co-located vs `docs/recipes/` mirror).
- Scope breadth (Angular only vs also backend/scripts if present).
- Depth for variables (exported/public only vs all relevant).
- Required language (English only vs bilingual JP/EN).
- Whether to include auto-generation tooling or keep entirely manual for now.

**Clarifying Questions**
- Where should recipe files live?
  - Co-located next to `.ts` files, or under `docs/recipes/` mirroring paths?
- Scope confirmation: Angular SPA only, or include other code areas too?
- Coverage: document only public API, or include private members as well?
- Naming: confirm `<ClassOrComponent>.recipe.md` per class/component is acceptable.
- Language: English only, or bilingual JP/EN?
- Do you want a small script to scaffold stubs (idempotent, no overwrites), or manual creation for selected key components first?

**Acceptance Criteria (Proposed)**
- Each selected component/class has a `<ClassOrComponent>.recipe.md` with:
  - Purpose/role, key responsibilities
  - Public methods/properties with one-line descriptions
  - Important variables/config and constraints
  - Notes on usage and dependencies
- Files are placed per agreed convention and exclude tests.
