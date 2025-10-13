**Request Summary**
- Redesign all selector triggers to a simple, modern down chevron, vertically centered with adequate right padding.
- Integrate a Radix-based React Select component (shadcn-style) and a `Label`, with Tailwind CSS and TypeScript.
- Place component files under `components/ui`; install `@radix-ui/react-select` and `@radix-ui/react-icons`.

**Scope and Goals**
- Provide a modern select UI with a single, simple down-arrow icon (not layered triangles).
- Ensure vertical centering of the icon and balanced spacing.
- Deliver copy-pastable component files and minimal setup instructions for shadcn/Tailwind/TS if missing.

**Assumptions**
- The project either already uses React + Tailwind + TypeScript with shadcn conventions, or you want setup instructions added.
- The default components path should be `components/ui` and a `@/` path alias is (or will be) available.
- A utility `cn` helper at `@/lib/utils` will exist or can be added.
- No global state providers are required; Radix Select works without additional providers.

**Constraints**
- Minimize impact; avoid unnecessary changes outside of the select component and its immediate dependencies.
- Deliver a self-contained outcome: component code, label dependency, and install commands.

**Dependencies**
- NPM: `@radix-ui/react-select`, `@radix-ui/react-icons`
- Styling: Tailwind CSS configured in the app
- Utils: `@/lib/utils` exporting `cn(...)`
- Path alias: `@` configured in `tsconfig.json` and bundler

**Deliverables**
- `components/ui/select.tsx` (Radix Select with ChevronDown icon)
- `components/ui/demo.tsx` (usage example)
- `components/ui/label.tsx` (Label dependency)
- Installation commands for required packages
- Notes on ensuring `@/lib/utils` and `@` path alias exist

**Unknowns**
- Is the current app React (with shadcn/Tailwind/TS) or Angular?
- Does the repo already have `components/ui` and `@/lib/utils`?
- Is the `@` alias already configured?
- Where should demo usage be wired (story, page, or docs)?
- Theming requirements (light/dark), RTL, and target browser support.

**Clarifying Questions**
- Is the codebase React-based and using Tailwind + TypeScript? If not, do you want setup steps included now?
- Should we create `components/ui` if it doesn’t exist and standardize UI components there for consistency with shadcn?
- Do you already have `@/lib/utils` with a `cn` helper, or should we add a minimal one?
- Any specific pages where this select should be showcased or immediately used?
- Do you require RTL support or high-contrast/forced-colors considerations in this pass?

**Why `components/ui` Matters**
- shadcn’s conventions and generators assume `components/ui` for discoverability and cohesion.
- Centralizing primitives there ensures consistent API, styling, and reusability across the app.

**Setup Notes (if missing)**
- Install deps: `npm i @radix-ui/react-select @radix-ui/react-icons`
- Ensure Tailwind is configured (`tailwind.config.js`, `postcss.config.js`, global CSS with Tailwind directives).
- Ensure TypeScript and path alias: `tsconfig.json` `paths` includes `"@/*": ["./*"]`.
- Add `@/lib/utils`:
  - `lib/utils.ts`: `export function cn(...classes: (string | false | null | undefined)[]) { return classes.filter(Boolean).join(" "); }`

**Expected Usage**
- Place provided `select.tsx`, `demo.tsx`, and `label.tsx` under `components/ui`.
- Import and use as in `demo.tsx`; the trigger shows a single ChevronDown icon, vertically centered.

**Follow-Up Needed**
- None, if the app is React with Tailwind/TS and `@` alias exists.
- If not React-based, please confirm whether to include React/shadcn/Tailwind bootstrap steps now.