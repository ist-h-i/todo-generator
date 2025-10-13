Summary
- Fixed dark-mode issue: the select’s down-arrow now inherits the trigger text color, preventing it from blending into the background.
- Scope kept minimal and centralized to the shared Angular select component.

What I changed
- Updated the icon color to inherit current text color.
- File: frontend/src/app/shared/ui/select/ui-select.ts:119
  - Before: color: color-mix(in srgb, var(--text-secondary) 88%, var(--text-primary));
  - After: color: currentColor;

Focused Diff
- frontend/src/app/shared/ui/select/ui-select.ts:119
  - .ui-select__icon { display: inline-flex; align-items: center; justify-content: center; color: currentColor; }

Why this works
- The trigger button uses class `app-select`, which already sets `color: var(--text-primary)` and adapts in dark mode.
- The SVG caret uses `stroke="currentColor"`; by switching the wrapper to `color: currentColor`, the icon matches the text color in both light/dark modes.
- Native `<select>` styling in global SCSS already uses a `currentColor` chevron (no change needed): frontend/src/styles/pages/_base.scss:90

Impact
- One-line style change; no template or logic changes.
- Applies to all usages of `<app-ui-select>` across the app (e.g., reports/admin pages).

Verify
- Switch to dark mode and check any `<app-ui-select>`:
  - frontend/src/app/features/reports/reports-page.component.html:255
  - frontend/src/app/features/admin/page.html:129
- Confirm the caret color matches the trigger text for default/hover/focus/disabled.
- Optional: build to sanity check
  - cd frontend
  - npm ci
  - npm run build

Note on shadcn/React component request
- This repository is an Angular app with Tailwind and TypeScript already configured. It does not contain a React runtime or shadcn project structure.
- If you plan to add a React/shadcn sub-app later, use:
  - Components path: components/ui (default for shadcn)
  - Utils helper: lib/utils.ts (for `cn`)
  - Install: @radix-ui/react-icons, @radix-ui/react-select
  - Place the provided Select at components/ui/select.tsx and Label at components/ui/label.tsx, then render a demo in your React app entry.
- Given the current Angular codebase and the constraint to keep changes minimal, I did not introduce React or new dependencies.
