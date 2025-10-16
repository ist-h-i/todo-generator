**Request Summary**
- Add missing per-class/component “recipe” Markdown files that describe each class’s functions and variables.
- Keep changes minimal, targeted, and self-contained.
- Prior work suggests a per-class approach for Angular under `frontend/src/app/**` with generated stubs.

**Assumptions**
- Primary scope is Angular classes/components/services/directives/pipes in `frontend/src/app/**`.
- Recipes live under a mirrored docs path (e.g., `docs/recipes/classes/<mirrored path>/<ClassName>.recipe.md`).
- Existing generator `scripts/generate_class_recipes.py:1` can be used to add only missing recipes (idempotent, no overwrites).
- Content focuses on public API (public methods/properties) plus brief purpose/notes; private members optional.

**Constraints**
- Minimal diff; avoid runtime/build changes.
- No new dependencies; no restructuring.
- Complete and self-contained outcome (missing classes get recipes).
- Exclude tests, mocks, stories, and generated files.

**Unknowns**
- Exact coverage scope: Angular only, or include non-Angular/ backend classes too?
- Inclusion criteria: only exported classes / Angular-decorated types, or all classes?
- Language: English only vs bilingual (JP/EN)?
- Final location convention: confirm `docs/recipes/classes/` mirrored structure as the standard.

**Proposed Approach (Minimal Impact)**
- Use `scripts/generate_class_recipes.py:1` to scan `frontend/src/app/**` and create stubs for classes lacking recipes only.
- Verify idempotency (skip existing files) and exclusions.
- If generator misses some classes (e.g., `export default class`, multiline declarations), add those few stubs manually to keep the diff small.

**Acceptance Criteria**
- All targeted classes without existing recipes now have `<ClassName>.recipe.md` with:
  - Purpose/role
  - Public methods/properties list (one-line descriptions as TODOs acceptable)
  - Notable variables/config and usage notes
- Files placed under the agreed docs path; no source code changes.

**Clarifying Questions**
- Confirm scope: Angular `frontend/src/app/**` only, or include other areas (backend/scripts)?
- Confirm placement: keep using `docs/recipes/classes/<mirrored path>/`?
- Document only exported/decorated classes, or any class found?
- Language preference: English only, or add Japanese alongside?