**Request Summary**
- Modernize all app selectors and ensure the trigger chevron is vertically centered and simple.
- Fix dark mode where the down-arrow blends into the background by matching icon and text color.
- Integrate a provided Select component (Radix + shadcn style) into a project that supports shadcn structure, Tailwind, and TypeScript; provide setup instructions if missing.
- Place components under `components/ui`; explain why and create if absent.

**Context & Mismatch**
- Existing repo evidence shows Angular (templates, SCSS, Angular compiler error).
- The provided component is React (Radix UI) targeting a shadcn/Next.js-style structure.
- Two viable paths:
  - React path: add shadcn UI structure and the Radix Select as-is (requires React environment).
  - Angular path: implement a visually equivalent custom select and dark-mode color fix in Angular, keeping minimal change.

**Key Assumptions**
- Goal is design parity (look/feel), not changing app behavior.
- Dark mode color issue means chevron should inherit text color (use `text-current` or remove custom color).
- If current app is Angular-only, React code will not be executed; instead, replicate styling and behavior.

**Constraints**
- Minimal, centralized changes; avoid broad refactors.
- Deliver a finished, self-contained outcome.
- Keep existing spacing, radius, and tokens consistent; only adjust as needed.

**Dependencies (React path)**
- NPM: `@radix-ui/react-icons`, `@radix-ui/react-select`
- Tailwind CSS configured; shadcn project structure present.
- `cn` helper in `@/lib/utils` (create if missing with `clsx`/`tailwind-merge`).

**Default Paths**
- shadcn default: `components/ui` for UI primitives, `lib/utils.ts` for `cn`.
- If your project’s components aren’t under `/components/ui`, create it to align with shadcn conventions (consistent imports, reuse, theming). Styles live in Tailwind config and global CSS (e.g., `app/globals.css` or `src/styles/globals.css`).

**What to Copy**
- `components/ui/select.tsx` (provided Select implementation).
- `components/ui/label.tsx` (originui/label).
- Optional demo: place `demo.tsx` where your app can render it (e.g., `app/(demo)/select-demo/page.tsx` or a stories file).

**Dark Mode Fix (React path)**
- Make the trigger icon match text color: set `className="text-current"` on `ChevronDownIcon` (or remove any `text-*` color to inherit).
- Ensure trigger text color already swaps correctly in dark mode (Tailwind `text-foreground`).

**Angular Path (if staying Angular)**
- Keep changes minimal by centralizing CSS/SCSS:
  - Use a simple chevron via CSS gradients or an inline SVG as background.
  - Ensure vertical centering with `background-position: right <space> center`.
  - In dark mode, set `color` for the control and use `currentColor` in the chevron so the icon matches text.
- If a shared Angular Select exists (`src/app/shared/ui/select/ui-select.*`), update its template to use an inline SVG with `fill="currentColor"` and ensure dark-mode text color applies, or keep background-image approach but switch to `currentColor`.
- Preserve focus, hover, disabled, multi/size variants.

**Setup (if React/shadcn/TW/TS missing)**
- Initialize TS and Tailwind; install and configure Tailwind.
- Install shadcn UI CLI, run init, and adopt `components/ui` + `lib/utils.ts`.
- Install `@radix-ui/react-icons` and `@radix-ui/react-select`.

**Clarifying Questions**
- Is the target app Angular-only, or do you intend to add a React/shadcn sub-app?
- If Angular-only, do you prefer a pure CSS solution (background chevron) or an inline SVG icon?
- Do you already use Tailwind in the project? If not, should we keep SCSS-based styling?
- Which pages/components should show the new select first for validation?
- Any RTL or high-contrast (forced colors) requirements we should account for?