**Doc Consistency Findings**

- Terminology
  - Use “Disallow `any`” (not “no any” or “ban any”).
  - Capitalize consistently: TypeScript, Angular, ESLint, Prettier, DTO, CI.
  - Use “type guard”, “adapter”, and “spec files” (`*.spec.ts`) consistently.

- Code/Rule Formatting
  - Wrap rule names, code, and paths in backticks: `@typescript-eslint/no-explicit-any`, `HttpClient<T>`, `frontend/src/app/shared/models`.
  - Rule severity: use `'error'` everywhere; avoid mixing with “warn” in narrative unless explicitly contrasting.
  - Inline disable comments should use ASCII hyphens, not em dashes, and avoid curly quotes:
    // eslint-disable-next-line @typescript-eslint/no-explicit-any - 3rd-party callback; see T-1234

- Scope Phrasing
  - State clearly: applies to all TypeScript in `frontend/src/app/**`, including spec files.
  - Angular template `$any(...)` is out of scope for this change; avoid asserting specific file occurrences to prevent drift.

- Paths and Locations
  - Use a single canonical dir for shared types/DTOs: `frontend/src/app/shared/models`.
  - Refer to files and extensions consistently: “spec files (`*.spec.ts`)”, not “specs/tests”.

- Examples Style
  - Use TypeScript code fences (` ```ts `).
  - Prefer concise examples with single quotes and semicolons, matching Prettier config.
  - Keep examples generic and non-PII (e.g., `user@example.com` OK).

- Headings and Lists
  - Use Title Case for section headers (e.g., “Frontend Type Safety: Disallow `any`”).
  - Keep bullets parallel and imperative; avoid repeating the same point across sections.

- Remove/Resolve Inconsistencies
  - Conflicting statements about `$any(...)` usage: replace with a neutral, scoped statement (“out of scope; consider follow-up template linting”).
  - Duplicate CI signal notes: consolidate to one clear statement that CI runs `npm run lint` with `--max-warnings=0` and the rule is `error`.

- Language and Hyphenation
  - Prefer “third-party” (hyphenated), “follow-up” (hyphenated), “fallback” (single word).
  - Use American English consistently (e.g., “behavior”, “sanitize”).

- Privacy Notes (concise, consistent)
  - Keep bullets short: minimize DTO fields, no PII in logs/URLs/client storage, consent for telemetry.

Applying the above will keep the ESLint/docs guidance crisp, consistent, and aligned with repo conventions.