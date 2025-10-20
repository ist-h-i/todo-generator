**Overview**
Fix docs recipe structure by co-locating each recipe with the code it explains, updating all links/indexes/tooling, and removing the centralized recipes folder without breaking navigation or builds.

**30-Minute Plan**
- Inventory current recipes and centralized path (e.g., docs/recipes).
- Map each recipe to its target code directory using filename/front-matter/links.
- Move recipes next to their target code; preserve relative assets.
- Update internal links and indices; adjust docs config if needed.
- Run docs/link checks; fix any broken references.
- Remove/deprecate centralized folder; add a redirect stub if mandated.

**Critical Risks**
- Hidden hardcoded paths in docs site configs or scripts.
- Ambiguous recipe-to-target mapping (cross-cutting topics).
- Broken embedded asset paths after relocation.
- Multiple recipes in one target directory without a naming convention.

**Assumptions**
- Recipes are Markdown with stable identifiers in filenames or front-matter.
- A docs site or link checker exists and can run locally via scripts.
- Co-location applies repo-wide, including Angular and non-Angular code.

**Clarifying Questions**
- Exact current location and pattern: is it `docs/recipes/**/*.md`?
- Naming convention post-move: `recipe.md`, `<feature>.recipe.md`, or `README.recipe.md`?
- Handling cross-cutting recipes: primary directory + backlinks or keep a pointer?
- Which docs tooling indexes recipes (mkdocs, docusaurus, vitepress)? Config files to update?
- Asset policy: move alongside or central shared assets directory?
- Any CI or scripts rely on the old path?
- If a directory already has `README.md`, should recipe be a separate file?

**Minimal Stage Route**
- Choose coder-only to keep the route lean; the work is file moves plus link/config updates that a single stage can complete within 30 minutes. Add reviewers only if tooling updates become non-trivial.

**Validation**
- Build docs (or run link checker) to ensure no broken links.
- Grep for stale paths pointing to the old centralized folder and confirm zero results.
- Spot-check a few moved recipes from index/navigation to their targets.

```json
{"steps":["coder"],"notes":"Coder inventories docs/recipes, maps each recipe to its source directory, moves files and any local assets, updates all internal links and docs navigation/configs, runs docs build/link-checks, and removes the centralized folder. Risks: hidden hardcoded paths, ambiguous mapping, asset path breakage. If ambiguity arises, coder uses a pointer stub and flags for follow-up.","tests":"1) Run docs build (e.g., `npm run docs:build` or repo-specific) and ensure success. 2) Run link checker if available (e.g., `npm run docs:check-links`). 3) Search for old path references: `rg -n \"docs/recipes\"` -> expect no matches. 4) Open a few key indices and ensure links resolve to co-located recipes."}
```