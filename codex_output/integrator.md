**What I Changed**

- Unified the select trigger text and down-arrow color in dark mode for the custom Angular select:
  - Ensures the icon inherits a high-contrast color identical to the trigger text.
  - Minimal, component-scoped CSS change; no behavior or template changes.

**Files Updated**

- frontend/src/app/shared/ui/select/ui-select.ts:171
  - Added a dark-mode rule to align the trigger’s text and icon color:
    - `.dark .ui-select__trigger { color: var(--text-primary); }`

**Why This Fixes It**

- The custom trigger’s arrow is an inline SVG with `stroke="currentColor"`, and `.ui-select__icon` already uses `color: currentColor`. By explicitly setting the trigger’s color to `var(--text-primary)` in dark mode, both the text and the icon adopt the same visible, high-contrast color.
- Native `<select>` arrows are already rendered via a CSS background SVG using `currentColor` and are covered by global styles:
  - frontend/src/styles/pages/_base.scss:85
  - frontend/src/styles/pages/_base.scss:164

**Scope and Risk**

- Scope is minimal and targeted to the shared select trigger in dark mode.
- No logic changes, no dependency changes, no React/shadcn added (repo is Angular).
- Existing states (hover/focus/disabled) remain unchanged.

**How to Verify**

- In dark mode, check any screen using the custom select (e.g., Admin/Reports/Settings):
  - The down-arrow inside the select trigger matches the text color and remains clearly visible.
  - Hover/focus/disabled states look consistent.
- For native selects (`.app-select`, `select.form-control`), confirm arrows are also visible; they inherit `currentColor` from:
  - frontend/src/styles/pages/_base.scss:164

**Notes**

- If any page intentionally changes the trigger text color, the arrow will follow (as requested: match text and icon colors).