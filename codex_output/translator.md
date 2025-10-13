**Request Summary**
- Fix poor visibility of the down-arrow icon inside select controls in dark mode by adjusting its color to ensure sufficient contrast. Align the icon color with the trigger text color in dark mode.

**Current Context**
- Tech stack: Angular (not React/shadcn).
- Shared select implementation exists at `frontend/src/app/shared/ui/select/ui-select.ts`.
- Global select styling centralized at `frontend/src/styles/pages/_base.scss`.
- Prior work already simplified/centered the caret and aimed to use `currentColor` for icon color inheritance.

**Goal / Success Criteria**
- In dark mode, the select’s down-arrow icon color matches the text color (or a designated high-contrast token), ensuring clear visibility.
- No behavior changes; minimal style-only update.
- Applies across the app to both `.app-select` and `select.form-control` (and the shared Angular select component).
- Preserves hover/focus/disabled states and theme parity.

**Assumptions**
- Dark mode is toggled via a theme class or attribute (e.g., `.dark`, `[data-theme="dark"]`, or similar) already used in the stylesheet.
- The caret is rendered via CSS background (chevron via gradients) and/or an inline SVG icon within `ui-select`. Both can be made to inherit `currentColor`.
- Text color tokens in dark mode already provide sufficient contrast over the background.

**Constraints**
- Keep changes minimal and localized (prefer a single SCSS adjustment and, only if needed, a tiny tweak in the Angular UI select icon style).
- Do not introduce React/shadcn/Tailwind; this repo is Angular and already themed.
- Maintain accessibility (focus-visible outlines, contrast, disabled visuals).

**Unknowns**
- Exact dark theme hook (class/attribute) currently used in `frontend/src/styles/pages/_base.scss`.
- Whether any specific module overrides the select icon color that could conflict.
- If the Angular `ui-select` icon is an SVG with explicit fill/stroke overriding inheritance.

**Clarifying questions**
- Which selector activates dark mode in this app (e.g., `.dark`, `[data-theme=dark]`)?  
- Should the arrow exactly match the text color, or use a specific token (e.g., `--muted-foreground` vs `--foreground`)?  
- Are there any select variants that intentionally use a different icon color and should remain unchanged?  
- Is the shared `ui-select` the sole custom select used, or are there other bespoke selectors needing inclusion?  
- Can we standardize the caret to inherit `currentColor` everywhere (CSS and SVG) for future-proof theming?