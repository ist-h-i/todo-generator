**Summary**
- The shared `.app-select` style and `app-ui-select` component establish consistent visuals and basic keyboard support. Native fallback for multi/size preserves semantic HTML. Board overrides no longer interfere with `.app-select` visuals.

**Strengths**
- Roles/states: `aria-haspopup="listbox"`, `aria-expanded`, `role="listbox"`/`role="option"`, `aria-selected` present on custom select options (frontend/src/app/shared/ui/select/ui-select.ts:32, frontend/src/app/shared/ui/select/ui-select.ts:86).
- Keyboard: ArrowUp/Down, Enter, Escape handled; focus restored to trigger on close (frontend/src/app/shared/ui/select/ui-select.ts:336, frontend/src/app/shared/ui/select/ui-select.ts:320).
- Focus visibility: Clear `:focus-visible` styles via `.app-select` and form-control tokens (frontend/src/styles/pages/_base.scss:37, frontend/src/styles/pages/_base.scss:69, frontend/src/styles/pages/_base.scss:104).
- Native fallback: Multi/size uses real `<select>` preserving native semantics (frontend/src/app/shared/ui/select/ui-select.ts:115).
- Overrides fixed: Board page excludes `.app-select` from generic input styles, avoiding visual drift (frontend/src/styles/pages/_board.scss:653, frontend/src/styles/pages/_board.scss:667, frontend/src/styles/pages/_board.scss:1148).

**Gaps vs WCAG/APG**
- Name, Role, Value (WCAG 4.1.2):
  - Missing active descendant mapping. Keyboard navigation updates an internal “active” option but does not expose it via `aria-activedescendant`; screen readers may not announce option changes while arrowing (frontend/src/app/shared/ui/select/ui-select.ts:86, frontend/src/app/shared/ui/select/ui-select.ts:189).
  - Options lack `id` and `aria-disabled`; only CSS class flags disabled (frontend/src/app/shared/ui/select/ui-select.ts:92).
  - Trigger uses a `button` without `role="combobox"`. Current pattern is a disclosure button controlling a listbox that never receives focus; this diverges from ARIA APG “Select-Only Combobox” or “Listbox” patterns.
- Focus management (WCAG 2.4.3, 2.1.1):
  - If the panel is open and focus moves away via Tab, the panel may remain open; blur does not close it (frontend/src/app/shared/ui/select/ui-select.ts:43, frontend/src/app/shared/ui/select/ui-select.ts:299).
- Error communication (WCAG 3.3.1/3.3.3, 4.1.2):
  - No `aria-invalid` or `aria-describedby` passthrough on the trigger/native element; cannot reliably announce field errors.
- Contrast and focus indicators (WCAG 1.4.3, 1.4.11):
  - Visuals likely pass given tokens, but not verified. The panel’s hover/active backgrounds use color-mix with `--accent`; ensure resulting contrasts meet AA in light/dark.
- Motion sensitivity (WCAG 2.3.3):
  - Panel open animation lacks a `prefers-reduced-motion` guard (frontend/src/app/shared/ui/select/ui-select.ts:170).
- RTL/i18n:
  - Native `.app-select` caret positions use physical `right`; no `:dir(rtl)` adjustments (frontend/src/styles/pages/_base.scss:91). Custom trigger removes background caret, so only native variant is affected.

**Minimal, High-Value Fixes**
- Expose active option to AT:
  - Add `id` to each rendered option and update trigger with `aria-activedescendant` when open; keep focus on trigger for minimal churn.
    - Options: add `[attr.id]=\"'ui-opt-' + i + '-' + panelId\"` (frontend/src/app/shared/ui/select/ui-select.ts:92).
    - Trigger: add `[attr.aria-activedescendant]=\"panelOpen && activeIndex >= 0 ? ('ui-opt-' + activeIndex + '-' + panelId) : null\"` (frontend/src/app/shared/ui/select/ui-select.ts:38).
  - Add `role=\"combobox\"` to the trigger to align with APG select-only combobox semantics (frontend/src/app/shared/ui/select/ui-select.ts:38).
  - Add `[attr.aria-disabled]=\"opt.disabled || null\"` on options (frontend/src/app/shared/ui/select/ui-select.ts:92).
- Close on focus exit:
  - Close panel on trigger blur if focus moves outside the component, e.g., detect `relatedTarget` containment in `closePanel` path or add a `focusout` host listener (frontend/src/app/shared/ui/select/ui-select.ts:299).
- Error semantics:
  - Add optional inputs to pass through `aria-invalid` and `aria-describedby` to trigger/native for form errors (frontend/src/app/shared/ui/select/ui-select.ts:21, frontend/src/app/shared/ui/select/ui-select.ts:38, frontend/src/app/shared/ui/select/ui-select.ts:115).
- Motion preference:
  - Wrap the keyframe animation with `@media (prefers-reduced-motion: reduce) { .ui-select__panel { animation: none; } }` (frontend/src/app/shared/ui/select/ui-select.ts:170).
- RTL caret (native):
  - Add `:dir(rtl) .app-select, :dir(rtl) select.form-control { background-position: left 1.6rem center; padding-inline-start/end` adjustments (frontend/src/styles/pages/_base.scss:85).

**Validation Checklist**
- Keyboard and SR:
  - With `role="combobox"` and `aria-activedescendant`, verify SR announces option name while arrowing; Enter selects; Escape closes and returns focus.
  - Tabbing away closes the panel; no stray open popups remain in DOM.
- Label association:
  - Ensure label `for` attribute points to the trigger `id`, or provide `aria-labelledby` if needed.
- Error messaging:
  - When invalid, `aria-invalid=true` and `aria-describedby` points to visible error text.
- Contrast:
  - Check AA contrast for trigger text, option text, focus outlines in light/dark.
- Native fallback:
  - Multi/size native `<select>` preserves label association, `aria-invalid`, and focus ring parity.

**Residual Risks**
- Without `aria-activedescendant`/combobox role, SR users may not receive feedback while navigating options.
- Page-specific styles beyond Board could still override `.app-select`; apply the same `:not(.app-select)` pattern if found.
- Third‑party selects won’t inherit `.app-select` styles or behaviors.

**Open Questions**
- Do we want the combobox semantics change now (role + activedescendant), or prefer moving focus into the listbox on open instead?
- Should `aria-invalid`/`aria-describedby` be supported immediately for forms that surface field-level errors?
- Is RTL in scope for this issue, or should caret/padding fixes be deferred?