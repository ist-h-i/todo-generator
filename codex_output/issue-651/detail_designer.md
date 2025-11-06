**Detail Design — Unified “app-ui-selector”**

Overview
- Unify all selector UIs using the existing shared component and shared styles already present in the codebase.
- Canonical references:
  - Competency level selector: `frontend/src/app/features/admin/feature/admin-page.component.html:127`
  - AI model selector: `frontend/src/app/features/admin/feature/admin-page.component.html:498`
- Single source of truth:
  - Component: `app-ui-select` in `frontend/src/app/shared/ui/select/ui-select.ts:1`
  - Style: `.app-select` and `select.form-control` in `frontend/src/styles/pages/_base.scss:85`

Shared Sources
- Component: `app-ui-select` (Angular, standalone)
  - Implements `ControlValueAccessor` for reactive/template-driven forms.
  - Uses a hidden native `<select>` to preserve form semantics; renders a custom trigger and options panel for single-select.
  - Falls back to visible native `<select>` for multi-select or `size > 1`.
- Styles: `_base.scss`
  - `.app-select` styles applied to both native `<select>` and the custom trigger for visual parity.
  - Includes hover, focus-visible, disabled, and dark mode variants.

App‑Level Contract

- Selector Component: `app-ui-select`
  - Selector: `app-ui-select`
  - Inputs
    - `id?: string`, `name?: string`
    - `multiple?: boolean | null` (renders native select when true)
    - `size?: number` (renders native select when not 1)
    - `placeholder?: string`
    - `options?: ReadonlyArray<{ value: string | number; label: string; disabled?: boolean }>`
      - Optional; if omitted, projected `<option>` children are used.
  - Forms
    - Fully compatible with Angular forms via `ControlValueAccessor`.
    - `formControlName` or `[ngModel]` works identically to native `<select>`.
  - Accessibility
    - Trigger is a button with `aria-haspopup="listbox"`, `aria-expanded`, `aria-controls`.
    - Panel uses `role="listbox"` and options `role="option"` with `aria-selected`.
    - Document click closes panel; Esc closes and restores focus. Arrow keys move active option; Enter selects.

- Shared Style: `.app-select` (from `_base.scss`)
  - Apply to native `<select>` and `app-ui-select` trigger for visual consistency.
  - Visual tokens: border radius, border color, background, spacing, shadow, and icon handled via CSS variables.
  - States:
    - Hover: subtle border/shadow emphasis.
    - Focus-visible: clear outline + elevated border/shadow.
    - Disabled: reduced opacity; muted border; caret maintained.
    - Multi/size: removes caret, adjusts padding, sets min-height.
  - Dark mode: high-contrast adjustments; caret and text use `currentColor`.

Variants and Behaviors
- Single-select with custom panel:
  - Use `app-ui-select` (reference canonical).
  - Matches “Competency level” and “Model selection” patterns.
- Native select:
  - Use `<select class="form-control app-select">` for simple selectors and all multi/size scenarios.
  - Ensures identical visuals via shared style.
- Options source:
  - Either `[options]="..."` (array) or projected `<option>` children; both normalized internally.
- Clearable/placeholder:
  - Support placeholder by including an option like `{ value: '', label: '選択してください' }` at the top when required (as done for evaluation selects).

Integration Patterns
- Reactive forms, custom panel:
  - Example: `frontend/src/app/features/admin/feature/admin-page.component.html:127`
    - `<app-ui-select name="competency-level" formControlName="level" [options]="competencyLevelSelectOptions()"></app-ui-select>`
- Reactive forms, native:
  - Example: `frontend/src/app/features/analyze/feature/analyze-page.component.html:262`
    - `<select class="form-control app-select" [value]="proposal.statusId" (change)="updateProposalStatus(...)" >...`
- Board subtasks, native:
  - Example: `frontend/src/app/features/board/feature/board-page.component.html:556`
    - `<select class="subtask-editor__input app-select" ...>...`
- Settings, native:
  - Example: `frontend/src/app/features/settings/feature/settings-page.component.html:247`
    - `<select class="form-control app-select" ...>...`

Accessibility Notes
- Labels: keep `<label>` and `for`/`id` associations; `app-ui-select` supports `id` and `name`.
- ARIA: `app-ui-select` sets appropriate roles and attributes; ensure visible labels precede controls as in current patterns.
- Keyboard: `app-ui-select` handles ArrowUp/Down, Enter, Esc; native `<select>` retains browser defaults.
- Contrast: `_base.scss` uses CSS variables aligned with app tokens to meet contrast in both light/dark.

Minimal Migration Plan
- Keep references unchanged:
  - Competency level and AI model selectors continue to use `app-ui-select`.
- Ensure consistency for all other selectors:
  - Confirm every native `<select>` uses `class="form-control app-select"` (current codebase already does in all occurrences found).
- Avoid new features or refactors:
  - No logic changes; no external dependencies; no redesign beyond unified selector visuals/interactions.

Optional Extension (if needed later, not required now)
- Error state passthrough for `app-ui-select`:
  - Add optional `@Input() invalid?: boolean` to set `form-control--invalid` on the trigger, mirroring the input error style used by native `.form-control`.
  - Current scope can defer this unless there is an existing unmet requirement for visible error styling on `app-ui-select`.

Verification Checklist
- Visual parity:
  - Compare `app-ui-select` trigger and native `.app-select` side-by-side; confirm radius, padding, caret, shadows, and colors match (`frontend/src/styles/pages/_base.scss:85`).
- Interaction:
  - Check hover/focus-visible/disabled for both variants in light/dark.
- Behavior:
  - Confirm keyboard navigation and selection with `app-ui-select`.
  - Ensure multi/size uses native select with correct visuals (no caret).
- Regression:
  - Confirm the two references’ appearance and functionality remain unchanged.

Residual Risks / Open Questions
- Residual risks:
  - Hidden selectors or legacy specific styles (e.g., `profile-dialog__select`) that might diverge; recommend aligning or removing unused selector-specific styles to prevent drift.
  - Third‑party components with fixed styling would bypass `.app-select`.
- Open questions:
  - Do we need a visible error state on `app-ui-select` now, or is form-level error messaging sufficient?
  - Any remaining screens/components using custom selector styles outside `.app-select` scope?
  - Should `profile-dialog` specific selector styles be deprecated in favor of `.app-select` if/when a select appears there?

This design keeps changes minimal by relying on the existing `app-ui-select` component and the global `.app-select` style, ensuring a unified look and interaction model without altering data flow or selection logic.