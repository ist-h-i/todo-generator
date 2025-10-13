**背景**
- Goal: Provide “recipe” docs per component/class describing public methods and key variables with minimal churn.
- User preference: Per component/class, not per folder/file.
- Scope: Angular app under `frontend/src/app/**`; exclude tests, mocks, stories, generated assets.
- Constraints: Small, self-contained diff; no runtime/build impact; idempotent tooling.

**変更概要**
- Added per-class/component generator: `scripts/generate_class_recipes.py:1`
  - Scans `frontend/src/app/**/*.ts` excluding `*.spec.ts` and `test.ts`.
  - Detects `export class` and common Angular decorators (`@Component`, `@Injectable`, `@Directive`, `@Pipe`).
  - Extracts public API (public methods/properties) best-effort via lightweight parsing.
  - Writes one recipe per class at `docs/recipes/classes/<mirrored path>/<ClassName>.recipe.md`.
  - Idempotent: skips existing files; no overwrites.
- Kept prior per-file generator (for backend or file-level docs) available: `scripts/generate_file_recipes.py:1`
- Seeded a few representative class recipes to demonstrate structure.
- Updated `docs/recipes/README.md:1` with brief usage and convention notes.

**影響**
- No application code changes; build/runtime unaffected.
- Enables incremental documentation by class/component with minimal maintenance overhead.
- Dual paths supported: per-class for Angular, per-file for backend where useful.

**検証**
- Generate class recipes: `python scripts/generate_class_recipes.py`
- Spot-check output paths:
  - Examples under `docs/recipes/classes/frontend/src/app/**/<ClassName>.recipe.md`
- Confirm idempotency: re-run command; no changes to existing files.
- Verify exclusions: no recipes for `*.spec.ts`, `test.ts`, mocks, or non-TS assets.
- Content sanity: public methods/properties listed; TODO placeholders ready for authors.

**レビュー観点**
- Convention fit: Per-class/component aligns with request; placement under `docs/recipes/classes/` avoids source-tree clutter. Confirm team preference on location.
- Coverage limits: Regex/lightweight parsing may miss multi-line signatures, getters/setters, or complex decorators; acceptable for initial stubs.
- Depth: Currently documents public API; extend if private members are critical.
- Adoption: Decide whether to run generator broadly now or seed per-feature gradually to keep diffs small.
- Next small improvements (optional): support `export default class`, include `static` members, basic `@Input/@Output` capture, and a “Skipped existing” summary in script output.