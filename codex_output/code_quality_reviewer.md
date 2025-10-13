**Summary**
- Per-class/component recipe generator added and seeded with examples; aligns with “per component/class” request.
- Docs clarify both per-file (general) and per-class (Angular) conventions.

**What Looks Good**
- Clear, minimal tooling with idempotent behavior; no overwrites.
  - `scripts/generate_class_recipes.py:1` mirrors paths under `docs/recipes/classes/` and lists public API.
  - `scripts/generate_file_recipes.py:1` supports per-file stubs for backend/frontend.
- Concise README guidance and commands.
  - `docs/recipes/README.md:1` documents both generators and when to use them.
- Seeded class recipes are practical and readable.
  - `docs/recipes/classes/frontend/src/app/App.recipe.md:1`
  - `docs/recipes/classes/frontend/src/app/features/board/BoardPage.recipe.md:1`
  - `docs/recipes/classes/frontend/src/app/core/profile/ProfileService.recipe.md:1`

**Meets Request**
- “Per component/class” is satisfied via `scripts/generate_class_recipes.py` and seeded outputs.
- Scope minimized to docs + scripts; no runtime changes.

**Small, High-Value Improvements**
- Capture static members: extend matchers to include `static` (e.g., allow `(?:public\\s+)?(?:static\\s+)?`).
  - Methods: update `METHOD_RE` in `scripts/generate_class_recipes.py:68`.
  - Properties: update `PROPERTY_RE` in `scripts/generate_class_recipes.py:72`.
- Count skipped files for visibility: print “Skipped existing” in `scripts/generate_class_recipes.py:208` for parity with file generator.
- Optional: detect default-exported classes (`export default class`) to increase coverage.
- Optional: basic awareness of decorators to better capture `@Input/@Output` names when split across lines (current heuristic already catches most properties).

**Risks / Limitations**
- Regex parsing can miss edge cases (multiline syntax, nested braces in strings/comments). Acceptable for initial pass.
- Dual conventions (per-file vs per-class) are both present; README already positions Angular to use per-class, backend to use per-file—keep this distinction consistent in practice.

**Verdict**
- Approve as delivered. No required fixes. The optional improvements above are small, safe, and would increase coverage and ergonomics.