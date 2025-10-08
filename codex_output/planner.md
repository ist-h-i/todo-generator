Summary
- Goal: Modernize app-wide <select> styling, fix caret spacing, and apply consistently with minimal, centralized CSS changes.
- Approach: Update the existing shared select styles and extend them to cover `select.form-control` so templates do not need edits.

Minimal Plan
- Centralize styling in one place to minimize risk and scope.
- Keep behavior and templates unchanged.
- Use existing tokens and dark-mode variants.

Targeted Changes
- Update selector styles in `frontend/src/styles/pages/_base.scss:85`:
  - Extend rules to apply to both `.app-select` and `select.form-control` without duplicating templates.
  - Increase right padding to create space around the caret.
  - Move caret gradients left to avoid being flush to the edge.
- Mirror the same selector extension for all related states:
  - Hover: `frontend/src/styles/pages/_base.scss:126`
  - Focus: `frontend/src/styles/pages/_base.scss:134`
  - Disabled: `frontend/src/styles/pages/_base.scss:144`
  - Options: `frontend/src/styles/pages/_base.scss:162`
  - Multiple/size: `frontend/src/styles/pages/_base.scss:167`
  - Dark theme base/hover/focus/options: `frontend/src/styles/pages/_base.scss:175, 194, 202, 208`
  - Hide IE arrow: `frontend/src/styles/pages/_base.scss:212`
- Concrete adjustments (illustrative values using rem to stay token‑friendly):
  - Padding: from `padding: 0.85rem calc(1.1rem + 1.85rem) 0.85rem 1.1rem;` to `padding: 0.85rem calc(1.1rem + 2.25rem) 0.85rem 1.1rem;`
  - Caret positions: from
    - `calc(100% - 1.35rem)` and `calc(100% - 0.85rem)`
    - to `calc(100% - 1.85rem)` and `calc(100% - 1.35rem)`

Why this is minimal
- One-file change; no component or template updates.
- Works for both `.app-select` and existing `select.form-control` usages (e.g., reports page).
- Preserves existing design tokens, transitions, and dark mode.

Open Questions
- Exact spacing spec for the caret: is 12–14px desired?
- Any variants (dense/compact) that need different padding?
- Are there selectors without `.app-select` or `.form-control` that must be covered?

Residual Risks
- Extending styles to `select.form-control` may slightly change visuals where a more neutral input style was intended for selects; audit key forms after change.
- If any modules override select styles locally, specificity conflicts may require a follow-up tweak.

Test Plan
- Visual checks (light/dark):
  - Settings page selects: `frontend/src/app/features/settings/page.html:247`, `frontend/src/app/features/settings/page.html:426`
  - Board subtask selects: `frontend/src/app/features/board/page.html:564`, `frontend/src/app/features/board/page.html:729`
  - Reports page selects (both styled paths): `frontend/src/app/features/reports/reports-page.component.html:255` (formerly plain `form-control`), `frontend/src/app/features/reports/reports-page.component.html:274` (`app-select`)
- States:
  - Default/hover/focus/disabled; verify focus ring visibility and no layout shift.
  - Multi-select and `size > 1` render without caret and with correct padding.
- Accessibility:
  - Keyboard focus order and arrow-key interactions on native select remain intact.
- Responsive:
  - Ensure caret is not clipped or flush at small widths.
- Regression scan:
  - Search for any `select` usages without `.app-select` or `.form-control` and spot-check.

```json
{"steps":["coder","code_quality_reviewer","integrator"],"notes":"Implement a centralized SCSS-only update: extend .app-select styles to also target select.form-control and increase right padding + caret offset for modern spacing. No template or behavioral changes. Preserve tokens, dark mode, and focus states. Risk: minor visual changes for selects previously inheriting plain .form-control styling.","tests":"Build frontend and visually verify selectors on Settings, Board, and Reports pages. Confirm caret spacing, hover/focus/disabled states, dark-mode variants, multi-select behavior (no caret), and keyboard focus. Spot-check any selects lacking .app-select or .form-control usage."}
```