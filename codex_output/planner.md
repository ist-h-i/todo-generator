Findings
- Repo is Angular with Tailwind configured (frontend/tailwind.config.js, frontend/src/styles.scss). No React/shadcn structure exists.
- Global select styling lives in frontend/src/styles/pages/_base.scss and already uses a down-chevron SVG with stroke="currentColor", so the native <select> caret tracks text color (both light/dark).
- The shared Angular select component is frontend/src/app/shared/ui/select/ui-select.ts. Its trigger uses an inline SVG for the caret. The icon wrapper sets a custom color mix:
  - .ui-select__icon { color: color-mix(in srgb, var(--text-secondary) 88%, var(--text-primary)); }
  - This can diverge from the trigger text color in dark mode, causing poor contrast or mismatch.
- The specific dark-mode request is to “make the down arrow match the text color.” The minimal fix is to have the icon inherit the current text color instead of overriding it.

Plan
- Update UiSelectComponent styles so the caret inherits the trigger’s text color:
  - Replace .ui-select__icon color with currentColor.
  - No other behavior or style changes needed; the trigger already sets color via .app-select to var(--text-primary) which flips in dark mode.
- Keep global native <select> styles unchanged (they already use stroke=currentColor).
- Do not introduce React/shadcn or new packages into this Angular app. If a React/shadcn sub-app is ever added, default UI component path is components/ui and utilities in lib/utils; but it’s out-of-scope here.

Minimal changes (what coder will implement)
- frontend/src/app/shared/ui/select/ui-select.ts: change .ui-select__icon color to currentColor so the SVG chevron inherits text color in all themes.
  - Before: color: color-mix(in srgb, var(--text-secondary) 88%, var(--text-primary));
  - After: color: currentColor;

Why this is minimal and safe
- One-line style change, scoped to the shared select component.
- Honors constraints: smallest possible diff, no new deps, no refactors.
- Aligns icon and text color in dark mode (and remains correct in light mode).

Notes on shadcn/Tailwind/TypeScript requirement
- The project already uses Tailwind and TypeScript.
- Because this is an Angular SPA, shadcn’s React structure (/components/ui) is not applicable. If you later add a React route/app, use /components/ui for primitives and lib/utils.ts for cn helpers.

Test plan (manual)
- Build: cd frontend && npm ci && npm run build (or ng build --configuration production).
- In dark mode, verify:
  - UiSelect trigger chevron matches the trigger text color.
  - Native selects’ chevron also matches text (already uses currentColor).
  - Hover/focus/disabled states retain appropriate contrast.
- Spot check light mode to ensure no regressions.

```json
{"steps":["coder","integrator"],"notes":"Angular app confirmed. Fix dark-mode caret by having UiSelectComponent’s icon inherit text color: set `.ui-select__icon { color: currentColor; }`. Global native <select> already uses stroke='currentColor', so no change needed. Do not introduce React/shadcn; if a React sub-app is ever added, default to `components/ui` and `lib/utils` per shadcn conventions.","tests":"1) ng build production. 2) In dark mode, open pages that use UiSelect and native <select>; verify the down-arrow matches the text color across default/hover/focus/disabled. 3) Sanity-check light mode for regressions."}
```