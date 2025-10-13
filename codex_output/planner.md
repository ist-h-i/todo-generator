Findings
- The frontend is Angular (Angular workspace, TypeScript, Tailwind present: `frontend/angular.json`, `frontend/tailwind.config.js`).
- App-wide select styling lives in `frontend/src/styles/pages/_base.scss:~85` and already centers a chevron via CSS gradients.
- The current caret is rendered by overlapping gradients (triangles), which matches the complaint.
- React + shadcn component structure (`/components/ui`) is not present (Angular app). Integrating a React component directly would be out-of-scope; we should provide copy-paste files and setup guidance instead.

Minimal Plan
- CSS-only fix: Replace the gradient-based caret with a single, simple down-arrow (SVG data URI) and keep it vertically centered; preserve spacing, states, and dark-mode overrides.
- Do not touch Angular templates/TS; apply changes only in `frontend/src/styles/pages/_base.scss`.
- Provide React/shadcn Select + Label components as copy-paste files and installation instructions for React projects. Explain why `/components/ui` is the standard path.

What to change (Angular CSS)
- In `frontend/src/styles/pages/_base.scss` under `.app-select, select.form-control`:
  - Replace `background-image: linear-gradient(...), linear-gradient(...);` with a single chevron-down SVG data URI, e.g. a minimalist stroked path using `stroke='currentColor'`.
  - Keep `background-position: right <offset> center;` and `background-size: 16px 16px` (or similar).
  - In disabled and dark variants, either:
    - Rely on `currentColor` by slightly adjusting `color` tokens for the control; or
    - Provide a second data URI with muted color in `.dark` and `:disabled` overrides.
  - Keep multi-select/size>1 rules to remove the caret (`background-image: none`).
- Do not alter padding, radius, focus, or other tokens.

React/shadcn Deliverables (instructions + files)
- Default paths:
  - Components: `/components/ui`
  - Styles: Tailwind via globals and utility classes; no separate CSS needed.
- Why `/components/ui` matters: shadcn’s generators, docs, and ecosystem expect this path for discoverability and cohesive UI primitives.
- Copy-paste files (for React projects):
  - `components/ui/select.tsx` (your provided Radix-based component)
  - `components/ui/demo.tsx` (usage example)
  - `components/ui/label.tsx` (Label dependency)
- Ensure `@/lib/utils` exists with a `cn` helper:
  - `lib/utils.ts`: `export function cn(...c: Array<string | false | null | undefined>) { return c.filter(Boolean).join(' '); }`
- Ensure TS path alias `@/*` is configured in `tsconfig.json`.
- Install deps (in the React project): `npm i @radix-ui/react-select @radix-ui/react-icons`
- Tailwind must be installed and configured; if not, set it up (init config, add directives to globals, include paths).

Risks/Notes
- We avoid mixing React into Angular codebase; provide React components as documented assets only.
- For the SVG caret, prefer `currentColor` for automatic light/dark theming; if contrast requires, adjust color tokens or provide theme-specific data URIs.
- RTL not addressed to minimize scope; can be handled later by mirroring background-position with logical properties.

Manual Verification (Angular)
- Pages: Settings, Board, Reports (selectors using `.app-select` and `select.form-control`).
- Check: single simple down-arrow (no layered triangles), vertical centering, balanced right padding, hover/focus/disabled, multi/size>1 hides caret, light/dark parity, no clipping at narrow widths.

```json
{"steps":["coder","code_quality_reviewer","integrator"],"notes":"Make a single, centralized CSS change in frontend/src/styles/pages/_base.scss to replace the gradient-based caret with a single simple down-arrow (SVG data URI), keeping vertical centering and spacing intact. Do not alter Angular templates/TS. Provide React/shadcn select.tsx, demo.tsx, label.tsx as copy-paste files and setup instructions (components under /components/ui, ensure @ alias and cn util, install @radix-ui/react-select and @radix-ui/react-icons) for React projects. Explain why /components/ui is important for shadcn.","tests":"Manual: in Angular app, open Settings, Board, Reports pages. Verify the select trigger shows a single minimalist down-arrow, vertically centered, with adequate right padding. Check states (default/hover/focus-visible/disabled), multi-select/size>1 (no caret), and light/dark parity. For React deliverables, confirm the files compile in a React+Tailwind+TS project with @ alias and that the demo renders with ChevronDown icon."}
```