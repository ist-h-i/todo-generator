**Summary**

- Replace all app “select” UIs with a modern, simple Select based on Radix UI + shadcn styling.
- Integrate React TypeScript component(s) with Tailwind; ensure shadcn-style project structure (`/components/ui`), install `@radix-ui/react-select` and `@radix-ui/react-icons`.
- Ensure trigger icon is vertically centered and visually simple/modern.

**Assumptions**

- The target UI is React (Next.js or Vite-React) and allows adding shadcn-style components.
- TypeScript and Tailwind are (or will be) enabled.
- A `@` path alias resolves to `src` (or we will add it).
- A utility `cn` is available at `@/lib/utils` (or we will create it).
- Design tokens like `ring`, `input`, `background`, `popover` map to Tailwind theme variables (shadcn defaults or equivalent).
- The app accepts incremental replacement of existing selects with the new component.

**Constraints**

- Minimize scope and avoid breaking existing styles or workflows.
- Keep changes self-contained: new UI component(s), minimal config updates, explicit dependency adds.
- Keep icon style simple; trigger icon must be vertically centered.

**Unknowns**

- Current framework: Angular vs React/Next. (Repo docs mention Angular; the task requests a React component.)
- Whether shadcn/Tailwind/TS are already configured.
- Existing components path and alias setup (is `/components/ui` present? does `@` resolve?).
- Presence of `@/lib/utils` and the `cn` helper.
- Design tokens/theming parity with shadcn (colors, radius).
- Package manager and Node version constraints.

**Risks**

- If the project is Angular, integrating a React component directly is non-trivial (requires wrapper/micro-frontend); scope could expand.
- Token/class name mismatch could produce visual regressions if Tailwind config differs from shadcn defaults.
- Replacing “all selectors” may touch many files; careful, staged adoption may be needed.

**Planned Deliverables (if React stack is confirmed)**

- `components/ui/select.tsx` with the provided Radix-based Select.
- `components/ui/label.tsx` (dependency).
- `components/ui/demo.tsx` (usage example).
- Instructions (or changes) to ensure Tailwind, shadcn conventions, TS, alias `@`, and `@/lib/utils` exist.
- Dependency installation: `@radix-ui/react-select @radix-ui/react-icons`.

**Clarifying Questions**

- Is the frontend React/Next.js, or Angular? If Angular, do you want a React micro-frontend/embed, or an Angular-native solution instead?
- Is Tailwind already configured? If yes, can you confirm theme tokens (ring, input, background, popover) and radius scale?
- Do you already use shadcn’s folder convention (`/components/ui`) and alias `@` → `src`?
- Do you have `@/lib/utils` with `cn` defined, or should I add it?
- Icon set preference: stick with Radix icons from the spec, or switch to `lucide-react` (ChevronUp/Down/Check) to standardize icons?
- What is the acceptance scope for “app-wide”: replace only custom select components, or also native `<select>` where safe?
- Package manager and Node version to target (npm/yarn/pnpm; Node LTS)?