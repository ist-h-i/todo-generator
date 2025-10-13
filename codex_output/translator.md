**Request Summary**
- Modernize all app selectors (dropdowns) with a simple, clean down-arrow.
- Update the option panel to a modern look and ensure dark mode parity.
- Provide/centralize a reusable UI select component and apply it app‑wide.
- Fix current build errors blocking CI.

**Current Stack**
- Framework: Angular (not React/shadcn).
- Styles: SCSS; central overrides live in `frontend/src/styles/pages/_base.scss`.
- Shared select component exists: `frontend/src/app/shared/ui/select/ui-select.ts`.
- Tests via Karma; CI shows TypeScript errors.

**Target Changes**
- Replace outdated arrow with a minimalist down chevron.
- Ensure arrow uses `currentColor` so it matches text in dark/light modes.
- Modernize the dropdown menu (spacing, radius, elevation, focus states).
- Apply consistently across native `<select>` and shared Angular select component.

**Errors To Fix (Blocking)**
- `frontend/src/app/shared/ui/select/ui-select.ts:278`: TS2531 (Object possibly 'null') — `this.value.includes(...)` where `this.value` can be `null`. Guard or default to an empty array before calling `includes`.
- Previous error (now addressed): `onTouched` used in template while private.

**Default Paths**
- Angular components: `frontend/src/app/shared/ui/...` (current select is here).
- Global styles: `frontend/src/styles/pages/_base.scss`.
- Note on shadcn/React: The repo is Angular, so `/components/ui` does not exist. If this were a React/shadcn app, UI primitives should live in `/components/ui` to standardize imports and theming; not applicable here.

**Assumptions**
- We will not introduce React/shadcn; we will deliver the design via Angular + SCSS for minimal impact.
- No state management changes are required; purely presentational + minor TS fix.
- Dark mode tokens already exist; aligning icon color to text is sufficient.

**Constraints**
- Minimize scope and diffs; avoid framework or build changes.
- Fit within a short execution window; focus on one shared component and SCSS.
- Keep behavior and APIs stable; style-only plus the null‑guard TS fix.

**Unknowns**
- Exact visual spec for the option panel (menu item density, dividers, hover/active colors).
- The full set of selector variants in use (single/multi, disabled, error state).
- Whether high-contrast/RTL support is required in this iteration.

**Clarifying Questions**
- Do we need specific dimensions for the option panel (max height, spacing, radius)?
- Should multi-selects show check icons in the menu items?
- Any pages/components that must retain current selector styling (opt-out)?
- Do we need RTL adjustments now, or can that be a follow-up?

**Notes on Provided React/shadcn Spec**
- The given `@radix-ui/react-select` component and `/components/ui/select.tsx` path target a React/shadcn/Tailwind setup, which this Angular repo does not use. Implementing that would exceed minimal-change constraints. We will mirror the look/feel in the Angular select and global SCSS instead. If a separate React app needs this, we can supply shadcn/Tailwind setup and place the component under `/components/ui`.