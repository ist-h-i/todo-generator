**Verdict**
- Feasible and consistent with the repo. Minimal impact expected: current frontend TypeScript code has no `any` usage, and ESLint is already in place.

**Consistency Check**
- ESLint exists and runs on `src/**/*.{ts,tsx}` with zero warnings allowed (`--max-warnings=0`) in `frontend/package.json:7`.
- Current config sets `@typescript-eslint/no-explicit-any` to warn, which effectively fails CI anyway due to `--max-warnings=0` (should be set to error for clarity): `frontend/.eslintrc.cjs:30`.
- No TypeScript `any` occurrences found in `frontend/src/**`. Angular templates use `$any(...)` casts across several files (e.g., `frontend/src/app/features/settings/page.html:52`), which are out of scope for TypeScript ESLint.

**Gaps / Decisions Needed**
- Scope for specs: enforce as error in `*.spec.ts`, or downgrade to warn? Current lint includes specs.
- Template `$any(...)`: treat as out of scope or add a template rule (e.g., `@angular-eslint/template/no-any`) in a follow-up?
- Where to place shared types/DTOs: confirm a canonical location (e.g., `frontend/src/app/shared/models`).
- Exceptions policy: define narrow, justified cases (3rd‑party interop, migrations) and require inline disable with a short rationale and ticket link.
- Boundaries guidance: clarify patterns for `unknown` + type guards at unsafe boundaries (e.g., `JSON.parse`, external data).

**Feasibility in Repo**
- Adoption risk is low: no `: any` or `as any` found in TS sources.
- Changing the rule to error aligns with CI, and should pass immediately.

**Suggested Refinements (Requirements-Level)**
- ESLint enforcement: set `@typescript-eslint/no-explicit-any` to error for `frontend/src/app/**`. If desired, override specs to warn:
  - Error: `frontend/.eslintrc.cjs` base rules
  - Optional override: files `**/*.spec.ts` → warn (document decision)
- Documentation: add a brief section to `docs/development-rules.md` covering:
  - Rationale for not using `any`
  - Alternatives: `unknown`, generics, discriminated unions
  - Typed DTOs location and examples
  - Exception policy and inline disable format (with ticket)
  - Unsafe boundary patterns (e.g., `unknown` + type guards)
- Templates: explicitly note that Angular `$any(...)` is not covered by this change. Optionally propose a follow-up to add template linting if the team wants parity.

**Acceptance Traceability**
- ESLint rule enabled as error (source) and decision on specs documented.
- `npm run lint` passes on current codebase (no TS `any` found).
- Docs updated in `docs/development-rules.md` with guidance and exceptions policy.
- New/modified code avoids `any`; unsafe boundaries use `unknown` + guards.
- CI fails on violations per the lint setup.

If you confirm the decisions on specs severity, DTOs location, and template `$any`, the requirements are complete and ready for planning.