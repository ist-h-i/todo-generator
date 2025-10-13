**What I Changed**
- Modernized the select options panel (custom dropdown) for the shared Angular component while keeping usage unchanged.
- Single-selects now render a rounded, elevated, animated panel with clear hover/selected/disabled states and a simple chevron trigger.
- Multi-selects and `size > 1` continue to use the native `<select>` unchanged (panel only applies to single-select to minimize scope).

**Files Updated**
- frontend/src/app/shared/ui/select/ui-select.ts:1
  - Added custom trigger + panel template for single-selects.
  - Preserved native `<select>` for content projection and fallback; hidden only in single mode.
  - Parsed projected `<option>` elements to build the custom list.
  - Added keyboard support (ArrowUp/Down, Enter, Escape) and click-outside close.
  - Styled the panel using existing design tokens (surface, border, accent, dark mode).
  - Ensured `onTouched` remains public (fix for prior TS2341).

**Why This Approach**
- Repo is Angular + SCSS; introducing React/shadcn would be high-impact and conflict with “minimal changes”.
- Keeps the public API and usage (`<app-ui-select> ... <option>`) intact.
- Uses existing styling tokens for consistent theming and dark mode.

**Notes on Styling**
- Trigger uses existing `.app-select` styling; the built-in chevron background is disabled for the button and replaced with a clean inline chevron.
- Panel: rounded corners, subtle border, elevated shadow, max-height with smooth scroll, focus/active/selected visual states, dark theme parity.

**How to Verify**
- Build: `cd frontend && npm ci && npm run build`
- Smoke test pages that use `<app-ui-select>`:
  - frontend/src/app/features/admin/page.html
  - frontend/src/app/features/reports/reports-page.component.html
- Check:
  - Trigger: simple down chevron, centered; spacing not cramped.
  - Panel: appears under trigger, rounded + shadow, smooth entry animation.
  - States: hover highlight, selected checkmark, disabled option subdued.
  - Keyboard: ArrowUp/Down to navigate, Enter to select, Escape to close.
  - Multi/size>1 still uses native select UI as before.

**React/shadcn Guidance (for non-Angular projects)**
- Default paths (React): components under `/components/ui`, utilities under `/lib/utils`, Tailwind styles at `app/globals.css`.
- If your project is React with Tailwind and Typescript:
  - Install: `npm i @radix-ui/react-select @radix-ui/react-icons`
  - Place provided `select.tsx` at `components/ui/select.tsx` and `label.tsx` at `components/ui/label.tsx`.
  - Ensure `@/lib/utils` exists (`cn` helper) and Tailwind is configured.
- In this Angular repo, do not create `/components/ui`; keep shared UI under `frontend/src/app/shared/ui/` for consistency.

**Open Questions**
- Do you need grouped options, labels, or separators in the panel?
- Any RTL requirements or additional animations?
- Should we enable multi-select in the custom panel as well?

If you want, I can apply this custom panel to any additional pages or extend it with groups/labels next.