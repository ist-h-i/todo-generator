**Restatement**

Fix the documentation “recipe” folder structure. Each recipe must live alongside the specific source code it explains (one recipe per target directory), not grouped centrally under a documentation folder.

**Intended Outcome**

- Move existing recipes from any centralized docs location into the same directories as their referenced source code.
- Update all links, indexes, and build/preview tooling so documentation resolves correctly after the move.
- Remove or deprecate the centralized recipes folder once references are updated.

**Assumptions**

- “Recipe” = self-contained guidance (likely Markdown) tied to a specific source file/folder.
- Each recipe explains exactly one code target and should be co-located with that target’s directory.
- Linkable indices (e.g., README, docs site navigation) must continue to work post-move.
- Non-Angular parts follow the same co-location rule.

**Constraints**

- Minimize changes; touch only what’s needed to align structure.
- Deliver a complete, self-contained fix (no partial moves or broken links).
- No network access; operate within current workspace.
- Keep language-agnostic standards and Angular-specific rules separate per repository guidelines.

**Success Criteria**

- No centralized “recipes” collection remains referenced.
- All recipe links in docs, READMEs, and navigation resolve.
- Any docs tooling (site generator, CI checks, link checkers) passes with the new paths.
- Clear mapping from each recipe to its target source directory.

**Residual Risks / Open Questions**

- Broken links if any external references or hardcoded paths point to old locations.
- Tooling that assumes a centralized recipes path (site generators, link checkers) may need config updates.
- Ambiguity in identifying which source directory a given recipe belongs to.
- Asset paths inside recipes (images/code snippets) may break after relocation.
- Naming collisions or conventions (e.g., multiple recipes per directory) not yet defined.

## Clarifying questions

- Where are recipes currently stored (exact path, e.g., `docs/recipes/`), and what are their file patterns (e.g., `*.md`)?
- What is the canonical naming convention for recipe files (e.g., `README.recipe.md`, `recipe.md`, or `<feature>.recipe.md`) after relocation?
- How should we determine the target directory when a recipe covers multiple files or a cross-cutting concern?
- Are there build or docs-generation tools that index recipes by their current location (please specify config/files to update)?
- Should we update central indices/navigation to point to new locations, or generate them dynamically?
- How should embedded assets (images, code samples) be handled—move alongside the recipe or keep a shared assets directory?
- Do any non-doc consumers (scripts, CI) rely on the old structure?
- Is there a preferred fallback for directories already containing a `README.md` (append section vs. separate `recipe.md`)?
- Are Angular-specific recipes subject to any additional placement rules relative to the Angular guidelines?