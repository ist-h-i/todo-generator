**QA Scope**

- Validate vertical stack of “status” above “content” only within subtask cards on the board view.
- Confirm no unintended layout changes elsewhere; preserve accessibility, spacing, and truncation.

**Test Types**

- Unit: Class/DOM assertions on subtask card template and component.
- Component/Integration: Render subtask card with realistic data; assert structure, order, spacing, truncation.
- E2E: Board flow verification across breakpoints; visual/positional assertions; no DnD/regression issues.
- A11y: Automated axe checks and keyboard order; manual SR spot check.
- Visual Regression (lightweight): Screenshot diff of subtask card variants.

**Targets**

- Template: `frontend/src/app/features/board/subtask-card/subtask-card.component.html`
- Specs: `frontend/src/app/features/board/subtask-card/subtask-card.component.spec.ts`
- E2E: `frontend/e2e/board/*.spec.ts` (or equivalent Cypress/Playwright suite)

**Key Assertions**

- Layout: Container uses `flex flex-col items-start gap-2`; `justify-between` removed.
- Order: Status element precedes content in DOM and in visual layout.
- Spacing: Vertical gap present and consistent; row-gap > 0 and roughly gap-2.
- Truncation: Existing truncation/wrapping preserved; no additional text exposure.
- No Side Effects: Other board cards/layouts unchanged.
- Interaction: DnD hit areas and virtualization behavior unaffected.

**Unit/Component Tests**

- Render with different statuses and content lengths; assert:
  - Container has `flex` and `flex-col`, not `justify-between`.
  - `<app-status-badge>` appears before content element in DOM.
  - Optional: content width behavior (`w-full`) if present; otherwise unchanged.
  - Long text still truncates/clamps as before (check class presence or computed style).
- Edge cases:
  - Empty or very long content.
  - Multiple status variants.
  - RTL locale if supported.
- Accessibility:
  - Tab order: focus moves from status to content naturally.
  - axe check shows no new violations localized to the card.

**E2E Tests**

- Viewports: 360x640, 768x1024, 1280x800; confirm vertical stack at all sizes.
- For each `[data-testid="subtask-card"]` (or card selector):
  - Identify status badge (e.g., `app-status-badge`) and content node.
  - DOM order: status node precedes content node.
  - Positional check: `statusRect.bottom <= contentRect.top` with small tolerance.
  - Spacing: `computedStyle(container).rowGap > 0` and within reasonable range for gap-2 (+/- 6–12px if Tailwind default).
- Regression:
  - Perform a simple drag of a subtask card; ensure no hit-area/ghost issues and no console errors.
  - Scroll board with many items (virtualized if applicable); ensure stable rendering.
- a11y:
  - Run axe on board route; no new violations.
  - Keyboard traversal inside a card follows status → content.

**Visual Regression (Optional, Scoped)**

- Capture card screenshots for short/long content and varied statuses.
- Threshold: <= 0.1% pixel difference vs. approved baselines.

**Selectors & Stability**

- Prefer semantic/component selectors:
  - Status: `app-status-badge` or `data-testid="status-badge"`.
  - Content: `.subtask-content` or `data-testid="subtask-content"`.
  - Card: `data-testid="subtask-card"`.
- Avoid index-based assertions; rely on role/label/testids.

**Pass/Fail Thresholds**

- Unit/Component: 100% passing; maintain or exceed existing coverage. Target ≥ 80% lines/branches for the subtask card spec.
- E2E: 100% passing on targeted board specs.
- Lint/Format: Clean (`npm run lint`, `npm run format:check`).
- A11y: No new axe violations attributable to the card.
- Visual: Diff within threshold or approved via review.

**Risk Checks**

- Confirm only the subtask card template changed (no global/shared component impact).
- Validate long-content wrapping and card heights; no overflow regressions.
- If flex gap support is a concern for legacy Safari, confirm presence of local fallback spacing (e.g., margin) or that app already relies on flex gap elsewhere.

**Test Data**

- Use anonymized/mock subtasks with varied statuses and content lengths.
- Include at least one extremely long content case to validate truncation/wrapping.

**Exit Criteria**

- Subtask cards show status above content across all viewports with left alignment and consistent spacing.
- DOM order matches visual order.
- No regressions detected in board interactions, tests, lint, and format checks.