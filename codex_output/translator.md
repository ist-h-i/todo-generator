**Request Summary**
- Create a reusable, modern Select UI component and apply it across the app.
- Integrate the provided React (shadcn-style) component using Tailwind CSS and TypeScript.
- If the codebase lacks shadcn/Tailwind/TS, provide setup instructions.
- Standardize component paths; use `/components/ui` (create it and explain why if it doesn’t exist).
- Add the `select.tsx`, `demo.tsx`, and `label` component; install Radix dependencies.

**Assumptions**
- The app can host React components (Next.js/Vite/CRA or a React micro-frontend).
- Tailwind and TypeScript are (or can be) enabled without major restructuring.
- Path alias `@/` is (or can be) configured to project root (tsconfig + tooling).
- Using the shadcn project structure is acceptable for UI primitives.
- The provided API boundaries (Radix Select) meet accessibility and design needs.

**Constraints**
- Minimize scope and avoid breaking existing features.
- Deliver a self-contained, working Select with minimal project-wide changes.
- Keep iconography simple and centered; match “modern” style.
- Prefer central placement under `/components/ui` for consistency.

**Unknowns**
- Baseline framework: existing app appears Angular in places; is React available?
- Is there an existing shadcn/Tailwind setup and `/components/ui` convention?
- Does the project already have `@/lib/utils` with `cn` helper?
- Existing selector usage: native `<select>`, Angular Material, or custom components?
- Theming requirements (light/dark, tokens), RTL support, and target browsers.
- Global replacement strategy: code refactor vs. CSS overrides vs. gradual adoption.

**Dependencies Identified**
- Required: `@radix-ui/react-select`, `@radix-ui/react-icons`
- React peers: `react`, `react-dom` (v18+)
- Utility for `cn`: `clsx` and `tailwind-merge` (if `@/lib/utils` not present)
- Optional: `lucide-react` (only if we replace Radix icons)

**Deliverables**
- `/components/ui/select.tsx` (provided code, shadcn-style)
- `/components/ui/label.tsx` (originui/label)
- `@/lib/utils.ts` with `cn` helper (if missing)
- `/components/ui/select.demo.tsx` (demo usage from provided `demo.tsx`)
- Setup docs (if needed): shadcn CLI, Tailwind, TS, path alias configuration
- Guidance to apply the component app-wide with minimal churn

**Acceptance Criteria**
- Select trigger icon is a simple down chevron, vertically centered.
- Component compiles and renders with Tailwind styles.
- No runtime errors; TypeScript types pass.
- Demo page/component shows working Select with default value and items.
- Clear instructions exist if the stack isn’t yet shadcn/Tailwind/TS-ready.
- Pathing aligns to `/components/ui` with `@/` imports.

**Risks/Mitigations**
- Angular vs React mismatch: confirm feasibility; otherwise propose an Angular-equivalent or a CSS-first solution while planning React integration separately.
- Global replacement churn: propose incremental adoption (shared wrapper or adapter) to minimize code changes.
- Theming/RTL: note as follow-ups if not immediately required.

**Clarifying Questions**
- Is the current app React-based, Angular-based, or hybrid? If Angular-only, should we: a) deliver an Angular Select, or b) add React via micro-frontend/custom elements?
- Does the repository already have Tailwind, shadcn structure, and `/components/ui`?
- Do we already have `@/lib/utils` with a `cn` helper, or should we add it?
- Are there existing design tokens (colors/radius/spacing) to match for the Select?
- Must we replace all existing selectors now, or stage adoption (new screens first)?
- Any pages/components that must retain their current selector styling?
- Do we need dark mode and RTL behavior in this iteration?
- Is swapping Radix icons to `lucide-react` preferred, or keep Radix icons as provided?

