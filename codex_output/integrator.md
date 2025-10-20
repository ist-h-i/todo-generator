I’ve verified the selector styles and the shared Select component, and unified them with inputs. No React/shadcn was introduced (Angular repo).

**What Changed**
- Native selects `.app-select, select.form-control`
  - Always-visible chevron using `currentColor`; vertically centered, with padding to match inputs: frontend/src/styles/pages/_base.scss:85
  - Hover keeps same background as idle (no white flash); subtle border/shadow feedback: frontend/src/styles/pages/_base.scss:118
  - Focus/disabled states match inputs; multi/size>1 hides caret: frontend/src/styles/pages/_base.scss:128, frontend/src/styles/pages/_base.scss:155
  - Dark theme parity; chevron inherits text color for contrast: frontend/src/styles/pages/_base.scss:165
- Shared Angular Select trigger
  - Trigger composes input styles; icon element uses `currentColor` (visible at rest, not hover-gated): frontend/src/app/shared/ui/select/ui-select.ts:34, frontend/src/app/shared/ui/select/ui-select.ts:122
  - Dark mode: trigger text set to `var(--text-primary)` so icon matches: frontend/src/app/shared/ui/select/ui-select.ts:169
  - Modernized option panel (rounded, shadowed, clear hover/selected/active): frontend/src/app/shared/ui/select/ui-select.ts:127

**Why This Fixes The Report**
- Hover turning white: hover now uses the same base background as inputs; only border/shadow adjust, maintaining consistency.
- Icon invisible until hover: chevron is always present (native via background-image; custom via inline SVG) and inherits text color, so it remains visible in both themes.

**How To Verify**
- Light/dark themes, check:
  - Idle/hover/focus-visible/disabled match text inputs.
  - Chevron is visible at rest and matches text color.
  - Multi/size>1 variants show no chevron and proper padding.
- Pages using both forms:
  - Settings: frontend/src/app/features/settings/page.html:249, frontend/src/app/features/settings/page.html:428
  - Board: frontend/src/app/features/board/page.html:565, frontend/src/app/features/board/page.html:730
  - Reports: frontend/src/app/features/reports/reports-page.component.html:255, frontend/src/app/features/reports/reports-page.component.html:274
  - Custom component usage: frontend/src/app/features/admin/page.html:129

**Paths (Angular Repo)**
- Components: frontend/src/app/shared/ui
- Styles: frontend/src/styles/pages/_base.scss

**About The Provided React/shadcn Select**
- This repo is Angular. Introducing React/shadcn and Radix would be high-impact and outside the “minimal change” constraint.
- If you were integrating in a React + shadcn + Tailwind + TS app:
  - Default components path: `/components/ui` (create it to keep shadcn imports consistent).
  - Add `components/ui/select.tsx` and `components/ui/demo.tsx` from your snippet; add `components/ui/label.tsx` from “originui/label”.
  - Install: `@radix-ui/react-select @radix-ui/react-icons`.
  - Ensure Tailwind and TS are configured; shadcn CLI scaffolds typical structure.

**Optional (low risk)**
- High-contrast mode: hide background-image chevron for native selects.
  - Add to `frontend/src/styles/pages/_base.scss`: `@media (forced-colors: active) { .app-select, select.form-control { background-image: none; } }`

If any specific page still shows a white hover or missing icon, point me to the file/path and I’ll align that instance.