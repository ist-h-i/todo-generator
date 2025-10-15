**Request Summary**
- Redesign all app selectors to a modern, simple style.
- Unify visuals with other inputs: fix hover background turning white.
- Simplify the trigger icon to a single down chevron.
- Ensure dark mode parity: arrow and text remain visible.
- Modernize the options panel (radius, shadow, spacing).

**Assumptions**
- “Selectors” are dropdown inputs (native select and/or a shared custom select).
- Behavior and APIs stay unchanged; this is a styling-focused update.
- Design should match existing input tokens (colors, radius, borders, focus).
- Minimal-impact approach is preferred (centralized styling over component rewrites).

**Constraints**
- Keep scope minimal; avoid unnecessary refactors.
- Provide a finished, self-contained outcome.
- Prefer centralized CSS/SCSS changes unless a new component is explicitly required.
- If the stack is React/shadcn is desired, set up must be justified; otherwise, stick to current stack.

**Observed Context**
- The current repository appears Angular-based; prior CI logs and paths reference Angular files.
- The provided Select component is React/shadcn (Radix + Tailwind), which does not match Angular without a stack change.

**Two Viable Paths**
- Angular-first (minimal change): Update shared select component and global select styles to align hover/background, icon (simple chevron via CSS or SVG), and dark mode, plus modernize the dropdown panel styles.
- React/shadcn path (higher impact): Set up Tailwind + shadcn + Radix; add `components/ui/select.tsx` and `components/ui/label.tsx`; install `@radix-ui/react-select` and `@radix-ui/react-icons`; ensure `@/lib/utils` `cn` helper exists and `components/ui` is the default path. Only if the app is React/Next.

**Success Criteria**
- Hover state matches other inputs; no white-background mismatch.
- Trigger icon is a single down chevron, vertically centered, not “stacked triangles”.
- Icon uses currentColor so it matches text and is visible in dark mode.
- Options panel looks modern (rounded, subtle border/shadow, clear item hover).
- Accessibility intact: focus-visible, keyboard navigation, disabled states.
- No TS/CI errors; no regressions in multi-select or `size > 1`.

**Unknowns**
- Actual framework in use for the target UI (Angular vs React).
- Which selector implementations are present (native select, custom Angular component, Angular Material).
- Exact design tokens to match (hover bg/border, radii, shadows).
- Whether RTL or high-contrast/forced-colors support is required.

**Clarifying Questions**
- Is the UI stack Angular (current repo) or React/Next with shadcn as in the snippet?
- Which selector(s) should be standardized: native `<select>`, a shared Angular `ui-select`, `mat-select`, or all?
- Should selector hover match input hover exactly (no background change, only border/ring), or use a subtle tinted bg?
- Provide the canonical tokens for text, background, border, radius, shadow for light/dark to ensure perfect match?
- Do we need RTL and forced-colors support in this change?
- If React is indeed the target, should we create `components/ui`, add `@/lib/utils` with `cn`, and install `@radix-ui/react-select` and `@radix-ui/react-icons` now?
- Any screens/components that must be excluded from the new styles?