**Request Summary**
- Redesign all selector (dropdown) UIs to a modern, simple style with a vertically centered, single down-arrow icon and comfortable right padding.
- Fix the Angular build error: TS2341 in `UiSelectComponent` where `(blur)="onTouched()"` references a private member.
- Integrate a React-based `Select` component (shadcn + Tailwind + TypeScript). If the project isn’t already set up, provide setup instructions.
- Standardize component paths to `components/ui`; if not present, explain why creating it is important (shadcn conventions).
- Add dependency `Label` component and install `@radix-ui/react-icons` and `@radix-ui/react-select`.
- Keep changes minimal and self-contained.

**Assumptions**
- “Selectors” include native `<select>` elements and any shared/custom Angular select component currently used.
- The Angular error is from a shared UI select (`src/app/shared/ui/select/ui-select.ts`) used across the app.
- The repository may primarily be Angular; React/shadcn integration likely targets an existing or new React SPA section (e.g., micro-frontend or separate app).
- Design intent: minimalist chevron (down), vertically centered, adequate right padding, consistent radius/colors, accessible focus states, dark mode parity if present.

**Constraints**
- Minimal scope: smallest viable fix for the Angular error (change visibility/public wrapper).
- Avoid broad refactors; keep styling centralized where possible.
- Deliver a finished, self-contained outcome without introducing unrelated tasks.

**Unknowns**
- Whether this repo already contains a React app with Tailwind and shadcn configured.
- The desired scope of React integration within an Angular-dominant codebase (micro-frontend, separate app, or future migration).
- Exact theming tokens (radius, colors) to align with.
- Required browser support (affects CSS features) and RTL requirements.

**Angular Error – Likely Root Cause and Minimal Fix**
- Cause: members used in Angular templates must be public. `onTouched` is private in `UiSelectComponent`, but called via `(blur)="onTouched()"`.
- Minimal fix options:
  - Make the property/method public (preferred): `public onTouched = () => {};` and call `(blur)="onTouched?.()"`.
  - Or add a public wrapper: `public handleBlur() { this.onTouched(); }` and update template to `(blur)="handleBlur()"`.

**React/shadcn Integration Targets**
- Default components path: `components/ui` (shadcn convention). Important because:
  - shadcn CLI scaffolds components and styles expecting this structure.
  - Keeps UI primitives discoverable and standardized across the app.
- Files to add:
  - `components/ui/select.tsx` (provided)
  - `components/ui/label.tsx` (provided)
  - `demo.tsx` usage example (optional or in a storybook/sandbox route)
- Dependencies to install:
  - `@radix-ui/react-icons`
  - `@radix-ui/react-select`

**If Project Lacks shadcn/Tailwind/TS**
- Provide setup instructions:
  - Initialize a React app with TypeScript (e.g., Next.js with `create-next-app --ts`).
  - Install Tailwind CSS and configure `tailwind.config.ts`, `postcss.config.js`, and global CSS.
  - Install and initialize shadcn UI (`npx shadcn@latest init`) and confirm `components/ui` structure.
  - Add the `cn` utility under `lib/utils.ts` and configure the `@/` alias.

**Acceptance Criteria**
- Angular build passes; no TS2341 error from `UiSelectComponent`.
- App-wide selector visuals: modern, simple down-arrow, vertically centered; adequate right padding; accessible focus state; disabled state clear; dark mode parity if relevant.
- React `Select` component and `Label` added under `components/ui`, ready for use; dependencies installed (or clear setup instructions provided if React stack absent).
- Clear note on why `components/ui` path is used and required.

**Clarifying Questions**
- Is there an existing React (Next.js) app in this repo, or should we provide setup steps for a new React app alongside the Angular app?
- Should the React `Select` be used immediately in production UI, or just prepared for future use while Angular selectors get the CSS redesign now?
- Are RTL and older browser support (impacting CSS like `color-mix`) required?
- Any pages/components that must keep their current selector look and be excluded from the global update?
- Do you want the Angular selector’s icon implemented purely via CSS (no template/TS changes beyond the TS fix), or is a shared Angular UI component update acceptable?