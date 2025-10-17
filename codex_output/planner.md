Summary
- Symptom: On competency registration, the “level” select shows no options.
- Likely root cause: The shared custom select (`app-ui-select`) reads projected <option> elements only once in `ngAfterViewInit`. When content is created or changes later (via Angular structural directives or async data), its `options` array remains empty, so the dropdown panel renders no choices. This can affect both dynamic and static option cases depending on timing.

Plan (under 30 minutes)
- Localize fix to `frontend/src/app/shared/ui/select/ui-select.ts` only.
- Add a MutationObserver on the hidden/native `<select>` to refresh the internal `options` array when child `<option>` nodes change.
- Add a deferred initial read (`queueMicrotask` or `setTimeout(0)`) after `ngAfterViewInit` to ensure projected content is present before first read.
- Keep public API unchanged; no template changes where `app-ui-select` is used (including admin level field).
- Sanity-check other usages (reports, admin user/competency selects) for no regressions.

Why this is minimal
- One shared component fix unblocks all selects, including the competency “level” field.
- No backend or model changes; no routing or state changes.
- No design-system API changes; existing markup keeps working.

Acceptance alignment
- Options render correctly in the competency registration form.
- Selection persists in form control and submit payload stays unchanged.
- No console errors; dropdown panel opens/closes as expected.
- Accessibility preserved (role listbox, keyboard handling intact).

Residual Risks
- If the level list was intended to be fetched from an API, this UI fix won’t address backend emptiness. Evidence in `admin/page.html` shows static options, so risk is low.
- If SSR/hydration is used somewhere else, ensure `MutationObserver` setup guards run only in browser context (current component usage appears client-only).
- If other forms rely on late insertion of options (e.g., `@for` after async), this fix should now handle them; if not, we may need to call `readOptions()` on certain input changes.

Open Questions
- Was the regression introduced by recent changes to the select component styling or lifecycle?
- Are there environments (staging/prod) where the issue reproduces differently due to rendering timing?

Validation
- Manual checks: Admin console → “コンピテンシーを登録” → “レベル” shows “初級 (3段階)” and “中級 (5段階)”. Can open panel, select both values, submit, and see correct level in payload.
- Spot-check other `app-ui-select` instances (evaluation user/competency, reports status/priority) for proper option rendering and selection.

```json
{"steps":["coder"],"notes":"Implement a minimal, shared fix in UiSelectComponent by deferring initial option read and observing projected <option> changes with MutationObserver. No API or template changes. This should restore the level options and stabilize other selects within the time cap.","tests":"Manual: (1) Admin → コンピテンシーを登録 → verify two level options render and selection persists; (2) Admin → 判定と履歴 → both user and competency selects populate and are selectable; (3) Reports page → status/priority selects show options. Optional unit test (time-permitting): shallow-mount UiSelect with projected options added after init; assert panel options length updates after MutationObserver triggers."}
```