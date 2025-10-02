**Objective**
- Stack subtask card “status” above “content” in board view by updating Tailwind classes locally in the subtask card template.

**Scope**
- Only the subtask card container on the board screen.
- Layout-only change; no data, copy, or responsive exceptions.

**Plan**
- Identify subtask card template in board feature.
- Verify target container using `flex items-start justify-between gap-2`.
- Change classes to `flex flex-col items-start gap-2`; remove `justify-between`.
- Ensure DOM order is status then content (avoid `order-*` for a11y).
- Verify no shared component reuse is broken.
- Run frontend lint/format/tests and visual check on board.
- Open PR with concise summary and screenshots.

**Owners**
- Implementation: Frontend Developer
- Review: UI/UX Reviewer (visual), QA (functional), Code Reviewer (peer)

**Dependencies**
- Confirm exact component/template path in board feature.
- Confirm Tailwind utility availability (flex/col).
- Decision: DOM order must be status before content for accessibility.

**Risks & Mitigations**
- Class reused elsewhere → limit change to subtask template; avoid global/shared components.
- Visual/DOM order mismatch → reorder DOM to status-first.
- Long content affects spacing → keep `gap-2` and allow wrapping as today.

**Gates & Approvals**
- Requirements and design reviewed (status-first at all breakpoints).
- Code review approval (scoped change, no regressions).
- UI/UX approval (visual alignment and spacing).
- QA sign-off (no unintended layout changes, tests pass).

**Done Criteria**
- Board subtask cards show status on top, content below across all viewports.
- Left alignment preserved; consistent spacing equivalent to `gap-2`.
- DOM order is status then content.
- No layout regressions elsewhere; existing tests, lint, and format checks pass.