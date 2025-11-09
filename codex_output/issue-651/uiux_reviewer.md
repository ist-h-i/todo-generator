**Findings**

- Single source of truth exists and is used:
  - Shared style `.app-select` defines visuals and states: frontend/src/styles/pages/_base.scss:85
  - Shared component `app-ui-select` for single-select with custom panel: frontend/src/app/shared/ui/select/ui-select.ts:1
- Reference selectors are intact and canonical:
  - Competency level: frontend/src/app/features/admin/feature/admin-page.component.html:127
  - AI model: frontend/src/app/features/admin/feature/admin-page.component.html:498
- Local overrides no longer clash on Board:
  - Exclusions added to avoid overriding `.app-select`: frontend/src/styles/pages/_board.scss:653, frontend/src/styles/pages/_board.scss:667, frontend/src/styles/pages/_board.scss:1148
- Interaction states consistent:
  - Hover/focus/disabled for native `.app-select`: frontend/src/styles/pages/_base.scss:118
  - Custom panel option states + keyboard nav on `app-ui-select`: frontend/src/app/shared/ui/select/ui-select.ts:1
- Accessibility reasonable:
  - `app-ui-select` uses `aria-haspopup="listbox"`, `aria-expanded`, `role="listbox"/"option"`, supports Esc/Enter/Arrow keys: frontend/src/app/shared/ui/select/ui-select.ts:520
  - Labels in templates remain native `<label>` + `id` compatible

**Gaps / Risks**

- RTL readiness: `.app-select` uses physical `padding` and `background-position: right…`; these won’t auto‑mirror in RTL. Recommend logical props or `:dir(rtl)` overrides.
- Error state: Inputs use `.form-control--invalid`, but `app-ui-select` trigger cannot reflect it without a prop/class. If error visuals on selects are needed, add an `invalid` input or accept a class passthrough.
- Loading state: Not standardized; if any selector needs a loading/disabled+spinner state, it’s not defined for `app-ui-select`.
- Hidden variants: Other pages might have local input styles similar to Board that could still override selects; pattern should be replicated if found.
- Multi/size behavior: Falls back to native `<select>` (good for minimal churn), but interaction differs from custom panel. If parity is required, scope creep risk.

**Open Questions**

- Do we need RTL support now? If yes, I’ll add `:dir(rtl)` fixes for caret position and padding on `.app-select`, and check `ui-select` trigger spacing.
- Preferred deprecation path for old/select-specific styles: proceed with immediate replacement (as done on Board) or soft deprecate with a sunset note?
- Should `app-ui-select` expose an `invalid` input to align with `.form-control--invalid` visuals?
- Any selectors requiring a “loading” affordance (e.g., fetching options) that we should standardize?

**Recommendations**

- Approve current unification; visuals and interactions are consistent with references with minimal churn.
- If RTL is in scope, I’ll add small, targeted logical CSS or `:dir(rtl)` overrides to `.app-select` and `ui-select` trigger.
- If error state on selects is desired, I’ll add a minimal `invalid?: boolean` prop to `app-ui-select` to apply the error class.

**QA Checklist**

- Compare reference vs. other selectors for radius, padding, caret, hover/focus in light/dark.
- Validate keyboard nav on `app-ui-select` (Tab focus, Arrows, Enter, Esc).
- Confirm multi/size cases render native `.app-select` with no caret and proper padding.
- Spot-check Board subtasks now match `.app-select` visuals and focus: frontend/src/styles/pages/_board.scss:653

If you confirm RTL scope and deprecation preference (soft vs immediate), I’ll apply the minimal follow-ups.