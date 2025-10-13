**背景**
- Goal: Eliminate explicit any in frontend, align with Angular v20 best practices, and update docs with minimal diffs.
- Current state matches planned fixes; no additional changes required to meet the objective within scope/timebox.

**変更概要**
- Code: Strongly typed internal value in the select CVA; only framework-required `writeValue(obj: any)` remains.
  - Reference: `frontend/src/app/shared/ui/select/ui-select.ts:205`
- Lint: `@typescript-eslint/no-explicit-any` enforced globally with a narrow override for the CVA file.
  - Global rule: `frontend/.eslintrc.cjs:30`
  - File-scoped override: `frontend/.eslintrc.cjs:36`
- TS/Angular strictness: `strict` and strict template checks enabled.
  - TS strict: `frontend/tsconfig.json:6`
  - Template checks: `frontend/tsconfig.json:32`
- Docs: Angular guidelines and governance updated to prohibit explicit any, prefer unknown/generics, discourage `$any(...)` in templates, and document the CVA exception.

**影響**
- Type safety in TS sources improved and enforced; future explicit any usage fails lint (except the CVA signature).
- Runtime behavior unchanged; templates untouched to minimize risk and diff size.

**検証**
- Search: Only explicit any in TS is the CVA method parameter.
  - Example command: `rg -n "\bany\b" -S -t ts frontend/src | rg -v "\.html:"`
- Lint/build (CI/local): `cd frontend && npm run lint && npm run build`
- Settings confirmed: TS `strict` and Angular strict template checks active.

**レビュー観点**
- Acceptance: If “zero any” applies to TS code (excluding the CVA signature), the target is met. If it includes template `$any(...)`, plan a small follow-up to type controls/events and remove a subset incrementally.
- Scope control: Changes are minimal and localized; no unrelated refactors or upgrades.
- PR flow: Confirm whether to update PR #507 or open a new, focused PR summarizing the verification and documentation alignment.
- Residual risk: Numerous `$any(...)` casts in templates remain; safe removal requires per-template typing and should be addressed in small batches.