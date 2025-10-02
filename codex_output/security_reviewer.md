**Findings**

- Type safety enforcement
  - `@typescript-eslint/no-explicit-any` is set to error and applies to all TS files. Config: frontend/.eslintrc.cjs:23.
  - Lint gate fails on warnings: frontend/package.json:7.
  - No explicit `any` in TS sources; only Angular template `$any(...)` casts appear in multiple templates (e.g., frontend/src/app/features/settings/page.html:52).
- Input validation at unsafe boundaries
  - LocalStorage reads use `JSON.parse` followed by strong runtime sanitization before use:
    - Preferences: frontend/src/app/core/state/workspace-store.ts:2663, frontend/src/app/core/state/workspace-store.ts:2915.
    - Settings: frontend/src/app/core/state/workspace-store.ts:2700, frontend/src/app/core/state/workspace-store.ts:2991.
  - Sanitizers enforce shape/whitelists (IDs, enums, arrays) and defaulting. Good defensive coding.
- Secret/token handling (frontend)
  - Access token is stored in `localStorage` with migration and error handling; clear on logout:
    - Read/write: frontend/src/app/core/auth/auth.service.ts:91, frontend/src/app/core/auth/auth.service.ts:176, frontend/src/app/core/auth/auth.service.ts:206.
  - Storing bearer tokens in `localStorage` is susceptible to XSS exfiltration.
- Dependency posture
  - Angular 20 + ESLint 9 + @typescript-eslint 8; versions are pinned and a lockfile is present (frontend/package-lock.json).
  - `patch-package` and `overrides` are used to constrain transitive deps (frontend/package.json:66, 94).
  - No evidence of insecure DOM APIs or bypass sanitizers; no `DomSanitizer` or `innerHTML` use detected.

**Risks**

- XSS-exfiltration of tokens: `localStorage` token can be read by injected scripts.
- Template `$any(...)` casts hide typing mistakes and can encourage unsafe event handling patterns.
- Cast chains and “unsafe” TypeScript flows aren’t currently linted (e.g., `no-unsafe-*`), leaving room for bypasses via assertions.
- Lack of CSP/Trusted Types in `index.html` increases the blast radius of any XSS.

**Recommendations**

- Token storage
  - Prefer migrating auth to secure, `HttpOnly`, `SameSite=strict`, `Secure` cookies set by the backend. If migration is out of scope, keep the token confined:
    - Never log tokens; avoid interpolating into the DOM; continue centralizing all reads/writes in AuthService (already done).
    - Consider short TTL and rotation to reduce exposure window.
- Template safety
  - Reduce `$any(...)` usage by typing handlers and extracting values in component code:
    - Replace `(input)="statusForm.controls.name.setValue($any($event.target).value)"` with `(input)="onStatusNameInput($event)"` and in TS: `onStatusNameInput(e: Event) { const t = e.target as HTMLInputElement; this.statusForm.controls.name.setValue(t.value); }`.
  - Optional follow-up: enable `@angular-eslint/template/no-any` (warn) to catch future uses without breaking CI immediately.
- Harden linting (low-impact, follow-up)
  - Consider enabling as `warn`: `@typescript-eslint/no-unsafe-assignment`, `no-unsafe-member-access`, `no-unsafe-argument` to discourage assertion-based bypasses. Keep “error” for `no-explicit-any`.
- Boundary validation
  - Current sanitizers are strong; keep the pattern and add unit tests for critical guards if behavior expands (e.g., new fields).
- Client storage hygiene
  - Preferences/settings already sanitize; ensure no PII beyond what UI needs is persisted. Avoid storing emails or identifiers not required for UX.
- Browser security headers (served by hosting)
  - Add or document server-side headers: a strict CSP (default-src 'self'; connect-src allowlisted APIs; object-src 'none'; base-uri 'self'; frame-ancestors 'none'), `Referrer-Policy: same-origin`, `Permissions-Policy` to limit sensors, and consider `TrustedTypes` for Angular (CSP `require-trusted-types-for 'script'` + policy).
  - If serving purely as static files, consider a `<meta http-equiv="Content-Security-Policy" ...>` fallback with a nonces-less minimal policy.

**Quick Checks Performed**

- ESLint config confirms `no-explicit-any` error: frontend/.eslintrc.cjs:23.
- Lint gate config with zero warnings: frontend/package.json:7.
- TS sources contain no `any`; templates use `$any(...)`: frontend/src/app/features/settings/page.html:52.
- JSON.parse inputs are sanitized: frontend/src/app/core/state/workspace-store.ts:2663, frontend/src/app/core/state/workspace-store.ts:2915, frontend/src/app/core/state/workspace-store.ts:2991.
- Token persisted in localStorage: frontend/src/app/core/auth/auth.service.ts:176.

**Minimal, Safe Next Steps**

- Keep current ESLint “error” setting; no code changes required to pass.
- Create a small follow-up ticket to:
  - Introduce `@angular-eslint/template/no-any` as warn.
  - Evaluate cookie-based auth to remove `localStorage` token.
  - Document CSP/headers in deployment config.