**Design Review Findings**

- Sound and minimal: Changing the ESLint rule from warn to error aligns with current CI (`--max-warnings=0`) and should pass immediately given no `any` in TS sources.
- Decisions are clear: enforce across all TS (including specs), place shared DTOs under `frontend/src/app/shared/models`, and treat template `$any(...)` as a follow‑up.
- External impact is low: no broad refactors; CI behavior remains explicit and consistent.

**Risks & Mitigations**
- Hidden `any` in third‑party code: contain via small adapters; allow narrowly scoped, justified inline suppressions.
- Overuse of cast chains (`as unknown as T`): call out in docs and reviews; prefer guards or proper typing.
- Template `$any(...)` remains: explicitly out of scope; track follow‑up to evaluate `@angular-eslint/template/no-any`.

**Concrete Diffs**

ESLint: elevate `no-explicit-any` to error (keeps CI signal clear).
```diff
diff --git a/frontend/.eslintrc.cjs b/frontend/.eslintrc.cjs
--- a/frontend/.eslintrc.cjs
+++ b/frontend/.eslintrc.cjs
@@
   rules: {
-    '@typescript-eslint/no-explicit-any': 'warn',
+    '@typescript-eslint/no-explicit-any': 'error',
     // other rules...
   },
```

Docs: add concise guidance and exception policy.
```diff
diff --git a/docs/development-rules.md b/docs/development-rules.md
--- a/docs/development-rules.md
+++ b/docs/development-rules.md
@@
+## Frontend Type Safety: No `any`
+
+- Never use `any` in TypeScript sources under `frontend/src/app/**`.
+- Prefer type inference; when needed, define DTOs and shared interfaces in `frontend/src/app/shared/models` (PascalCase names).
+- At unsafe boundaries (e.g., `JSON.parse`, `localStorage`, third‑party SDKs), accept `unknown`, validate with type guards, then narrow.
+- Use Angular `HttpClient<T>` generics for requests; avoid `get<any>`.
+- Exceptions are narrow and documented:
+  - Use a single, tightly scoped disable with rationale and ticket reference:
+    // eslint-disable-next-line @typescript-eslint/no-explicit-any — 3rd‑party callback type; see T-1234
+  - Prefer containing `any` inside typed adapters so it doesn’t leak into app code.
+
+Examples
+
+```ts
+// DTOs (frontend/src/app/shared/models/user.dto.ts)
+export interface UserDto { id: string; name: string; email?: string }
+export type UserSummary = Pick<UserDto, 'id' | 'name'>
+
+// HttpClient usage
+this.http.get<UserDto[]>('/api/users')
+
+// Type guard for unsafe input
+function isUserDto(v: unknown): v is UserDto {
+  const o = v as Record<string, unknown>
+  return typeof o?.id === 'string' && typeof o?.name === 'string'
+}
+
+// JSON.parse boundary
+const raw: unknown = JSON.parse(text)
+if (!isUserDto(raw)) { /* handle error */ }
+const user = raw // typed via guard
+```
+
+Privacy notes
+- Model only fields needed by the UI; prefer narrow `Pick<>`s per feature.
+- Do not put PII in logs, URLs, or client storage; keep sensitive values in memory only.
+- Gate telemetry/analytics behind explicit consent and scrub values client‑side.
```

**Decisions Confirmed**
- Specs: enforce as error (consistent, clear CI signal).
- DTOs directory: `frontend/src/app/shared/models`.
- Templates: `$any(...)` is out of scope; evaluate template linting in a follow‑up.

**Acceptance Checks**
- `npm run lint` passes (no `any` in TS sources; rule at error).
- Docs updated with rationale, patterns, and exception policy.
- Future violations fail CI clearly; unavoidable edge cases use scoped, justified suppressions.