Next, I’ll apply a minimal SCSS tweak so the caret inherits the text color in dark mode.

**What I changed**
- Unified the caret (down-arrow) and text color in dark mode by explicitly setting the select’s `color` to the dark theme text token. Since the caret is drawn with `stroke: currentColor` (both for the CSS background SVG and the inline SVG in the Angular custom select), this ensures the arrow matches the trigger text and remains clearly visible.

**Files Edited**
- `frontend/src/styles/pages/_base.scss`



**Focused Diff**
- `frontend/src/styles/pages/_base.scss`
  - Under the dark-mode block for selects, set text color to a high-contrast token so the caret inherits it:
  ```
  .dark .app-select,
  .dark select.form-control {
    /* Ensure text and caret (currentColor) are high-contrast in dark mode */
    color: var(--text-primary);
    background-color: color-mix(in srgb, var(--surface-layer-2) 92%, transparent);
    border-color: color-mix(in srgb, var(--border-overlay) 78%, transparent);
    box-shadow:
      inset 0 0 0 1px color-mix(in srgb, var(--surface-inverse) 20%, transparent),
      0 14px 28px -22px color-mix(in srgb, var(--surface-inverse) 50%, transparent);
    /* ... */
  }
  ```

**Why this works**
- Both implementations of the caret use `currentColor`:
  - Native `<select>`: background SVG has `stroke='currentColor'`.
  - Custom Angular select (`frontend/src/app/shared/ui/select/ui-select.ts`): inline SVG icons use `stroke='currentColor'`, and `.ui-select__icon { color: currentColor; }`.
- By setting `color: var(--text-primary)` explicitly in dark mode, the caret color equals the trigger’s text color and maintains contrast against dark backgrounds.

**Build/Verify**
- Build: `cd frontend && npm ci && npm run build`
- Manual check (dark mode):
  - The down-arrow inside selects matches the trigger text color.
  - Hover/focus/disabled states still look correct.
  - Multi/size variants (which hide the caret) remain unaffected.

**Notes**
- No TS/template changes were needed; the Angular select already uses `currentColor` for its SVGs.
- Scope is minimal and centralized; no unrelated areas touched.