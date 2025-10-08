**What I Changed**
- Standardized the remaining select to use the modern style and centered trigger icon.
  - frontend/src/app/features/reports/reports-page.component.html:255 → add `app-select` to class

**Diff**
- frontend/src/app/features/reports/reports-page.component.html:255
  - from: `<select class="form-control" formControlName="status">`
  - to:   `<select class="form-control app-select" formControlName="status">`

**Why**
- The design (vertical-centered caret, added right padding, modern look) is implemented in CSS for `.app-select` and `select.form-control`. One template was missing `app-select`, causing inconsistent spacing/centering.

**No React/shadcn Change**
- The repo is Angular + Tailwind + TypeScript (see `frontend/angular.json`, `frontend/tailwind.config.js`), not a React/shadcn setup. Integrating Radix React components isn’t applicable here. The CSS in `frontend/src/styles/pages/_base.scss` already provides the requested modern select design and vertically centers the trigger icon.

**Verification**
- Check selects across pages render with:
  - Centered caret, adequate right padding.
  - Hover/focus ring/outline.
  - Disabled state dimming.
  - No chevron for `multiple`/`size > 1`.

**Follow-ups (Optional)**
- If you see any other `<select>` without `app-select`, apply `class="... app-select"` for consistency.
- If you want a different caret size/spacing, adjust in `frontend/src/styles/pages/_base.scss`:85–186 (`background-position`, `background-size`, right padding).