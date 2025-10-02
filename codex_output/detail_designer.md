**Design Summary**

- Goal: Enforce “no any” in the Angular/TypeScript frontend with minimal churn; promote explicit interfaces/types and safe boundary patterns.
- Scope: `frontend/src/app/**` TypeScript sources. Angular template `$any(...)` is out of scope for this change.

**Decisions**

- Severity: `@typescript-eslint/no-explicit-any` set to error across all TS, including specs.
- DTOs location: `frontend/src/app/shared/models`.
- Template casts: treat `$any(...)` as a separate, follow-up template linting task.
- Exceptions: allow narrowly scoped, inline disables with a one-line rationale and ticket reference at hard boundaries only.

**Approach**

- Enforce via ESLint; keep CI signal clear (errors, not warnings).
- Prefer type inference where sufficient; require explicit interfaces for API DTOs, component inputs/outputs, and service boundaries.
- Replace `any` with `unknown`, generics, discriminated unions, or targeted type guards as needed.
- Contain third‑party or generated `any` behind typed adapters so it doesn’t leak into app code.

**Interfaces & Examples**

- DTOs and shared types (`frontend/src/app/shared/models`):
  - Example:
    - `frontend/src/app/shared/models/user.dto.ts`
      - export interface UserDto { id: string; name: string; email?: string }
    - Narrow per-feature picks when appropriate:
      - export type UserSummary = Pick<UserDto, 'id' | 'name'>

- Service usage with generics:
  - this.http.get<UserDto[]>(`/api/users`)
  - this.http.post<CreateUserResult>(`/api/users`, payload)

- Type guard pattern (unsafe input → safe model):
  - function isUserDto(v: unknown): v is UserDto { return typeof (v as any)?.id === 'string' && typeof (v as any)?.name === 'string' }

- Avoid “cast chains”:
  - Discourage `something as unknown as T`; prefer guards or proper typing.

**Unsafe Boundaries**

- JSON.parse, localStorage, 3rd-party SDKs, and loosely typed libs return `unknown`:
  - Parse to `unknown`, validate via guards, then narrow.
  - Wrap external SDKs in small adapters that expose typed methods.
- HttpClient:
  - Use `HttpClient<T>` with DTOs; avoid `get<any>`.
- Contain unavoidable `any` internally with a single, documented disable:
  - // eslint-disable-next-line @typescript-eslint/no-explicit-any — 3rd-party callback type; see T-1234

**ESLint Configuration**

- `frontend/.eslintrc.cjs`:
  - rules: { '@typescript-eslint/no-explicit-any': 'error' }
  - Keep existing `--max-warnings=0` in `npm run lint`.
- Optional later hardening (not in this change): consider `no-unsafe-assignment` et al. as warn.

**Docs Update**

- `docs/development-rules.md` add a short section:
  - Why not `any` and its risks.
  - Alternatives: `unknown`, generics, discriminated unions; brief examples.
  - DTOs location and naming guidance (PascalCase models, narrow types via `Pick`/`Omit`).
  - Exception policy: inline, narrowly scoped, include 1-line rationale and ticket.
  - Boundary pattern for `JSON.parse`/SDKs: `unknown` + guards before use.
  - Privacy notes: model only needed fields, avoid PII in client storage/logs/URLs, require consent for telemetry, optional JSDoc `@pii`.

**Failure Handling**

- When validation fails at boundaries:
  - Log sanitized error (no PII), return safe defaults, or surface user-friendly error state.
  - Do not throw unhandled errors from guards/adapters; contain and map to UI states.
- Network/API mismatches:
  - Fail closed in adapters (return partial defaults or typed error object) to prevent unsafe propagation.

**Trade-offs**

- Pros: Stronger safety, clearer contracts, better DX and maintainability.
- Cons: Minor overhead writing guards/adapters; initial friction for contributors accustomed to `any`.
- Mitigation: Keep examples in docs, allow narrow, documented exceptions, rely on inference where sufficient.

**Migration & Rollout**

- Expect minimal changes (no known `any` in TS sources); rule set to error should pass immediately.
- If violations appear, fix quickly or add temporary, justified inline suppression at the boundary with a follow-up ticket.

**Acceptance & Validation**

- ESLint rule set to error; lint passes locally and in CI.
- No `any` in `frontend/src/app/**`; unavoidable cases have scoped, justified disables.
- Docs updated with rationale, alternatives, DTOs location, exceptions, and boundary patterns.
- Future violations fail CI, maintaining the standard.

**Out of Scope / Follow-Up**

- Evaluate `@angular-eslint/template/no-any` to reduce `$any(...)` in templates.
- Consider stricter “no-unsafe-*” rules after baseline adoption.