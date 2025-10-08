**Integration Check**

- Outcome: Select trigger icon is vertically centered and simplified to a modern chevron via CSS gradients.
- Scope: Single centralized SCSS update; no template/TS changes.

**What Changed**

- Vertically centered caret and added comfortable right padding:
  - `frontend/src/styles/pages/_base.scss:85` (base rule for `.app-select, select.form-control`)
  - `frontend/src/styles/pages/_base.scss:94` (increased right padding)
  - `frontend/src/styles/pages/_base.scss:113` (background-position: `right 1.85rem center, right 1.35rem center`)
- States and variants extended to both targets:
  - Hover `frontend/src/styles/pages/_base.scss:129`
  - Focus-visible `frontend/src/styles/pages/_base.scss:138`
  - Disabled `frontend/src/styles/pages/_base.scss:149`
  - Multiple/size variant removes caret `frontend/src/styles/pages/_base.scss:174`
  - Dark theme variants `frontend/src/styles/pages/_base.scss:184`, `frontend/src/styles/pages/_base.scss:204`, `frontend/src/styles/pages/_base.scss:213`, `frontend/src/styles/pages/_base.scss:220`
  - Hide MS arrow `frontend/src/styles/pages/_base.scss:225`

**Coverage**

- Applies to `.app-select` and `select.form-control` across the app (no template edits needed):
  - `frontend/src/app/features/settings/page.html:249`, `frontend/src/app/features/settings/page.html:428`
  - `frontend/src/app/features/board/page.html:565`, `frontend/src/app/features/board/page.html:730`
  - `frontend/src/app/features/reports/reports-page.component.html:255` (plain `form-control`), `frontend/src/app/features/reports/reports-page.component.html:274` (`app-select`)
  - Additional: Admin/Analyze pages use `.app-select`.

**Meets Requirements**

- Vertical center of trigger icon: yes (`center` on Y axis).
- Simple, modern icon: yes (minimal chevron via two linear-gradients).

**Residual Risks**

- Slight visual drift where `select.form-control` previously matched plain inputs.
- RTL not addressed (kept physical `right` for minimal scope).

**How To Land Safely**

- Build and smoke test visuals:
  - `cd frontend && npm ci && npm run build` (or `npm start` for preview)
- Verify in light/dark: default/hover/focus-visible/disabled; multi/size>1 removes caret; no clipping at narrow widths; keyboard focus ring visible.

If you want, I can add an optional forced-colors safeguard to hide the chevron in high-contrast mode.