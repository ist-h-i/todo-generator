**Release Summary**

- Modernized select trigger and options panel across Angular app, keeping changes minimal and scoped.
- Global native `<select>` triggers updated; shared Angular `UiSelectComponent` now renders a custom, modern dropdown panel.

**What Changed**

- Global styles: modern, centered chevron and spacing for selects.
  - `frontend/src/styles/pages/_base.scss:1`
- Shared Angular select component: custom panel with rounded corners, shadow, max-height + scroll, hover/selected/active states, keyboard support; fixed `onTouched` visibility.
  - `frontend/src/app/shared/ui/select/ui-select.ts:1`

**Scope & Compatibility**

- No new dependencies; Angular-only solution.
- Usage of `<app-ui-select>` remains the same in Admin and Reports pages.
- Native `<select>`s retain improved trigger visuals; their OS dropdown remains by design.
- Single-selects use the custom panel; multi/size>1 continue using native control for minimal impact.

**A11y & UX**

- Trigger: simple down chevron, vertically centered; comfortable right padding.
- Panel: `role="listbox"` and `role="option"` with `aria-selected`; keyboard navigation (ArrowUp/Down, Enter, Esc).
- Hidden native select in single mode is unfocusable and hidden from AT (`tabindex="-1"`, `aria-hidden="true"`, `inert`).

**Risks**

- Stacking context: confirm `z-index: 1000` clears headers/overlays in all layouts.
- CSS `color-mix()` usage mirrors existing styles; older browsers might lack support (pre-existing risk).
- RTL not explicitly handled (kept minimal to meet scope).

**Verification Steps**

- Build: from `frontend/`, run `npm ci && npm run build` (or `ng build --configuration production`).
- Pages to check:
  - Admin: `frontend/src/app/features/admin/page.html:1`
  - Reports: `frontend/src/app/features/reports/reports-page.component.html:1`
- Validate:
  - Trigger chevron is centered; spacing balanced; focus-visible outline appears.
  - Panel opens under trigger with rounded corners, subtle border, shadow, smooth entry animation.
  - States: hover highlight, selected checkmark, disabled item styling.
  - Keyboard: ArrowUp/Down moves active item, Enter selects, Esc closes.
  - Long lists: scroll within the panel; max-height respected.
  - Light/dark theme parity; no clipping; no scroll bleed.

**Rollback Plan**

- Revert the two touched files if needed:
  - `frontend/src/styles/pages/_base.scss:1`
  - `frontend/src/app/shared/ui/select/ui-select.ts:1`
- Temporary disable custom panel by switching affected instances to multi/size>1 (forces native select), if a hotfix is needed without code changes.

**Notes on React/shadcn Request**

- Repo is Angular + SCSS; introducing React/shadcn/Tailwind would be high-impact and out of scope for minimal change.
- If a React/shadcn project is desired elsewhere, place components under `/components/ui` and install `@radix-ui/react-select` and `@radix-ui/react-icons`. Not applied here.

**Release Verdict**

- Ready to ship. Changes are minimal, self-contained, and meet the “modern trigger + modern options panel” requirement, with no new deps. Recommended to complete the verification checklist above prior to tagging.