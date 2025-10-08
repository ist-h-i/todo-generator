**Summary**
- Goal: Modernize the select trigger icon, ensure it’s vertically centered, and add comfortable right padding — with a single, centralized SCSS change.
- Scope: Styling-only; no template/TS changes. Apply to `.app-select` and `select.form-control`.

**Minimal Plan**
- Centralize in `frontend/src/styles/pages/_base.scss`.
- Keep tokens, density, states (hover/focus/disabled), dark mode.
- Use a minimalist chevron via CSS gradients; explicitly center vertically.

**Targeted Changes**
- Update select base rule (and related states) to:
  - Ensure explicit vertical centering: `background-position: right 1.85rem center, right 1.35rem center;`.
  - Use a simple chevron (two thin linear-gradients) for a modern look.
  - Keep `appearance: none;` and adequate right padding so the icon isn’t flush.
  - Preserve multi/size variants (hide caret), focus-visible, dark mode, and disabled styling.
- Extend selectors to both `.app-select` and `select.form-control` so all selects are covered app-wide with no template edits.

**Risks & Mitigations**
- Slight visual drift on selects that previously used plain `.form-control` look; mitigate by keeping colors/radius consistent with existing tokens.
- RTL not covered in this pass; keep physical `right` to minimize scope (optional follow-up: logical properties).

**Test Plan (manual)**
- Verify vertical centering across densities: default, compact, and at zoomed browser levels.
- Check pages: Settings, Board, Reports (both `.app-select` and `select.form-control`).
- States: default/hover/focus-visible/disabled; multi-select and `size > 1` (no chevron).
- Theming: light/dark parity; no clipping at small widths; keyboard focus ring visible.

```json
{"steps":["coder","code_quality_reviewer","integrator"],"notes":"Centralize a single SCSS update in frontend/src/styles/pages/_base.scss to modernize the select trigger: explicitly center the chevron vertically with `background-position: right <offset> center`, switch to a minimalist chevron via two linear-gradients, retain adequate right padding, preserve states (hover/focus/disabled), dark mode, and multi/size variants. Apply to both `.app-select` and `select.form-control` to cover the app without template changes.","tests":"Build the frontend and visually verify on Settings, Board, and Reports pages: (1) trigger icon is vertically centered, (2) right padding provides comfortable space, (3) states (default/hover/focus-visible/disabled) render correctly, (4) multi-select/size>1 hides chevron, (5) light/dark parity, (6) no clipping at small widths and at different zoom levels."}
```