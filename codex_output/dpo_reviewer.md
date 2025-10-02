**DPO Review**

- The change is primarily linting/documentation; it does not introduce new data collection or flows. Stronger typing helps reduce accidental over-collection and improves auditability.

**Data Minimization**
- Define DTOs with only the fields actually used by the UI; avoid mirroring full backend payloads.
- Prefer `Pick<>`/narrow interfaces per component to limit propagation of personal data.
- Consider lightweight JSDoc tags (e.g., `@pii`, `@sensitive`) on DTO fields to aid reviews (no tooling change required).
- Avoid `$any` casts in templates where they could mask propagation of extra fields.

**Retention**
- Do not store PII in `localStorage`, `sessionStorage`, `IndexedDB`, or URL/query params. If unavoidable, document purpose, TTL/cleanup, and apply encryption.
- Keep sensitive data in memory only; clear on logout and relevant route changes.
- Ensure error boundaries do not serialize request/response bodies containing PII.

**Consent & Transparency**
- Gate analytics/crash reports behind explicit consent; default to no PII and scrub/redact values client-side.
- Document any third‑party SDK usage that transmits data; present in-product notice where applicable.

**Legal Compliance**
- Purpose limitation: model DTOs around declared purposes; avoid “just-in-case” fields.
- Data subject rights: provide UX to clear cached client data; ensure no client cache blocks deletion/export.
- Cross‑border/processor obligations: centralize third‑party calls via typed adapters to keep an auditable list of endpoints/processors.

**Risks**
- `$any` in templates may bypass safety and enable over-collection inadvertently.
- Third‑party typings can hide PII fields; without adapters, data may spread broadly in the app.
- Overuse of `as`/cast chains can reintroduce unsoundness and leak PII.

**Recommendations (Low‑Impact)**
- Add a short docs note (in `docs/development-rules.md`) covering:
  - Minimize DTO fields; default to non‑PII.
  - Avoid client storage of PII; no PII in logs/URLs.
  - Require consent for telemetry; scrub data before sending.
  - Optional JSDoc `@pii` tagging for sensitive fields.
- Keep shared DTOs in `frontend/src/app/shared/models` and encourage per‑feature narrow types.
- Track a follow‑up to evaluate template linting for `$any` where PII could be involved.

**Verdict**
- Approve with the documentation additions above. No blockers for privacy; the rule strengthens privacy-by-design and aligns with data minimization and retention best practices.