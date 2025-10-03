**DPO Review**

- Scope: UI-only change (layout stack Status above Content) on Board subtask cards. No new data fields, endpoints, or storage paths introduced.

**Data Minimization**
- No additional data collected or displayed beyond existing Status and Content.
- Ensure no new `data-*` attributes or test selectors embed PII or content text.
- Keep existing truncation/line-clamp to avoid overexposing long content in list views.

**Data Retention**
- No change to persistence or audit trails. Verify audit logs do not capture full Content text when only status changes occur (log minimal diffs/IDs).
- PR screenshots and test artifacts must use synthetic data and avoid real user content.

**Consent**
- No new tracking or consent surfaces. Confirm analytics (if any) do not capture raw Content strings and remain gated by user consent where applicable.

**Legal Compliance**
- Rendering remains via safe bindings; do not introduce `[innerHTML]` that could mishandle user-generated content.
- RBAC/authorization unchanged; protects against unauthorized status changes (mitigates unlawful processing).
- If content may include personal/sensitive data, prominence change is minor; ensure privacy notice already covers user-entered text in tasks/subtasks.

**Risks & Mitigations**
- Risk: Wider exposure of long Content on compact cards.
  - Mitigation: Preserve truncation/line-clamp and safe wrapping; avoid expanding beyond prior scope.
- Risk: Logs/analytics unintentionally capturing content.
  - Mitigation: Validate logging/telemetry filters exclude raw Content; record IDs/status codes only.

**Recommendations**
- Confirm no new telemetry added and existing analytics exclude Content text.
- Re-check logging configuration in debug to avoid verbose payloads, per repo guidance.
- Use synthetic data for visuals/tests; keep selectors neutral (no PII).
- Quick privacy check: no updates to privacy policy or DSR processes required given UI-only change.