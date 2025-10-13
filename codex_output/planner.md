Summary
- Goal: Unblock CI by fixing TS2531 in the shared select component while keeping prior selector design changes intact (modern arrow, dark-mode parity).
- Context: Angular app, shared select at frontend/src/app/shared/ui/select/ui-select.ts. Error arises from calling includes on possibly null value.
- Approach: Minimal, targeted TypeScript fix to safely handle null/primitive vs array; no behavioral or template changes.

Root Cause
- In ui-select.ts:278, code assumes this.value is an array and calls this.value.includes(o.value). At runtime/typing, this.value can be null (or a non-array for single-select), triggering TS2531 and potential runtime errors.

Targeted Fix
- Normalize the value before filtering:
  - Create a safe array: const selected = Array.isArray(this.value) ? this.value : this.value != null ? [this.value] : [];
  - Use selected.includes(o.value) for label derivation.
- Keep onTouched non-private (previously fixed) to avoid TS2341 regression.
- No changes to inputs/outputs or public API; zero impact on consumers.

Scope
- Single-file edit in frontend/src/app/shared/ui/select/ui-select.ts.
- No template/scss refactors. Existing modern styles and icon currentColor alignment remain.

Risks
- Value typing (string | number | string[] | null) mismatches; normalize carefully.
- Ensure options array exists; if it can be null in some flows, guard with optional chaining or default to [].

Validation
- Build: cd frontend && npm ci && npm run build
- Tests: npm test (Karma) to confirm no load errors.
- Manual: verify selects render, labels show correctly for single/multi-select, and no console errors.

Why not React/shadcn integration?
- Repo is Angular. Introducing React/Tailwind/shadcn would exceed “minimal impact” and time constraints. The existing Angular shared select and centralized SCSS already deliver the requested design updates.

```json
{"steps":["coder","code_quality_reviewer","integrator"],"notes":"Fix TS2531 by normalizing the select value before calling `includes`: derive `selected = Array.isArray(this.value) ? this.value : this.value != null ? [this.value] : []` and use it for filtering labels. Keep `onTouched` non-private. No API or template changes; retain existing modern styling and dark-mode behavior. Single-file change: `frontend/src/app/shared/ui/select/ui-select.ts`.","tests":"1) Build: `cd frontend && npm ci && npm run build` (or `ng build --configuration production`) 2) Unit tests: `npm test` to confirm Karma starts with 0 load errors 3) Manual: open pages with selects (Reports, Admin, Settings) and verify that labels render correctly for single/multi-select and there are no console errors. Dark mode still shows visible arrow (currentColor)."}```