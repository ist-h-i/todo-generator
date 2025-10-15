**What I Changed**
- Unified select hover background with inputs (no white flash).
  - Light theme: keep base background on hover; retain subtle border/shadow feedback.
  - Dark theme: same approach for parity.
- Kept the simple single chevron icon and currentColor behavior (stays visible in dark mode).

**Files Touched**
- frontend/src/styles/pages/_base.scss:118
- frontend/src/styles/pages/_base.scss:178

**Focused Diff (Behavioral)**
- Light hover
  - Before: lightened bg to near-white on hover.
  - After: uses the same bg as base to match inputs.
- Dark hover
  - Before: lightened bg on hover.
  - After: uses the same bg as base to match inputs.

**Key Snippets**
- frontend/src/styles/pages/_base.scss:118
  - background-color set to `color-mix(in srgb, var(--surface-card) 88%, transparent)` to match base.
- frontend/src/styles/pages/_base.scss:178
  - background-color set to `color-mix(in srgb, var(--surface-layer-2) 92%, transparent)` to match base dark.

**Why This Fix**
- Eliminates the inconsistent “white” hover effect on selectors while preserving tactile feedback via border/box-shadow.
- Minimal and centralized; no TS/HTML touched; aligns with other inputs.

**How to Verify**
- Build: `cd frontend && npm ci && npm run build` (or `ng build --configuration production`).
- Manually check in light/dark:
  - Hover no longer brightens to white.
  - Focus-visible ring remains; disabled unchanged.
  - Arrow icon color matches text (currentColor) and stays visible.
- Spot check pages using `.app-select` and `select.form-control`:
  - frontend/src/app/features/settings/page.html:249
  - frontend/src/app/features/board/page.html:565
  - frontend/src/app/features/reports/reports-page.component.html:274

**Notes**
- The repo is Angular; the provided shadcn/Radix React Select isn’t integrated here to keep scope minimal. If you want a React/shadcn setup (components in `components/ui`, `@/lib/utils` `cn` helper, deps `@radix-ui/react-select` and `@radix-ui/react-icons`), I can outline those steps in a separate task.