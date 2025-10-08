**Request Summary**
- Redesign app-wide selectors (dropdowns) to a modern look.
- Fix spacing: the trigger “open” icon is too close to the edge; add breathing room.
- Ensure the trigger icon is vertically centered and visually simple/modern.
- Keep the solution minimal and self-contained.

**Assumptions**
- “Selector” refers to dropdown inputs (native `<select>`, a shared custom select, or Angular Material `mat-select`).
- The change is styling-only (no behavior or API changes).
- Centralized styles (SCSS/theme tokens) exist and should be used.
- Accessibility and keyboard/focus states must be preserved.
- Dark theme support (if present) must remain consistent.

**Constraints**
- Minimize scope and avoid template/TS changes if possible.
- Deliver a complete, self-contained fix with minimal impact.
- Reuse existing design tokens (color, spacing, radius, typography).
- Vertically center the trigger icon and use a simple, modern icon style.

**Unknowns**
- Which selector implementations are used (native, custom, `mat-select`, or mixed).
- Exact visual spec for the “modern” trigger icon (shape, weight, size).
- Desired spacing around the icon and overall control density.
- Theming needs (light/dark), RTL support, and target browsers.
- Any module-specific overrides that could conflict with centralized styles.

**Clarifying Questions**
- Which components power selectors across the app: native `<select>`, custom, `mat-select`, or a mix?
- Do you have a preferred icon style (e.g., minimalist chevron) and size (px/rem)?
- What right-side padding should be around the icon (e.g., 12–16px)?
- What control height/density should we target (e.g., 40/44/48px min height)?
- Must this apply globally via theme/SCSS overrides, or only to specific modules?
- Are light/dark themes and RTL required for this update?
- Any pages/components that must retain their current look (i.e., exclude from change)?
- Target browser support we should consider for CSS features?