**Scope**

- Validate that `frontend` disallows `any` in TypeScript via ESLint.
- Confirm decision scope: includes specs; Angular template `$any(...)` out of scope.
- Ensure docs guidance exists and is discoverable.

**Test Types**

- Static analysis: ESLint as the primary “test”.
- Unit: Only if new guards/adapters are added later (not required now).
- Contract/E2E: Not applicable for this change.

**Static Analysis Checks**

- Rule enforcement
  - Verify `frontend/.eslintrc.cjs` sets `@typescript-eslint/no-explicit-any` to `error`.
  - Confirm `npm run lint` uses `--max-warnings=0` in `frontend/package.json`.
- Baseline pass
  - From `frontend/`, run: `npm ci && npm run lint` — expect 0 warnings, 0 errors.
- Negative tests (local-only, do not commit)
  - Create a temporary file `frontend/src/app/tmp-any.ts` with `const x: any = 1`.
  - Run `npm run lint` — expect failure with `no-explicit-any` error.
  - Remove the temp file and re-run lint — expect pass.
- Specs inclusion
  - Create `frontend/src/app/tmp-any.spec.ts` with `let y: any`.
  - Run `npm run lint` — expect failure (rule applies to specs).
  - Remove the temp file and re-run — expect pass.
- Template casts
  - Confirm existing `$any(...)` in HTML templates does not affect lint results (explicitly out of scope).

**Documentation Verification**

- Open `docs/development-rules.md` and confirm a “No any” section exists with:
  - Rationale, alternatives (`unknown`, generics, discriminated unions).
  - DTOs location: `frontend/src/app/shared/models`.
  - Exception policy: inline, narrowly scoped disable with rationale/ticket.
  - Boundary pattern: `unknown` + type guards and a brief example.
- Check links/paths are correct and examples compile in isolation.

**Regression Guardrails**

- CI gate: Ensure the pipeline runs `npm run lint` and fails on violations.
- PR review checklist additions:
  - No `any` in TS sources.
  - If an exception is unavoidable, an inline disable is narrowly scoped with a one-line rationale and ticket reference.
  - DTOs placed under `frontend/src/app/shared/models`.

**Risk-Based Spot Checks**

- Search for `: any`, `as any` in `frontend/src/app/**` — expect none.
- Inspect 1–2 representative API services to confirm `HttpClient<T>` generics usage (no `get<any>`).
- If adapters or type guards are introduced later, add unit tests for guard correctness (true/false cases).

**Exit Criteria**

- Lint passes on baseline: 0 warnings, 0 errors.
- Negative tests prove the rule fails on `any` in both source and specs.
- Docs updated with guidance and exception policy, paths verified.
- CI configured to fail on `any` violations (static analysis as contract).