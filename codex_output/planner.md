**Summary**
- Goal: Unify selector (dropdown) visuals with text inputs, fix white hover background and ensure the down-arrow icon is always visible, with light/dark parity.
- Repo reality: Angular app, not React/shadcn. Minimal, centralized CSS/SCSS update is the safest path to meet requirements within 30 minutes.

**Default Paths (Angular Repo)**
- Components: `frontend/src/app/shared/ui`
- Styles: `frontend/src/styles/pages/_base.scss` (centralized selectors have been handled here previously)

**Minimal Plan**
- Centralize a single SCSS update for all native `<select>` targets (`.app-select`, `select.form-control`) to:
  - Match input tokens for bg/border/radius/hover/focus/disabled.
  - Keep icon always visible (not hover-dependent), drawn with a simple chevron using `currentColor`.
  - Remove “white on hover” by aligning hover background/border with inputs.
  - Preserve dark theme parity; icon/text color matched via `currentColor`.
  - Maintain multi/size variants (no caret when `multiple` or `size > 1`).
- If present, align the shared Angular `ui-select` trigger icon:
  - Ensure icon inherits `currentColor`, visible at rest (no hover-only opacity tricks).

**Why not shadcn/React**
- The repo is Angular-based; introducing React/shadcn would violate the “minimal change” constraint and expand scope significantly.
- If this were a React/shadcn stack, the default components path would be `/components/ui`, but it’s out of scope here.

**Risks**
- Page-level overrides might slightly diverge; mitigated by choosing selectors with adequate specificity.
- RTL and forced-colors modes are not addressed in this pass (can be follow-ups).

**Acceptance Criteria**
- Selector idle/hover/focus/disabled match inputs for bg/border/radius.
- Down-arrow icon is always visible and uses `currentColor` (light/dark).
- Hover no longer turns background white.
- No template/TS changes required; behavior unchanged.

```json
{"steps":["coder","code_quality_reviewer","integrator"],"notes":"Implement a single centralized SCSS change in frontend/src/styles/pages/_base.scss to unify native <select> with inputs: keep background consistent on hover (no white), ensure the chevron icon is always visible and uses currentColor, preserve focus/disabled states and dark mode. Apply rules to both .app-select and select.form-control. If needed, set the shared Angular ui-select trigger icon color to currentColor and remove hover-only visibility. Do not introduce React/shadcn; the repo is Angular.","tests":"Build frontend and visually verify: (1) selector hover bg matches inputs (no white) in light/dark; (2) icon visible at rest and matches text via currentColor; (3) focus-visible ring and disabled styles match inputs; (4) multi/size>1 variants hide caret correctly; (5) check across pages using .app-select and select.form-control (e.g., Settings, Board, Reports)."}```
