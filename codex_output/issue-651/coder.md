Next, I’ll align any page-specific overrides so all selectors use the shared visual spec without changing behavior.

What I changed
- Unified selector visuals by preventing page-level input styles from overriding `.app-select`:
  - Updated board page styles to exclude selects using the shared class.
    - frontend/src/styles/pages/_board.scss:653
      - `.subtask-editor__input` → `.subtask-editor__input:not(.app-select)`
    - frontend/src/styles/pages/_board.scss:667
      - `.subtask-editor__input:focus-visible` → `.subtask-editor__input:not(.app-select):focus-visible`
    - frontend/src/styles/pages/_board.scss:1148
      - `.dark .board-page .subtask-editor__input` → `.dark .board-page .subtask-editor__input:not(.app-select)`

- Verified `app-ui-select` already matches the canonical design:
  - The trigger uses the same base styling via `form-control app-select` and suppresses the background caret to avoid double icons.
    - frontend/src/app/shared/ui/select/ui-select.ts:147
      - `.ui-select__trigger { … background-image: none !important; }`
  - Native select fallback (multi/size) uses `form-control app-select`, consistent with the shared style.
    - frontend/src/app/shared/ui/select/ui-select.ts:115

Why this is minimal and safe
- No changes to selection logic or component APIs.
- Keeps canonical references unchanged:
  - Competency level selector: frontend/src/app/features/admin/feature/admin-page.component.html:127
  - AI model selector: frontend/src/app/features/admin/feature/admin-page.component.html:498
- Centralizes the look-and-feel with `.app-select` and `app-ui-select` while preventing local overrides from drifting visuals.

Validation notes
- Visually inspect:
  - Board subtask status dropdowns now match `.app-select` look in other screens.
  - Focus/hover/disabled states align with `_base.scss`.
- Accessibility:
  - `app-ui-select` retains `aria-haspopup="listbox"`, `aria-expanded`, and keyboard navigation.
  - Native selects keep browser semantics.

Residual risks / open questions
- Risk: Other pages could have similar generic input overrides; quick scan didn’t find any beyond board. If any surface later, apply the same `:not(.app-select)` pattern.
- Optional: If a visible error state is required on `app-ui-select`, we can expose an `invalid` input to mirror `.form-control--invalid`.

Would you like me to run a local UI build to double‑check visuals? If the environment doesn’t have dependencies installed, I can provide a short manual checklist to verify in the browser.