**Scope**

- Board view only; subtask card container currently using `flex items-start justify-between gap-2`.
- Minimal change via Tailwind utilities; no refactors or behavior changes.

**Assumptions/Defaults**

- Apply vertical stacking at all breakpoints.
- Replace classes with `flex flex-col items-start justify-start gap-2`.
- DOM order: Status element before Content element.
- Change scoped to subtask card template to avoid reuse impact.

**Plan**

- Locate Board subtask card template.
- Update container layout classes.
- Reorder DOM: Status above Content.
- Verify responsive wrapping and spacing.
- Run `npm test`, lint, format checks.
- Open PR; capture before/after screenshots.

**Owners**

- Implementation: Frontend engineer (Angular).
- Review: UI/Design for spacing/alignment.
- QA: Frontend QA for visual and interaction checks.

**Dependencies**

- Tailwind available and configured in frontend.
- Access to Board view component/template where subtasks render.
- No shared usage of the same container markup outside subtasks.

**Risks & Mitigations**

- Shared container class used elsewhere → Scope change to the subtask component/template only.
- `justify-between` removal affects other elements → Confirm only Status and Content are inside target container; adjust with `gap-2` if needed.

**Gates**

- Designer/PM confirms stacked layout (Status above Content).
- Visual smoke test across mobile/tablet/desktop.
- CI green: unit tests, lint, format, build.

**Done Criteria**

- Subtask cards on Board show Status stacked above Content.
- Container uses `flex flex-col items-start justify-start gap-2`; `justify-between` removed.
- DOM order matches visual order (Status first).
- No regressions to other cards/views; text wraps without overflow.
- All frontend checks pass and screenshots attached in PR.