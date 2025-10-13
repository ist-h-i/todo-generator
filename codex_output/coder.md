I’ve located the failing code and applied a minimal, safe TypeScript fix to unblock CI.

What I changed
- Fixed null-safe selection label derivation for multi-select
  - frontend/src/app/shared/ui/select/ui-select.ts:279
    - Normalize the current value to a string array and use that for label mapping to avoid calling includes on a possibly null value.

Focused diff (explanation)
- Before: Called this.value.includes(...) inside syncLabelFromValue for multiple mode, which triggered TS2531 when this.value could be null.
- After: Create a safe array first and use it for filtering:
  - selected = Array.isArray(this.value) ? this.value : this.value != null ? [String(this.value)] : []
  - Use selected.includes(o.value) to derive labels.

Other checks
- onTouched is public and callable from the template: frontend/src/app/shared/ui/select/ui-select.ts:60
- isSelected uses Array.isArray guard correctly for includes.

Why this fixes CI
- The TypeScript error (TS2531) came from calling includes on a possibly null value. Normalizing to selected: string[] eliminates that code path while preserving behavior.

Paths to know
- Shared UI select: frontend/src/app/shared/ui/select/ui-select.ts
- Global styles: frontend/src/styles/pages/_base.scss

How to verify locally
- Build: cd frontend && ng build --configuration production
- Tests: npm test (Karma) — confirm no load errors
- Manual: open pages using the shared select (Reports/Admin/Settings) and confirm labels display for single/multi-select without console errors.

Note on the React/shadcn request
- This repo is Angular. Integrating the provided React/shadcn Select component is out of scope and would be invasive here. If you need a React app version, components would live under /components/ui with Tailwind/shadcn setup; I can provide a separate setup guide on request.

Residual risks
- None functional. We only normalized value handling; no API or behavior changes.