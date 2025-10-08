**Integration Check**

- Centralized SCSS update is present and matches the plan; no template or TS changes required.
- Base selector block extends to both `.app-select` and `select.form-control`, increases right padding, and shifts caret positions.
  - frontend/src/styles/pages/_base.scss:85
  - Padding: `0.85rem calc(1.1rem + 2.25rem) 0.85rem 1.1rem` (added caret space).
  - Caret positions: `calc(100% - 1.85rem)` and `calc(100% - 1.35rem)`.
  - Verified states and variants are extended consistently:
    - Hover: frontend/src/styles/pages/_base.scss:129
    - Focus-visible: frontend/src/styles/pages/_base.scss:138
    - Disabled: frontend/src/styles/pages/_base.scss:149
    - Options: frontend/src/styles/pages/_base.scss:168
    - Multiple/size: frontend/src/styles/pages/_base.scss:174
    - Dark theme base/hover/focus/options: frontend/src/styles/pages/_base.scss:184, frontend/src/styles/pages/_base.scss:204, frontend/src/styles/pages/_base.scss:213, frontend/src/styles/pages/_base.scss:220
    - Hide IE arrow: frontend/src/styles/pages/_base.scss:225

**Coverage Validation**

- Select usages found for both `.app-select` and plain `select.form-control`; updated rules will apply app-wide without template edits:
  - Settings selects: frontend/src/app/features/settings/page.html:247, frontend/src/app/features/settings/page.html:426
  - Board selects: frontend/src/app/features/board/page.html:564, frontend/src/app/features/board/page.html:729
  - Reports selects (both styles): frontend/src/app/features/reports/reports-page.component.html:255, frontend/src/app/features/reports/reports-page.component.html:274
  - Additional usage confirmed across Admin/Analyze pages via `rg`.

**What’s Working**

- Modernized spacing around the caret; not flush to the edge.
- States preserved (default/hover/focus/disabled), multi/size variant removes caret.
- Dark mode variants mirrored; focus-visible outline present.

**Residual Risks / Open Questions**

- Slight visual drift where `select.form-control` previously resembled plain inputs; recommend spot-check of key forms.
- RTL: Base padding uses physical right; consider logical props for RTL later (non-blocking).
- If any module has local overrides with higher specificity, may need a small follow-up.

**How To Land Safely**

- Build and smoke test the frontend to ensure SCSS compiles and visuals meet expectations:
  - Commands: `cd frontend && npm ci && npm run build` (or `npm start` for local preview).
- Visual checks (light/dark):
  - Default/hover/focus/disabled on the Settings, Board, and Reports pages noted above.
  - Multi-select and `size > 1` render without caret; padding correct.
  - Small widths: caret not clipped and spacing remains.
- Accessibility:
  - Confirm keyboard focus ring is visible and no layout shift on focus.

**Optional Follow‑Ups (Non-blocking)**

- RTL friendliness: replace physical right padding/caret positions with `padding-inline-end` and `background-position: right 1.85rem center, right 1.35rem center;` if RTL support is required.