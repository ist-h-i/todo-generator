# Development Rules

Follow these rules to keep delivery predictable and maintain quality.

---

## Recommended Workflow
1. **Sync with the latest `main`**
   - Run `git pull origin main` before you start and periodically during development.
   - Resolve conflicts early to avoid large merge chores at the end.
2. **Implement in small steps and self-review**
   - Confirm requirements or ticket acceptance criteria before coding.
   - Commit in focused increments and re-read your diff before asking for review.
3. **Run the checks that match your changes**
   - Target only the relevant areas instead of running every tool every time.
   - The most common commands are:
     - Backend tests: `pytest backend/tests`
     - Backend lint: `ruff check backend`
     - Backend formatting: `black --check backend/app backend/tests`
     - Frontend lint: `cd frontend && npm run lint`
     - Frontend formatting: `cd frontend && npm run format:check`
     - Frontend tests: `cd frontend && npm test -- --watch=false`
     - Frontend build: `cd frontend && npm run build`
   - If you only changed documentation or comments, you may skip automated checks, but keep README and `docs/` aligned with current behavior.
4. **Keep documentation current**
   - Update `README.md`, architecture notes, and feature specs when behavior changes.
   - Double-check cross references and workflow diagrams for accuracy.
5. **Capture UI evidence when visuals change**
   - Run `npm start` from `frontend/`, take screenshots that cover key states and breakpoints, and attach them to the pull request with annotations when useful.
6. **Rebase or merge the latest `main` before completion**
   - Use `git fetch origin main && git merge origin/main` (or rebase) near the end of your work.
   - Resolve conflicts and rerun the relevant tests or builds afterwards.

### Codex workflow limitations
- Runs triggered by external contributors cannot access repository secrets (e.g., `CODEX_AUTH_JSON_B64`).
- If secrets are unavailable, Codex cannot run. A maintainer with write access should re-run via **Run workflow**, or an authorized user can trigger by commenting `/codex ...` on the issue.
- This workflow uses ChatGPT authentication. `OPENAI_API_KEY` is not required.
- When you work in **Agent Mode**, create a feature branch from the latest `main`, commit each meaningful output, and push regularly so that every automated run has a clean history to diff against.

---

## Pre-merge Requirements
1. **Complete the necessary quality checks**
   - Code changes: run all tests, linters, and builds that apply to the touched areas.
   - Documentation-only updates: automated checks are optional, but review for correctness and tone.
2. **Bring in the latest `main`**
   - Resolve every conflict before requesting review.
   - After resolving conflicts, rerun the impacted checks.
3. **Conflict resolution expectations**
   - Never leave conflict markers in the tree.
   - Verify runtime behavior if the merge touched executable code.
4. **UI change expectations**
   - Attach before/after screenshots, covering the relevant screen sizes and states.
   - Call out any manual verification that reviewers should repeat (for example, keyboard navigation or mobile layouts).

---

## Reference JSON (automation helper)
The following snapshot mirrors the workflow above for tooling that consumes structured metadata.

```json
{
  "development_rules": {
    "workflow": [
      "Pull the latest main branch at the start and during development to resolve differences early.",
      "Confirm requirements, commit in small increments, and perform self-review.",
      "Re-read your diff before requesting review and complete a self-check."
    ],
    "quality_checks": {
      "code_changes": {
        "backend_tests": "pytest backend/tests",
        "backend_lint": "ruff check backend",
        "backend_format": "black --check backend/app backend/tests",
        "frontend_lint": "cd frontend && npm run lint",
        "frontend_format": "cd frontend && npm run format:check",
        "frontend_tests": "cd frontend && npm test -- --watch=false",
        "frontend_build": "cd frontend && npm run build",
        "rules": [
          "Run only the checks required for the areas that changed.",
          "Fix failures and rerun the relevant commands until they pass."
        ]
      },
      "doc_or_comment_changes": {
        "skip_checks": true,
        "rules": [
          "You may skip automated checks when only documentation or comments change.",
          "Run the normal checks if documentation updates might affect code behavior."
        ]
      }
    },
    "documentation_and_ui": [
      "Keep README.md and docs/ aligned with the latest specifications.",
      "Preview UI changes, capture screenshots, and attach them to the merge request.",
      "Capture every relevant screen variation and share before/after comparisons when helpful."
    ],
    "pre_merge_requirements": {
      "code_changes": [
        "All required checks must pass for code changes.",
        "Merge or rebase main before requesting review."
      ],
      "doc_or_comment_changes": [
        "Documentation-only or comment-only changes focus on accuracy; automated checks are optional."
      ],
      "common": [
        "Resolve conflicts and rerun impacted checks after merging main.",
        "Attach screenshots for UI changes.",
        "Explain any manual verification performed during QA."
      ]
    }
  }
}
```

## Frontend Type Safety: No `any`

- Do not use `any` in TypeScript sources under `frontend/src/app/**`.
- Prefer type inference where sufficient; when explicit types are needed, define DTOs and shared interfaces in `frontend/src/app/shared/models` (PascalCase names).
- At unsafe boundaries (e.g., `JSON.parse`, `localStorage`, third‑party SDKs), accept `unknown`, validate with type guards, then narrow.
- Use Angular `HttpClient<T>` generics for requests; avoid `get<any>`.
- Exceptions are narrow and documented:
  - Use a single, tightly scoped disable with rationale and ticket reference:
    // eslint-disable-next-line @typescript-eslint/no-explicit-any — 3rd‑party callback type; see T-1234
  - Prefer containing any unavoidable `any` inside typed adapters so it doesn’t leak into app code.

Examples

```ts
// DTOs (frontend/src/app/shared/models/user.dto.ts)
export interface UserDto { id: string; name: string; email?: string }
export type UserSummary = Pick<UserDto, 'id' | 'name'>

// HttpClient usage
this.http.get<UserDto[]>('/api/users')

// Type guard for unsafe input
function isUserDto(v: unknown): v is UserDto {
  const o = v as Record<string, unknown>
  return typeof o?.id === 'string' && typeof o?.name === 'string'
}

// JSON.parse boundary
const raw: unknown = JSON.parse(text)
if (!isUserDto(raw)) { /* handle error */ }
const user = raw // typed via guard
```

Privacy notes
- Model only fields needed by the UI; prefer narrow `Pick<>`s per feature.
- Do not put PII in logs, URLs, or client storage; keep sensitive values in memory only.
- Gate telemetry/analytics behind explicit consent and scrub values client‑side.
