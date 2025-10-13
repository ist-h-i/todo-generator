**Summary**
- Fixed TypeScript error TS2531 in the shared select by making value handling null-safe.
- Kept scope minimal and behavior unchanged; preserves prior design updates (modern chevron, dark-mode parity).

**Root Cause**
- In multiple-select label sync, `includes` was called on `this.value` which can be `null` or a primitive in single-select mode, triggering TS2531 (Object possibly 'null').

**What Changed**
- Normalize the current value to a safe string array before any `includes` calls.
  - `frontend/src/app/shared/ui/select/ui-select.ts:275`
  - `frontend/src/app/shared/ui/select/ui-select.ts:286`
- Kept `onTouched` public so it remains callable from the template.
  - `frontend/src/app/shared/ui/select/ui-select.ts:60`

**Key References**
- Guarded selection check (already safe):
  - `frontend/src/app/shared/ui/select/ui-select.ts:262`
- Null-safe label derivation (fix for TS2531):
  - `frontend/src/app/shared/ui/select/ui-select.ts:275`
  - `frontend/src/app/shared/ui/select/ui-select.ts:286`

**Why This Works**
- `selected` is always an array:
  - `const selected = Array.isArray(this.value) ? this.value : this.value != null ? [String(this.value)] : [];`
- Filtering now uses `selected.includes(...)`, eliminating the risk of calling methods on `null`.

**Validation**
- Build: `cd frontend && ng build --configuration production`
- Tests: `npm test` (Karma should start without load errors)
- Manual: verify single and multiple selects render correct labels with no console errors.

**Impact**
- Behavior: unchanged; only safer value normalization.
- Styling: no changes in this pass; existing improvements remain (arrow uses `currentColor`, modern option panel styling).
- Scope: single file edit, no API changes.

**Residual Risks / Notes**
- Types remain `string | string[] | null`; normalization prevents runtime/compile errors across modes.
- If any consumers pass non-string values, `String(...)` ensures stable comparison for labels.

**Out of Scope (FYI)**
- The provided React/shadcn Select is not applicable to this Angular app. If a React app is introduced later, UI primitives should live under `/components/ui` with shadcn/Tailwind setup.