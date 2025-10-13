**Plan Summary**
- Fix Angular TS error by making `onTouched` public where used in templates.
- Keep selector redesign minimal and centralized (CSS-only).
- Prepare shadcn React Select for projects that support React; provide setup instructions otherwise.
- Maintain existing behaviors, states, and theming; avoid broad refactors.

**Critical Fix**
- TS2341 root cause: Angular templates can only access public members.
- Change in `src/app/shared/ui/select/ui-select.ts:34` implies `(blur)="onTouched()"`.
- Minimal change: make the field public so templates can call it:
  - Ensure `onTouched` is declared as `public onTouched: () => void = () => {};` and assigned in `registerOnTouched`.
  - If you prefer no visibility change, add `public handleBlur() { this.onTouched(); }` and update template to `(blur)="handleBlur()"` (slightly larger impact).
- Sanity check other template-accessed members like `onChange` for the same issue.

**Selector Redesign Scope**
- Keep CSS centralized; do not change templates where possible.
- Goals:
  - Simple down chevron, vertically centered.
  - Adequate right padding so the icon isn’t flush.
  - Preserve focus-visible, hover, disabled; multi/size>1 hides caret.
  - Light/dark parity.
- If not already present, update the shared select rule(s) that cover native `<select>` and shared Angular select wrapper.

**React/shadcn Integration**
- Default component and styles path: `components/ui` (shadcn convention).
  - Why important: shadcn CLI scaffolds and docs assume `components/ui`, making primitives discoverable and consistent.
- If a React app with Tailwind + shadcn + TS exists:
  - Add `components/ui/select.tsx` and `components/ui/label.tsx` (provided code).
  - Ensure `@/lib/utils` exports `cn`.
  - Install: `@radix-ui/react-icons` and `@radix-ui/react-select`.
  - Optional: add `demo.tsx` to a sandbox/story route.
- If no React app:
  - Provide setup instructions (Next.js TS, Tailwind, shadcn init, `@/` alias, add `cn` util) without modifying Angular app structure.

**Assumptions/Questions**
- Are any other private members used in templates (`onChange`, etc.)?
- Should the React select be integrated now, or prepped for future?
- Any pages/components that must be excluded from the global CSS update?
- RTL and older browser support requirements?

**Risk Control**
- Visibility change is safe and minimal; wrapper alternative is available.
- CSS-only icon ensures no runtime risk; keep specificity modest to avoid regressions.
- React component addition gated by project presence; otherwise, documented setup only.

```json
{"steps":["coder","code_quality_reviewer","integrator"],"notes":"1) Fix TS2341 by making `onTouched` public in `src/app/shared/ui/select/ui-select.ts` (or add a public `handleBlur()` wrapper and update the template). Verify any other template-referenced members are public. 2) Centralize selector redesign via CSS: vertically centered simple down chevron, adequate right padding, preserve focus/hover/disabled and multi/size>1 rules, maintain light/dark parity. 3) React/shadcn: if a React app exists, add `components/ui/select.tsx` and `components/ui/label.tsx`, ensure `@/lib/utils` `cn` util, install `@radix-ui/react-select` and `@radix-ui/react-icons`, optionally add `demo.tsx`. If not, provide concise setup instructions (Next.js TS + Tailwind + shadcn) and rationale for `components/ui` path.","tests":"Angular: run `npm ci && npm run build` for the frontend; expect no TS2341. Manually verify select triggers across key pages: arrow is a single down chevron, vertically centered, with comfortable right padding; focus-visible ring, hover, disabled; multi/select size>1 hides caret; dark theme parity if applicable. If React app exists: `npm i @radix-ui/react-select @radix-ui/react-icons`, render the demo and verify keyboard navigation, focus ring, and viewport scrolling. Lint/type-check both stacks."}