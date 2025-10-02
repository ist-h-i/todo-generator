**Threat Model: No `any` in Frontend**

- Scope: `frontend/src/app/**` TypeScript sources; Angular templates `$any(...)` out of scope for this change.
- Goal: Enforce `@typescript-eslint/no-explicit-any` (error), promote explicit interfaces/types with minimal disruption.

**Key Threats**

- Developer Workarounds
  - Using unsafe casts without `any` (e.g., `as unknown as T`) to bypass type safety.
  - Broad type assertions in helpers that silently reintroduce unsoundness.

- External Boundary Unsafety
  - Unvalidated data from APIs (`HttpClient`, `JSON.parse`) typed as concrete interfaces without runtime checks.
  - Third‑party libs or generated clients leaking `any` across the app boundary.

- CI/Process Breakage
  - Rule switched to error can fail CI on hidden `any` in overlooked files or future contributions.
  - Tests/mocks may rely on `any`, causing friction and frequent suppressions.

- Drift and Type Mismatch
  - DTO interfaces diverging from backend responses, leading to runtime faults despite compile‑time “safety”.
  - Shared DTOs location unclear, causing duplicated or inconsistent models.

- Template Casting Blind Spots
  - Angular `$any(...)` casts in templates remain ungoverned, masking unsafe data usage paths.

**Mitigations**

- Guardrail Practices
  - Add a short section to `docs/development-rules.md` with:
    - Ban on `any`, allowed alternatives (`unknown`, generics, discriminated unions).
    - Pattern for unsafe boundaries: accept `unknown`, validate with type guards before narrowing.
    - Exception policy: narrowly scoped inline `eslint-disable-next-line` with 1‑line rationale and ticket link.
    - Location for shared DTOs: `frontend/src/app/shared/models`.

- ESLint Configuration
  - Set `@typescript-eslint/no-explicit-any` to error in `frontend/.eslintrc.cjs`.
  - Keep `--max-warnings=0` to fail violations clearly.
  - Optional safety net if tests become noisy: override `**/*.spec.ts` to warn temporarily, documented in docs.

- Contain Unsafe Boundaries
  - Create typed adapters at edges (e.g., API client wrappers) to stop `any` from propagating; keep any necessary `any` inside the adapter with documented suppression.
  - Prefer `HttpClient<T>` generics with concrete DTOs; avoid `get<any>`.

- Prevent Bypass via Cast Chains
  - Add code review checklist note: avoid `as unknown as T` cast chains; require minimal runtime checks or proper typing.
  - Optionally consider enabling `@typescript-eslint/no-unsafe-assignment` and related “strict” rules as warn later (tracked as follow‑up, not in this change).

- Align With Backend
  - Centralize DTOs under `shared/models` and tie changes to backend schema updates; include a PR checklist item to update DTOs on API changes.

- Templates (Follow‑Up)
  - Track a follow‑up to evaluate `@angular-eslint/template/no-any` and reduce `$any(...)` casts; keep out of scope for this change to minimize disruption.

**Residual Risks**

- Developers may still use over‑assertion to satisfy the compiler; mitigated by reviews and docs.
- Runtime shape mismatches remain possible without a validation library; mitigated by targeted type guards at critical paths.
- Third‑party typings may force isolated suppressions; contained by adapters and documented exceptions.

**Decisions Needed (Lightweight)**

- Specs severity: default to error; relax to warn only if tests block progress.
- Confirm DTOs directory: `frontend/src/app/shared/models`.
- Confirm template `$any(...)` handled in a separate follow‑up issue.

This setup enforces type safety with minimal code churn, clear CI signal, and bounded exceptions at integration boundaries.