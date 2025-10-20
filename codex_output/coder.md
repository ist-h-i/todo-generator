I’ve reviewed the current frontend styles and the shared Angular Select component and verified the selector design is already unified with text inputs, fixes the white hover issue, and keeps the icon visible at rest in both light and dark modes with minimal, centralized changes.

**What’s Implemented**
- Unified hover/background/border/radius with inputs
  - Applies globally to native selects via `.app-select` and `select.form-control`.
  - Keeps hover background consistent (no white “flash”), while retaining subtle feedback.
  - File: `frontend/src/styles/pages/_base.scss:85`
- Always-visible, modern chevron icon
  - Native select uses an inline SVG chevron drawn with `currentColor` so it matches text in light/dark modes.
  - Vertically centered; adequate right padding added.
  - Files:
    - `frontend/src/styles/pages/_base.scss:100` (chevron via data-URL SVG, `stroke='currentColor'`)
    - `frontend/src/styles/pages/_base.scss:104` (centered with `background-position: right 1.6rem center`)
- Dark mode parity
  - Text color and chevron color match; hover/focus states have dark equivalents.
  - File: `frontend/src/styles/pages/_base.scss:165`
- Custom Angular Select trigger alignment
  - Uses the same input look by composing `form-control app-select`.
  - Icon is a child element with `color: currentColor` and an SVG chevron; visible at rest (not hover-only).
  - Files:
    - `frontend/src/app/shared/ui/select/ui-select.ts:38` (trigger uses `form-control app-select`)
    - `frontend/src/app/shared/ui/select/ui-select.ts:44` (icon markup)
    - `frontend/src/app/shared/ui/select/ui-select.ts:122` (icon style `color: currentColor`)
  - Modernized option panel (rounded, shadow, active/hover/selected states):
    - `frontend/src/app/shared/ui/select/ui-select.ts:84`

**Key File References**
- `frontend/src/styles/pages/_base.scss:85` base styles for `.app-select, select.form-control`
- `frontend/src/styles/pages/_base.scss:118` hover state (keeps background consistent)
- `frontend/src/styles/pages/_base.scss:128` focus-visible state
- `frontend/src/styles/pages/_base.scss:165` dark mode base
- `frontend/src/app/shared/ui/select/ui-select.ts:29` template trigger structure
- `frontend/src/app/shared/ui/select/ui-select.ts:122` icon inherits text color
- `frontend/src/app/shared/ui/select/ui-select.ts:84` option panel styles

**Why This Solves The Issue**
- Hover turning white: selectors now keep the same base background on hover, matching inputs, while border/inner shadow provide feedback.
- Icon invisible until hover: the chevron is not hover-gated; it is rendered at rest and inherits text color (`currentColor`) for proper contrast in light/dark.

**Verification**
- Light and dark themes: the chevron and text share the same color; the icon remains visible at rest.
- Pages using native selects (e.g., `frontend/src/app/features/settings/page.html:249`, `:428`) and custom selects (e.g., `frontend/src/app/features/admin/page.html:129`) now look and behave consistently.
- Multi/size variants automatically hide the chevron: `frontend/src/styles/pages/_base.scss:155`

**If You Still See White Hover Or Hidden Icons**
- Ensure native selects carry either `app-select` or `form-control` (or both) so the centralized styles apply.
- Custom select triggers already include `form-control app-select` in `ui-select`.

**About The React/shadcn Component**
- This repo is Angular; introducing a React/shadcn Select and Radix dependencies would be out of scope and high-impact.
- If you were integrating in a React project with shadcn:
  - Default components path: `/components/ui`. Create it to keep shadcn-generated imports consistent.
  - Install: `@radix-ui/react-select` and `@radix-ui/react-icons`.
  - Add `select.tsx` and `demo.tsx` under `/components/ui`, and `label.tsx` (from “originui/label”) under `/components/ui/label.tsx`.
  - Ensure Tailwind and Typescript are set up; shadcn CLI scaffolds typical structure.
- For this Angular repo, the equivalent shared UI path is `frontend/src/app/shared/ui` and global styles under `frontend/src/styles/...`, which are already used.

**Open Questions (Optional)**
- Do any pages require overrides or opt-outs from the unified style?
- Should we add RTL logical properties (e.g., `padding-inline-end`) and a forced-colors safeguard for high-contrast modes?

If you want, I can add an optional `@media (forced-colors: active)` rule to hide the chevron background-image for improved accessibility in high-contrast modes.