# Docs Drafts (README, CHANGELOG, ADR)

## README Update (Development)

Add under “Frontend Development”:

- Type safety
  - Do not use `any` in TypeScript (`frontend/src/app/**`).
  - ESLint enforces `@typescript-eslint/no-explicit-any` as error.
  - Place shared DTOs/interfaces in `frontend/src/app/shared/models` (PascalCase).
  - Prefer inference; when needed use `unknown`, generics, discriminated unions, and type guards at unsafe boundaries.
  - Use `HttpClient<T>` generics; avoid `get<any>`.

Example:
```ts
// frontend/src/app/shared/models/user.dto.ts
export interface UserDto { id: string; name: string; email?: string }
export type UserSummary = Pick<UserDto, 'id' | 'name'>

// Usage
this.http.get<UserDto[]>('/api/users')

// Guard pattern
function isUserDto(v: unknown): v is UserDto {
  const o = v as Record<string, unknown>
  return typeof o?.id === 'string' && typeof o?.name === 'string'
}
```

Notes:
- Angular template `$any(...)` casts are not covered by this rule; consider avoiding them by typing handlers in component code.
- Exceptions must be narrowly scoped with an inline disable and one-line rationale:
```ts
// eslint-disable-next-line @typescript-eslint/no-explicit-any — 3rd‑party callback; see T-1234
function legacy(cb: (x: any) => void) { /* ... */ }
```


## CHANGELOG Entry

### [Unreleased]
- Enforce no `any` in frontend TypeScript
  - `@typescript-eslint/no-explicit-any` elevated to error; CI fails on violations.
  - Guidance added for DTOs, boundaries (`unknown` + guards), and exception policy.
  - DTOs location: `frontend/src/app/shared/models`.

Migration notes:
- Replace `any` with explicit interfaces/types or `unknown` + type guards.
- Use `HttpClient<T>` generics; avoid `get<any>`.
- If a third‑party API forces `any`, contain it inside a small adapter or add a narrowly scoped, justified inline disable.


## ADR: Frontend “No any” Policy

- Title: Enforce No `any` in Frontend TypeScript
- Status: Accepted
- Date: 2025-10-02
- Owners: Frontend Lead

Context
- Unrestricted `any` reduces type safety and obscures contracts. Our Angular frontend already uses ESLint + Prettier with zero warnings in CI.

Decision
- Disallow `any` in `frontend/src/app/**` via `@typescript-eslint/no-explicit-any` (error).
- Prefer inference; where explicit typing is needed, define interfaces/DTOs under `frontend/src/app/shared/models` (PascalCase).
- At unsafe boundaries (e.g., `JSON.parse`, `localStorage`, 3rd‑party SDKs), use `unknown` then validate with type guards before narrowing.
- Use `HttpClient<T>` generics for API calls.

Scope
- Applies to all frontend TypeScript files, including specs.
- Angular templates `$any(...)` are out of scope for this change; potential follow-up with template linting.

Exceptions
- Narrow, justified, and localized only. Use an inline disable with a one-line rationale and ticket reference.
- Prefer containing unavoidable `any` inside typed adapters so it doesn’t leak into app code.

Consequences
- Clear CI signal on unsafe typing; improved maintainability and readability.
- Minor overhead to define DTOs/guards; mitigated by examples and adapters.
- Future contributions that introduce `any` will fail lint until corrected or justified.

Implementation Notes
- Rule: `@typescript-eslint/no-explicit-any` set to `error`.
- Lint gate: `npm run lint` with `--max-warnings=0`.
- DTOs directory: `frontend/src/app/shared/models`.
- Documentation: Short guidance in `docs/development-rules.md` with examples, exception format, and privacy-by-design notes (minimize DTO fields, avoid PII in storage/logs/URLs, require consent for telemetry).

Alternatives Considered
- Allow `any` with warnings: rejected (ambiguous CI signal).
- Immediately add strict “no-unsafe-*” rules: deferred as a follow-up to minimize disruption.

Follow-Up (Optional)
- Evaluate `@angular-eslint/template/no-any` (warn) to reduce `$any(...)` in templates.
- Consider enabling `@typescript-eslint/no-unsafe-assignment/member-access/argument` as warn later for additional guardrails.