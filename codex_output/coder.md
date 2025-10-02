I’m updating the ESLint rule to error on `any` and adding a short docs section. I also scanned the codebase for `any` usage to ensure lint will pass.

**Changes**

- ESLint rule: elevate `@typescript-eslint/no-explicit-any` to error
  - File: `frontend/.eslintrc.cjs`
  - Replacement block:
    - Before: `'@typescript-eslint/no-explicit-any': 'warn',`
    - After: `'@typescript-eslint/no-explicit-any': 'error',`

- Docs: add “Frontend Type Safety: No any” section with guidance and examples
  - File: `docs/development-rules.md`
  - Full addition (appended to file):
    - Adds rules for no `any`, DTO location `frontend/src/app/shared/models`, boundaries pattern using `unknown` + type guards, `HttpClient<T>`, and exception policy with inline suppression format.
    - Includes examples and privacy notes (minimize fields, avoid PII in storage/logs/URLs, consent for telemetry).

Full replacement blocks applied

- frontend/.eslintrc.cjs
  - Updated rule line:
    - '@typescript-eslint/no-explicit-any': 'error',

- docs/development-rules.md
  - Appended section:
    - Heading: Frontend Type Safety: No `any`
    - Content:
      - Policy bullets, examples (DTOs, HttpClient<T>, type guard, JSON.parse boundary), and privacy notes.
      - Inline suppression format:
        // eslint-disable-next-line @typescript-eslint/no-explicit-any — 3rd‑party callback type; see T-1234

**Commands Run**

- List repo and locate ESLint/Docs
  - `ls -la`
  - `ls -la frontend`

- Inspect ESLint config and docs
  - `sed -n '1,200p' frontend/.eslintrc.cjs`
  - `sed -n '1,220p' docs/development-rules.md`
  - `cat frontend/package.json`
  - `sed -n '1,200p' frontend/scripts/run-eslint-legacy.cjs`

- Verify no TypeScript `any` usage that would violate the rule
  - HTML `$any(...)` (out of TS scope):
    - `rg -n "no-explicit-any|any\\b|as any" -S frontend/src || true`
  - TS-only scan for explicit any constructs:
    - `rg -n "(:\\s*any\\b)|(<any>)|(as\\s+any\\b)" -S frontend/src || true`

Findings

- ESLint now errors on `any` in the frontend.
- No TypeScript `any` occurrences found in `frontend/src/**`.
- HTML templates contain `$any(...)` casts (e.g., `frontend/src/app/features/settings/page.html`), which are out of scope for TypeScript ESLint and this change.
- CI already runs `npm run lint` with `--max-warnings=0` (confirmed in `frontend/package.json`). The elevated rule aligns the signal with CI.

**How to Validate Locally**

- From `frontend/`:
  - Install deps and lint:
    - `npm ci`
    - `npm run lint` (expects 0 warnings, 0 errors)
  - Negative check (do not commit):
    - Create `src/app/tmp-any.ts` with `const x: any = 1`
    - `npm run lint` should fail with a `no-explicit-any` error
    - Remove the temp file and re-run lint

**Notes**

- Scope includes specs; rule applies uniformly (clear CI signal).
- Shared DTOs live under `frontend/src/app/shared/models`.
- Angular `$any(...)` in templates is explicitly out of scope here; consider a follow-up for template linting if desired.