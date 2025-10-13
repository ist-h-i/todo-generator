Summary
- Goal: Modernize the select trigger and the options panel with minimal, Angular‑native changes.
- Repo reality: Angular + SCSS. Prior work already centralized trigger styling in `frontend/src/styles/pages/_base.scss` and introduced `UiSelectComponent` under `frontend/src/app/shared/ui/select/`.
- Decision: Do NOT introduce React/shadcn into the Angular app. Ship an Angular UI select with a modern custom panel and apply it where `UiSelectComponent` is used, then add light‑touch SCSS to keep native `<select>`s visually aligned.

What we will do
- Keep component location and styles
  - Components: `frontend/src/app/shared/ui/select/` (Angular shared UI).
  - Global styles: `frontend/src/styles/pages/_base.scss` (already updated trigger).
  - Component styles: co-located stylesheet for the custom panel (e.g., `ui-select.scss`).
- Modernize the options panel (Angular)
  - Panel container: rounded corners, subtle border, elevated shadow, max-height with smooth scroll, z-index above content, open/close animation.
  - Items: spacious row height, hover/focus/active states, selected checkmark, disabled opacity, label/separator styles if present.
  - Accessibility: `role="listbox"`/`role="option"`, `aria-selected`, keyboard focus state, keep or improve existing keyboard handling.
  - Theming: light/dark parity using current tokens; no new design system required.
- Apply component app‑wide pragmatically
  - Ensure pages already converted to `UiSelectComponent` (Admin, Reports, any existing references) use the new panel styles.
  - Keep native `<select>`s styled via `_base.scss` for trigger parity; the native OS dropdown remains (cannot be fully themed), which is acceptable where the custom panel is not required.
- Fix known TS issue
  - Ensure `ControlValueAccessor` hooks (`onTouched`) are public or invoked via a safe wrapper to avoid Angular compiler errors (TS2341).

Non-goals (to keep scope minimal)
- Do not add React/shadcn, Tailwind, or new icon packages.
- Do not mass‑migrate every native `<select>`; focus on the shared Angular `UiSelectComponent` and leave a short migration note for future conversions.

If this were a React/shadcn project
- Default paths: components under `/components/ui`, utilities under `/lib/utils`.
- You’d place `select.tsx`, `demo.tsx`, and `label.tsx` into `/components/ui`, and install `@radix-ui/react-select` and `@radix-ui/react-icons`.
- In this Angular repo, creating `/components/ui` is not appropriate; stick to `frontend/src/app/shared/ui/`.

Key implementation notes for coder
- `frontend/src/app/shared/ui/select/ui-select.ts`: verify `ControlValueAccessor` wiring, make `onTouched` callable from template, expose open state for CSS animations if needed.
- `frontend/src/app/shared/ui/select/ui-select.html` (or template): wrap the options in a positioned panel element with `role="listbox"`; each option `role="option"`, `aria-selected`.
- `frontend/src/app/shared/ui/select/ui-select.scss`: add new panel class styles:
  - Panel: `border-radius`, `border`, `box-shadow`, `background`, `max-height: 24rem`, `overflow: auto`, `padding`, entry/exit animations.
  - Item: spacing, hover/focus background (`accent`), selected checkmark, disabled style, high-contrast friendly focus outline.
  - Dark mode variants to match existing tokens.
- `frontend/src/styles/pages/_base.scss`: keep existing trigger improvements; optionally add a forced-colors safe fallback (hide gradient chevrons in high-contrast).

Open questions (optional)
- Any pages that must not change? Any additional panel features like grouped options or separators needed immediately?
- Confirm dark theme target and RTL requirements.

Manual tests
- Build passes for production and dev.
- Visual checks on Admin + Reports pages using the shared component:
  - Panel opens aligned to trigger, with rounded corners, shadow, correct z-index, and no viewport clipping.
  - Keyboard navigation works; focus ring visible; selected/active states clear.
  - Long lists: smooth scroll, max-height respected.
  - Light/dark parity; disabled items subdued.
- Native `<select>`s keep the improved trigger; OS dropdown remains (by design).

Stage selection rationale
- coder: implement panel styles/markup and minor TS fix.
- code_quality_reviewer: verify minimal scope, control state/ARIA correctness, style cohesion, and no regressions.
- integrator: wire into affected pages and ensure build succeeds; confirm styles load order.
- release_manager: summarize changes and rollout instructions; no extra deps.

```json
{"steps":["coder","code_quality_reviewer","integrator","release_manager"],"notes":"Angular app confirmed. Do not introduce React/shadcn. Enhance the existing shared UiSelectComponent under frontend/src/app/shared/ui/select/ with a modern custom options panel (rounded, shadowed, animated, accessible). Keep trigger improvements in frontend/src/styles/pages/_base.scss. Add a component-scoped SCSS for the panel with light/dark tokens. Fix ControlValueAccessor onTouched visibility. Apply the component where it already exists (Admin/Reports), leaving native selects styled for trigger parity and a short migration note for future conversions. No new dependencies.","tests":"1) ng build --configuration production. 2) Open Admin/Reports pages and verify: panel radius, shadow, border, max-height scroll, open/close animation, z-index, selected checkmark, hover/focus states, disabled styling, keyboard navigation and ARIA. 3) Check light/dark themes and high-contrast (forced-colors). 4) Confirm native selects still render improved trigger and no layout regressions."}
```
