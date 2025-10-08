Summary
- Implemented a single, centralized SCSS update to vertically center the select trigger icon and keep a simple, modern chevron.
- No template/TS changes. Applies to both `.app-select` and `select.form-control` across the app.

Files Edited
- frontend/src/styles/pages/_base.scss:112

Focused Diff
- frontend/src/styles/pages/_base.scss:112
  - Before:
    - background-position:
      - calc(100% - 1.85rem) calc(50% - 0.25rem),
      - calc(100% - 1.35rem) calc(50% - 0.25rem);
  - After:
    - background-position:
      - right 1.85rem center,
      - right 1.35rem center;

What Changed and Why
- Vertically centered the trigger chevron using “center” for the Y position to satisfy “垂直方向の中心”.
- Kept a minimalist, modern chevron via two linear-gradients (simple and theme-friendly).
- Preserved existing right-side spacing, padding, states, and dark mode.
- Multi-select and `size > 1` variants still hide the caret.

Scope and Impact
- One-file change; minimal and self-contained.
- Applies globally to `.app-select` and `select.form-control`.
- No behavior changes; just refined alignment and icon presentation.

Build/Run Commands (optional)
- cd `frontend` && `npm ci` && `npm run build`
- For local preview: `npm start`

Verification Pointers
- Check these controls render with the icon vertically centered and properly spaced:
  - frontend/src/app/features/settings/page.html:249
  - frontend/src/app/features/settings/page.html:428
  - frontend/src/app/features/board/page.html:565
  - frontend/src/app/features/board/page.html:730
  - frontend/src/app/features/reports/reports-page.component.html:274
- Validate default/hover/focus-visible/disabled states in light/dark.
- Confirm multi-select/size>1 shows no caret and padding looks correct.