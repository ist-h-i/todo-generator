**Request Summary**
- Perform a periodic security review to identify vulnerabilities and apply minimal, low‑risk hardening changes. Deliver a finished, self‑contained outcome without broad architectural impact.

**Objectives / Definition of Done**
- Identify clear, actionable security issues within scope.
- Implement the smallest viable fixes with minimal diffs.
- Keep builds/tests green; add/adjust targeted tests as needed.
- Document changes made and residual risks.

**Constraints**
- Minimize scope and code churn; avoid unnecessary tasks.
- Complete within ~30 minutes of focused changes.
- Prefer backend (FastAPI) scope; avoid SPA/architectural changes this cycle.
- Network access is restricted; avoid networked audits.
- Maintain compatibility and avoid breaking existing behavior.

**Assumptions**
- Backend uses FastAPI and has a simple health endpoint for checks.
- Adding small middleware or config hardening is acceptable.
- Tests exist or can be added in a targeted way.
- Dependency upgrades (if any) should be minimal (patch/minor) and only when clearly necessary.

**Unknowns**
- Exact severity thresholds (e.g., fix Critical/High only?).
- Allowed level of dependency changes (patch/minor/major).
- Whether any flows depend on referrer data or cross-origin embedding.
- CI/CD expectations and existing security gates.
- Environment targets (dev/staging/prod) and HTTPS guarantees.

**Clarifying questions**
- Which areas are explicitly in scope this cycle: backend only, or also CI/config?
- Are dependency updates allowed, and to what level (patch/minor/major)?
- Do any features rely on referrer headers or cross-origin embedding that would constrain header tightening?
- Can we add small, focused tests to lock in security behavior (e.g., headers on health endpoint)?
- Are there specific high-priority risks to address first (e.g., auth/session, data exposure, SSRF)?
- Is production guaranteed to run over HTTPS (relevant for HSTS effectiveness)?
