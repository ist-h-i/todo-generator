Plan summary
- Keep scope minimal and style-only. Do not introduce React/shadcn into this Angular repo.
- Centralize the fix in the global select styles so both native selects and the shared Angular select inherit the correct icon color in dark mode.

What I’ll have the coder do
- Update caret color to inherit text color:
  - In `frontend/src/styles/pages/_base.scss`, ensure the chevron (background-image) uses `currentColor` (no hard-coded gray). If a variable is used, define `--select-caret-color: currentColor` and reference it in the gradient.
- Enforce dark-mode inheritance:
  - In the dark theme block(s) in `frontend/src/styles/pages/_base.scss`, ensure the select trigger `color` is set to the dark theme foreground token used for text, so the caret inherits a high-contrast value.
- Align the custom Angular select icon to currentColor (safety belt):
  - In `frontend/src/app/shared/ui/select/ui-select.ts` styles/template, ensure the icon element/class (e.g., `.ui-select__icon`) uses `color: currentColor` and the SVG uses `stroke="currentColor"` or inherits via CSS. No behavior changes.

Why this is minimal
- One SCSS file change covers `.app-select` and `select.form-control` app‑wide.
- A tiny style nudge in the Angular select ensures consistency in case an inline SVG overrides inheritance.
- No template/TS logic changes, no new dependencies, no design-system drift.

Risks and mitigations
- Unknown dark-mode selector: I’ll reuse the existing dark theme block(s) already present in `frontend/src/styles/pages/_base.scss`.
- If any module forces a different icon color, the global `currentColor` approach still respects local text color, keeping behavior predictable.

Manual verification
- Build: `cd frontend && npm ci && npm run build` (production) and smoke test pages using selects.
- Check in dark mode that the down-arrow matches the trigger text color and is clearly visible; verify hover/focus/disabled states, and that multi/size variants remain unchanged.

```json
{"steps":["coder","code_quality_reviewer","integrator"],"notes":"Centralize a style-only fix so the select caret (down-arrow) inherits `currentColor`. In `frontend/src/styles/pages/_base.scss`, ensure the chevron gradients use `currentColor` and the dark-mode block sets an appropriate text color so the caret contrasts. Add a small safeguard in `frontend/src/app/shared/ui/select/ui-select.ts` to ensure the icon/SVG inherit `currentColor`. No behavior changes or new deps; Angular-only solution (no React/shadcn).","tests":"1) Build: cd frontend && npm ci && npm run build. 2) Open dark mode and verify on pages with selects that the down-arrow matches the text color and is clearly visible. 3) Confirm light/dark parity for hover/focus/disabled states; multi-select/size>1 variants still hide the caret; no regressions on Reports/Admin/Settings selects."}
```