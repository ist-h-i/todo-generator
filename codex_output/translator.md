**Request Summary**
- Modernize all app selectors: trigger and the options panel (dropdown content).
- Provide a reusable UI component and apply it app‑wide.
- A React/shadcn Select component was provided; use it if the stack supports it, otherwise give setup guidance.

**Repo Reality (observed)**
- The app is Angular (paths such as `frontend/src/app/...` and a prior Angular build error).
- TypeScript is present (Angular).
- Styling currently uses SCSS (e.g., `frontend/src/styles/pages/_base.scss`), Tailwind not confirmed.
- Shared Angular UI components likely live under `frontend/src/app/shared/ui/...` (e.g., `.../ui/select/`).

**Assumptions**
- Introducing React + shadcn into an Angular app would be high-impact and conflicts with “minimal changes”.
- Goal is visual/design parity (modern look) more than adopting a specific library.
- “Modern options panel” implies custom-rendered dropdown content (radius, shadow, focus states, labels/separators, keyboard support), not the unstyleable native `<select>` dropdown.

**Constraints**
- Keep scope minimal; avoid cross‑framework migration.
- Deliver a complete, self‑contained outcome without breaking existing flows.
- Respect existing theming/tokens and dark mode where applicable.

**Approach Options**
- Angular‑native (recommended for minimal impact):
  - Provide/extend an Angular `UiSelectComponent` (in `frontend/src/app/shared/ui/select/`) that renders a custom panel (via CDK Overlay or existing solution), and style it to match the “modern” spec: rounded corners, subtle border, elevation, constrained max-height with smooth scrolling, focus/active highlights, separators/labels, disabled states.
  - Continue centralized SCSS token usage (and any dark mode variants) in existing styles (e.g., `_base.scss`) or component-scoped styles.
- React/shadcn path (only if the app is React or a new React area exists):
  - Use shadcn project conventions with `@/components/ui/select` and `@/lib/utils`.
  - Install `@radix-ui/react-select` and `@radix-ui/react-icons`.
  - Add the provided `select.tsx`, `demo.tsx`, and `label` component under `/components/ui/` and wire Tailwind.

**Default Paths**
- shadcn (React): components under `/components/ui`, utilities under `/lib/utils`, global styles in `app/globals.css` (or Tailwind entry).
- This repo (Angular): shared UI under `frontend/src/app/shared/ui/...`; shared styles in `frontend/src/styles/...` (e.g., `_base.scss`).
- If `/components/ui` does not exist (Angular app), creating it for React components is not appropriate; instead keep Angular components under `frontend/src/app/shared/ui/` for consistency.

**Dependencies**
- React path: `@radix-ui/react-select`, `@radix-ui/react-icons` (and Tailwind + shadcn CLI).
- Angular path: no React deps; if icons are needed, use inline SVG or an Angular-friendly icon set (lucide-angular or SVG assets) rather than `lucide-react`.

**Unknowns**
- Is Tailwind already configured in this repo?
- Is there an existing Angular overlay/select implementation we should extend rather than create anew?
- Theming requirements for the panel (light/dark, density, animations).
- Scope of rollout: global replacement vs. targeted modules.

**Clarifying Questions**
- Confirm: this repository is Angular-only; should we avoid introducing React/shadcn and implement an Angular `UiSelectComponent` with a modern options panel?
- If Tailwind is desired in Angular, is it already installed? If not, do you want Tailwind added, or should we stick to SCSS tokens?
- Do we need keyboard navigation parity (arrow keys, typeahead) and ARIA roles for the custom panel?
- Any must-have panel features (labels, separators, groups, scroll buttons, max height, animations)?
- Pages to verify first (e.g., Settings, Board, Reports) and any exclusions from the new style?
- Icon style specifics for the trigger and selected/active item (size/weight, chevron only)?
