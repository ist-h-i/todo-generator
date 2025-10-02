**Summary**
- UI-only layout change (stack status above content). No new data collected or processed.

**Data Minimization**
- Do not introduce additional fields, tooltips, or metadata in the subtask card.
- Preserve existing truncation/wrapping (e.g., `truncate`, `line-clamp`) so no extra content is revealed due to added vertical space.
- Avoid adding hidden full-text in the DOM that screen readers could expose unintentionally (e.g., via `aria-describedby`).

**Retention**
- No impact on storage or retention policies. Ensure no new snapshots/logs include real personal data.

**Consent**
- No change in purpose or legal basis; no new tracking/telemetry. No additional consent required.

**Legal Compliance**
- Maintain existing role/ownership scoping; the layout change must not bypass visibility restrictions.
- Keep CORS and logging unchanged; avoid logging card content in debug output.
- Use anonymized/mock data for PR screenshots and any updated tests.

**Accessibility + Privacy**
- If reordering DOM to put status before content, confirm that screen-reader order still reflects least-necessary information and does not surface hidden details.
- Ensure vertical stacking does not expand content visibility beyond prior design intent.

**Risks**
- Vertical layout could show more characters if truncation is removed or altered.
- Snapshot tests/screenshots may inadvertently capture sensitive task text.

**Recommendations**
- Explicitly retain current truncation classes and widths; verify no increase in exposed text.
- Avoid ARIA or hidden elements that expose more content than is visually shown.
- Redact/anonymize data in screenshots and tests.

**Decision**
- Approved with conditions: preserve truncation and access controls; no new disclosures; anonymize artifacts.