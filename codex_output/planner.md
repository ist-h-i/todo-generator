**Summary**
- Goal: Add per-component/class “recipe” Markdown docs that briefly describe purpose, public methods, and key variables, with minimal repo impact.
- Resolution: Generate `<ClassName>.recipe.md` under `docs/recipes/<mirrored path>/` for Angular classes/components, excluding tests. Keep changes to a single small generator + a few seeded examples.

**Approach**
- Convention: One file per class/component named `<ClassName>.recipe.md`.
- Location: `docs/recipes/<frontend/src/... mirrored directories>/`.
- Extraction (lightweight): Find `export class` and classes decorated with `@Component`, `@Injectable`, `@Directive`, `@Pipe`. Collect public methods/properties via simple regex (best-effort starter).
- Idempotent: Do not overwrite existing recipe files; safe to re-run.

**Scope**
- Include: `frontend/src/app/**` TypeScript source.
- Exclude: `*.spec.ts`, mocks, stories, generated assets.
- Coverage: Public API first; add placeholders for descriptions.

**Deliverables**
- Script: `scripts/generate_class_recipes.mjs` (Node, no deps).
- Seeded examples for 2–3 representative classes/components.
- Brief `docs/recipes/README.md` section on usage.

**Risks / Open Questions**
- Regex parsing may miss edge cases (re-exports, multi-line signatures); acceptable for initial pass.
- Placement confirmed as `docs/recipes/` mirror to avoid cluttering source tree.
- If backend exists and is in-scope later, extend script similarly.

**Validation**
- Run the script; verify recipe files appear in mirrored paths for a couple of key folders.
- Re-run to confirm idempotency (no changes if files exist).
- Spot-check a component and a service for reasonable public API capture.

```json
{"steps":["coder"],"notes":"Implement an idempotent Node script to generate per-class/component recipe stubs under docs/recipes mirroring frontend/src/app, exclude tests, and seed a few examples. Keep diff minimal: one script, small README note, and 2–3 recipe files.","tests":"1) Run `node scripts/generate_class_recipes.mjs`. 2) Confirm docs/recipes/frontend/src/app/.../<ClassName>.recipe.md created for a few folders. 3) Run again to verify idempotency. 4) Spot-check a component and a service for listed public methods/properties."}