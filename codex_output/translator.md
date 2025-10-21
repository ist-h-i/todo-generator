**Summary**
- Options inside `app-ui-select` are not rendered. Update all usages to pass options in the correct way expected by the component so they display properly.

**Observed Problem**
- Example shows `<option>` children inside `<app-ui-select>`, but they don’t appear. Likely the component doesn’t project `<option>` content or expects an input (e.g., `[options]`) instead.

**Goal**
- Ensure all `app-ui-select` instances render options correctly and integrate with forms (e.g., `formControlName`) without breaking existing behavior.

**Assumptions**
- `app-ui-select` is an Angular component used within reactive forms.
- The component either:
  - expects an input like `[options]` with `{ label, value }[]`, or
  - needs `<ng-content>`/`<ng-content select="option">` to support child `<option>` elements (currently missing).
- The fix should prioritize updating call sites if a stable input API already exists; otherwise, minimally adjust the component to support the prevalent usage pattern.

**Constraints**
- Avoid unnecessary changes; keep impact minimal.
- Deliver a complete, self-contained fix across all usages of `app-ui-select`.
- Maintain existing UI/UX and form bindings.

**Acceptance Criteria**
- All `app-ui-select` usages display the intended option list.
- Form bindings (`ngModel`/`formControlName`) continue to work.
- No console errors or template binding warnings.
- Option labels/values match current expectations (e.g., “初級 (3段階)” for `junior`).

**Potential Approaches (for planner)**
- If component already supports `[options]`: refactor all usages to pass an options array and remove child `<option>` tags.
- If not: add content projection support to `app-ui-select` to render child `<option>` elements with correct selection/value propagation.

**Residual Risks / Open Questions**
- Unknown correct API of `app-ui-select` (does it support `[options]`, content projection, or both?).
- Whether any usages rely on complex option templates (icons, tooltips) requiring `ng-template` support.
- i18n handling for option labels—are labels hardcoded or pulled from translations?
- Existence of disabled/optgroup/multiple-select requirements not shown in the example.

**Clarifying Questions**
- What is the intended API for `app-ui-select`: input-based options, content projection of `<option>`, or both?
- Do we need to support advanced features (disabled options, groups, custom templates, multiple selection)?
- Are there project-wide translation keys for these labels, or should we preserve current static strings?
- Should we change the component or only update call sites to the intended API?
- Can you confirm all locations where `app-ui-select` is used, or should we search the codebase comprehensively?
