**Scope Check**
- Changes are minimal and targeted to unify selector visuals without altering data flow.
- Board-specific overrides now exclude shared `.app-select`, preventing local style clashes.
  - frontend/src/styles/pages/_board.scss:653
  - frontend/src/styles/pages/_board.scss:667
  - frontend/src/styles/pages/_board.scss:1148
- Canonical selectors remain with `app-ui-select` in Admin:
  - frontend/src/app/features/admin/feature/admin-page.component.html:127
  - frontend/src/app/features/admin/feature/admin-page.component.html:499

**Design Alignment**
- Shared visual source `.app-select` is applied consistently; native selects across pages already use it.
  - frontend/src/styles/pages/_base.scss:85
- `app-ui-select` trigger uses `form-control app-select` and suppresses background caret to avoid double icons.
  - frontend/src/app/shared/ui/select/ui-select.ts:147
- Native fallback for multi/size cases keeps semantics and shared styling.
  - frontend/src/app/shared/ui/select/ui-select.ts:115

**Accessibility/Interaction Review**
- Trigger exposes basic ARIA (`aria-haspopup`, `aria-expanded`, `aria-controls`), panel uses `role="listbox"`, options `role="option"` with `aria-selected`.
  - frontend/src/app/shared/ui/select/ui-select.ts:38, frontend/src/app/shared/ui/select/ui-select.ts:86
- Keyboard support (Arrows/Enter/Escape) is present; focus returns to trigger on Escape.
  - frontend/src/app/shared/ui/select/ui-select.ts:320, frontend/src/app/shared/ui/select/ui-select.ts:336

**Coding Standards**
- Angular `ControlValueAccessor` implementation is clean; form integration preserved.
- Style tokens and dark mode variants align with existing theme variables in `_base.scss`.

**Risks / Gaps**
- Screen reader feedback during arrow navigation is limited: no `role="combobox"` or `aria-activedescendant` on the trigger; options lack stable `id` and `aria-disabled`.
  - frontend/src/app/shared/ui/select/ui-select.ts:86
- Open panel persistence on focus exit: closing relies on `document:click`; Tab away may leave panel open.
  - frontend/src/app/shared/ui/select/ui-select.ts:299
- Form error semantics are not surfaced (`aria-invalid`, `aria-describedby` not passthrough).
  - frontend/src/app/shared/ui/select/ui-select.ts:38, 115
- Motion preference: panel animation does not honor `prefers-reduced-motion`.
  - frontend/src/app/shared/ui/select/ui-select.ts:170
- RTL: `.app-select` uses `right` background-position and physical padding; no `:dir(rtl)` adjustments.
  - frontend/src/styles/pages/_base.scss:100

**Suggestions (Low-Churn)**
- Add `role="combobox"` and `aria-activedescendant` with option `id`s when open to improve SR announcements.
- Close panel on `focusout` when focus leaves component bounds to avoid lingering popups.
- Optional inputs to pass `aria-invalid`/`aria-describedby` to trigger/native for form errors.
- Wrap open animation in `@media (prefers-reduced-motion: reduce)` to disable motion.
- Add `:dir(rtl)` overrides for caret position and padding to support RTL.

**Open Questions**
- Is combobox semantics (role + active descendant) in scope now, or should we defer to a later A11y pass?
- Do we need visible/error ARIA state on `app-ui-select` immediately for forms?
- Is RTL support required for this release?