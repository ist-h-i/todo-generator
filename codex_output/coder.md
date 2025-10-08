Summary
- Implemented a centralized SCSS-only update to modernize selectors (dropdowns) and fix caret spacing.
- Extended existing `.app-select` styles to also cover `select.form-control` with no template changes.
- Increased right padding and shifted caret gradients left to avoid being flush to the edge.
- Preserved tokens, states, and dark-mode variants.

Files Changed
- frontend/src/styles/pages/_base.scss:85
  - Extended selector from `.app-select` to `.app-select, select.form-control`.
  - Increased right padding and nudged caret positions:
    - Padding: from `calc(1.1rem + 1.85rem)` to `calc(1.1rem + 2.25rem)`.
    - Caret positions: from `calc(100% - 1.35rem)` and `calc(100% - 0.85rem)` to `calc(100% - 1.85rem)` and `calc(100% - 1.35rem)`.

Focused Diffs (replacement blocks)
- Base selector styles (adds `select.form-control`, adjusts spacing)
  - frontend/src/styles/pages/_base.scss:85–127
    - Before: `.app-select { padding: 0.85rem calc(1.1rem + 1.85rem) ... background-position: calc(100% - 1.35rem), calc(100% - 0.85rem) }`
    - After: `.app-select, select.form-control { padding: 0.85rem calc(1.1rem + 2.25rem) ... background-position: calc(100% - 1.85rem), calc(100% - 1.35rem) }`
- Hover state
  - frontend/src/styles/pages/_base.scss:129–136
    - Extended to `.app-select:hover:not(:disabled), select.form-control:hover:not(:disabled)`
- Focus state
  - frontend/src/styles/pages/_base.scss:138–147
    - Extended to `.app-select:focus-visible, select.form-control:focus-visible`
- Disabled state
  - frontend/src/styles/pages/_base.scss:149–166
    - Extended to `.app-select:disabled, select.form-control:disabled`
- Options background
  - frontend/src/styles/pages/_base.scss:168–172
    - Extended to `.app-select option, select.form-control option`
- Multiple/size variant (no caret)
  - frontend/src/styles/pages/_base.scss:174–182
    - Extended to include `select.form-control[multiple]` and `select.form-control[size]:not([size='1'])`
- Dark theme base/hover/focus/options
  - frontend/src/styles/pages/_base.scss:184–202, 204–211, 213–218, 220–223
    - Extended `.dark .app-select` selectors to include `.dark select.form-control`
- Hide IE arrow
  - frontend/src/styles/pages/_base.scss:225–228
    - Extended to `.app-select::-ms-expand, select.form-control::-ms-expand`

Why this is minimal
- One-file change; no component/template or behavior modifications.
- Covers both `.app-select` and any `select.form-control` usages across the app.
- Keeps existing tokens, transitions, and dark-mode support intact.

Suggested Commands (optional)
- Build to verify styles compile and render:
  - cd `frontend` && `npm run build`
- For local preview:
  - cd `frontend` && `npm start`

Quick Test Pointers
- Settings page selects: `frontend/src/app/features/settings/page.html` (e.g., 247, 426 if present).
- Board subtask selects (if any present).
- Reports page selects:
  - `frontend/src/app/features/reports/reports-page.component.html:300` (select.form-control)
  - `frontend/src/app/features/reports/reports-page.component.html:319` (form-control app-select)
- Check default/hover/focus/disabled; multi-select and `size > 1` (no caret) and dark mode.

Residual Risks / Open Questions
- Slight visual change on any `select.form-control` that previously relied on plain `.form-control` look.
- If modules have local select overrides, specificity may need a minor follow-up.
- If a denser variant is required, confirm padding spec (e.g., 12–14px around caret) and whether compact sizes are needed.