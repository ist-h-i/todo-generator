# Development Governance Handbook

## Purpose
This handbook consolidates the repository-wide development rules and AI-driven standards into a single reference. It groups expectations by responsibility area so engineers, reviewers, and automation can rely on one source for coding practices, workflow agreements, and quality gates.

The Angular single-page application follows the complementary guidance in [`guidelines/angular-coding-guidelines.md`](../guidelines/angular-coding-guidelines.md). Use both documents together when touching SPA code.

## Standards & Practices

### Repository & Project Structure
- `backend/app` contains FastAPI routers, services, models, and migrations; keep mirrors for tests under `backend/tests/**` and shared fixtures in `backend/tests/utils`.
- `frontend/src/app` separates shared infrastructure (`core`, `shared`, `lib`) from feature modules under `features/*`. Specs live beside the implementation files they validate.
- Documentation belongs in `docs/` and is indexed from `docs/README.md`. Automation and helper scripts belong in `scripts/` (for example `run_codex_pipeline.sh`).
- Keep environments isolated per `.venv` / `node_modules`. Do not commit generated artefacts or local environment files beyond `.env.example` style templates.

### Python & Backend Practices
- Prefer typed, synchronous FastAPI routers that delegate business logic to `app/services/**`. Limit routers to request validation, response shaping, and dependency wiring via `Depends`.
- Model persistence with SQLAlchemy in `app/models.py` (or adjacent modules) and expose strict Pydantic schemas under `app/schemas/**`. Use PascalCase for schema classes and snake_case for packages and modules.
- Use repository helpers or service classes to isolate side effects (database writes, external APIs, encryption) so they are unit-test friendly.
- Keep migrations additive and idempotent. Startup migrations run through `run_startup_migrations`, so guard destructive changes with explicit operator instructions.
- Log sensitive events with structured logging but avoid copying secrets or personally identifiable information into logs. Respect `settings.allowed_origins` for CORS and keep default logging levels at INFO.

### Shared Tooling & Formatting
- `.editorconfig` enforces UTF-8, two-space indentation, trimmed trailing whitespace, and terminal newlines.
- Format Python with Black (`black backend/app backend/tests`) and lint with Ruff (`ruff check backend`). Resolve Ruff warnings rather than suppressing them if at all possible.
- Type hints are required for new Python code. Favour `typing.Annotated` for FastAPI parameter constraints and `from __future__ import annotations` to avoid forward reference issues.
- Frontend code is formatted with Prettier via the Angular tooling; lint with ESLint (`npm run lint`) and keep TypeScript strictness intact (`"noImplicitAny": true`).
- Never check in `any` to the Angular app without a narrowly scoped ESLint suppression and matching justification. Prefer domain DTOs in `frontend/src/app/shared/models`.

### Quality Gates & Automation
- Backend tests live under `backend/tests/test_*.py`; reuse fixtures in `backend/tests/conftest.py` and exercise service-layer behaviour plus edge-case validation.
- Frontend specs belong next to the implementation (`*.spec.ts`). Disable watch mode in CI (`npm test -- --watch=false`) and favour Angular Testing Library helpers.
- Run the relevant quality checks before raising a PR:
  - Backend tests: `pytest backend/tests`
  - Backend lint: `ruff check backend`
  - Backend formatting: `black --check backend/app backend/tests`
  - Frontend lint: `cd frontend && npm run lint`
  - Frontend formatting: `cd frontend && npm run format:check`
  - Frontend tests: `cd frontend && npm test -- --watch=false`
  - Frontend build: `cd frontend && npm run build`
- Target the commands that match your changes; skip unrelated areas to keep feedback loops fast.
- For documentation-only updates you may skip automated checks, but reread the affected docs for tone and accuracy.
- Capture manual verification steps (screenshots, reproduction scripts) whenever user-facing behaviour changes.

### Git Workflow & Pull Requests
- Write imperative, capitalised commit subjects around 65 characters. Squash fixups before merging.
- Sync with `main` frequently (`git pull origin main`) and resolve conflicts early. Rebase or merge main before requesting review.
- PR descriptions must link the relevant issue, explain behavioural changes, and mention migrations or configuration updates. Include before/after screenshots for UI adjustments and record any manual QA completed.

### Security & Configuration
- Preserve ownership and tenant scoping in critical routers such as `backend/app/routers/reports.py` to prevent cross-admin escalation.
- Manage secrets through the admin console backed by a strong `SECRET_ENCRYPTION_KEY`. Override `DATABASE_URL` outside the SQLite sandbox and never log decrypted secrets.
- Align CORS settings with the deployed SPA origin list. Avoid verbose logging of payloads when `DEBUG` or verbose logging is enabled.
- Audit third-party dependencies periodically with `npm run lint`, `npm audit`, and backend dependency checks. Document security exceptions in `docs/security-review.md`.

### Documentation & Knowledge Sharing
- Keep `README.md`, architecture docs, feature playbooks, and workflow diagrams up to date when behaviour changes.
- Note intentional deviations from standards in the affected document with rationale and impact. Keep decision records in issues for future onboarding.
- Capture architecture or workflow changes in playbooks so downstream teams inherit the latest rationale.

### AI-Driven Development Common Standards
These principles consolidate the AI-driven development guidelines into the primary repository playbook. They apply to every role alongside the practices above.

Refer to the detailed [AI Agent Development Guidelines](../../.codex/policies/ai_dev_guidelines.md) for cost-optimized execution rules, task scope constraints, and validation requirements that govern Codex pipelines and GitHub Actions.

#### Core Development Philosophy
- Deliver more than working code by keeping quality, maintainability, and safety front of mind.
- Balance scope, speed, and rigour according to the project phase (prototype, MVP, production).
- Address issues when you discover them or document them explicitly with owners and follow-up plans.
- Apply the Boy Scout Rule: leave the codebase in a better state than you found it.

#### Error Handling Principles
- Resolve every error even if it appears only loosely related to the task at hand.
- Fix root causes instead of silencing issues with tools such as `@ts-ignore` or blanket `try/catch` blocks.
- Detect problems early and return actionable, clear error messages.
- Cover error paths with automated tests.
- Assume external APIs and network calls can fail and design accordingly.

#### Code Quality Standards
- Follow the DRY principle to avoid duplication and maintain a single source of truth.
- Use descriptive variable and function names that communicate intent.
- Keep a consistent coding style across the project.
- Repair small issues immediately to prevent "broken windows" from accumulating.
- Reserve comments for explaining "why"; let the code communicate "what".

#### Testing Discipline
- Do not skip tests; fix the problems they reveal.
- Test observable behaviour rather than private implementation details.
- Keep tests independent so they run in any order.
- Ensure suites are fast and deterministic.
- Treat coverage as a guiding metric while prioritising meaningful test scenarios.

#### Maintainability & Refactoring
- Improve existing code while adding new functionality.
- Break large changes into small, reviewable steps.
- Remove unused code proactively.
- Update dependencies regularly for security and compatibility.
- Record technical debt explicitly in comments or documentation.

#### Security Mindset
- Manage API keys, passwords, and secrets through environment variables—never hard-code them.
- Validate every piece of external input.
- Operate with the principle of least privilege.
- Avoid unnecessary dependencies.
- Run security auditing tools on a recurring schedule.

#### Performance Awareness
- Optimise based on measurement instead of assumptions.
- Consider scalability from the earliest stages of design.
- Defer loading resources until they are needed.
- Define cache expiration and invalidation strategies.
- Guard against N+1 queries and over-fetching.

#### Reliability Commitments
- Configure appropriate timeouts.
- Implement retries with exponential backoff when appropriate.
- Apply circuit-breaker patterns to isolate cascading failures.
- Design for resilience to transient faults.
- Provide observability with useful logs and metrics.

#### Understanding Project Context
- Balance business and technical requirements when choosing solutions.
- Match the required quality level to the current project phase.
- Maintain baseline quality even when time is tight.
- Align implementation choices with the team’s skill sets.

#### Recognising Trade-offs
- Accept that no silver bullet exists—perfection is unattainable.
- Find the optimal balance within project constraints.
- Emphasise simplicity for prototypes and robustness for production systems.
- Document compromises and the reasoning behind them.

#### Git Hygiene Basics
- Use Conventional Commit prefixes (`feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `chore:`).
- Keep commits atomic and focused on a single change.
- Write clear, descriptive commit messages in English.
- Avoid committing directly to the `main` or `master` branches.

#### Code Review Mindset
- Treat review comments as constructive suggestions for improvement.
- Keep feedback focused on the code instead of individuals.
- Explain the rationale and impact behind changes.
- Welcome feedback as a learning opportunity.

#### Debugging Best Practices
- Establish reproducible steps before investigating issues.
- Narrow problems quickly by using binary search techniques.
- Review recent changes first when triaging.
- Use appropriate tools such as debuggers and profilers.
- Record findings and share the knowledge with the team.

#### Dependency Management
- Add dependencies only when they are truly necessary.
- Commit lock files such as `package-lock.json`.
- Evaluate licence, bundle size, and maintenance health before adding new dependencies.
- Update dependencies regularly to pick up security patches and bug fixes.

#### Documentation Standards
- Keep the README up to date with project overview, setup steps, and usage instructions.
- Synchronise documentation with the current state of the codebase.
- Provide concrete examples wherever possible.
- Record major design decisions as Architecture Decision Records (ADRs).

#### Continuous Improvement
- Carry lessons learned forward to future work.
- Run regular retrospectives to adjust team processes.
- Evaluate and adopt new tools or techniques deliberately.
- Document knowledge for teammates and future contributors.

### Frontend Type Safety: No `any`
- Do not use `any` in TypeScript sources under `frontend/src/app/**`.
- Prefer type inference where sufficient; when explicit types are needed, define DTOs and shared interfaces in `frontend/src/app/shared/models` (PascalCase names).
- At unsafe boundaries (e.g., `JSON.parse`, `localStorage`, third‑party SDKs), accept `unknown`, validate with type guards, then narrow.
- Use Angular `HttpClient<T>` generics for requests; avoid `get<any>`.
- Exceptions are narrow and documented:
  - Use a single, tightly scoped disable with rationale and ticket reference:
    ```ts
    // eslint-disable-next-line @typescript-eslint/no-explicit-any — 3rd-party callback type; see T-1234
    ```
  - Prefer containing any unavoidable `any` inside typed adapters so it doesn’t leak into app code.
  - Angular ControlValueAccessor requires `writeValue(obj: any)`. Keep the `any` limited to that method signature and handle enforcement via an ESLint file override rather than pervasive inline disables.

#### Examples
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

#### Privacy Notes
- Model only fields needed by the UI; prefer narrow `Pick<>`s per feature.
- Do not put PII in logs, URLs, or client storage; keep sensitive values in memory only.
- Gate telemetry/analytics behind explicit consent and scrub values client‑side.

## Workflow Agreements

### Daily Flow
1. **Sync with the latest `main`**
   - Run `git pull origin main` before you start and periodically during development.
   - Resolve conflicts early to avoid large merge chores at the end.
2. **Implement in small steps and self-review**
   - Confirm requirements or ticket acceptance criteria before coding.
   - Commit in focused increments and re-read your diff before asking for review.
3. **Run the checks that match your changes**
   - Target only the relevant areas instead of running every tool every time.
   - Use the quality gate commands listed in [Quality Gates & Automation](#quality-gates--automation).
4. **Keep documentation current**
   - Update `README.md`, architecture notes, feature specs, and workflow diagrams when behaviour changes.
   - Double-check cross references and diagrams for accuracy before merging.
5. **Capture UI evidence when visuals change**
   - Run `npm start` from `frontend/`, take screenshots that cover key states and breakpoints, and attach them to the pull request with annotations when useful.
6. **Rebase or merge the latest `main` before completion**
   - Use `git fetch origin main && git merge origin/main` (or rebase) near the end of your work.
   - Resolve conflicts and rerun the relevant tests or builds afterwards.

### Codex Workflow Limitations
- Runs triggered by external contributors cannot access repository secrets (e.g., `CODEX_AUTH_JSON_B64`).
- If secrets are unavailable, Codex cannot run. A maintainer with write access should re-run via **Run workflow**, or an authorised user can trigger by commenting `/codex ...` on the issue.
- This workflow uses ChatGPT authentication. `OPENAI_API_KEY` is not required.
- When you work in **Agent Mode**, create a feature branch from the latest `main`, commit each meaningful output, and push regularly so that every automated run has a clean history to diff against.

### Pre-merge Requirements
1. **Complete the necessary quality checks**
   - Code changes: run all tests, linters, and builds that apply to the touched areas.
   - Documentation-only updates: automated checks are optional, but review for correctness and tone.
2. **Bring in the latest `main`**
   - Resolve every conflict before requesting review.
   - After resolving conflicts, rerun the impacted checks.
3. **Conflict resolution expectations**
   - Never leave conflict markers in the tree.
   - Verify runtime behaviour if the merge touched executable code.
4. **UI change expectations**
   - Attach before/after screenshots, covering the relevant screen sizes and states.
   - Call out any manual verification that reviewers should repeat (for example, keyboard navigation or mobile layouts).

### Structured Automation Snapshot
The following JSON mirrors the workflow and quality expectations for tooling that consumes structured metadata.

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
    },
    "ai_driven_development_guidelines": {
      "reference": "docs/governance/development-governance-handbook.md#ai-driven-development-common-standards",
      "highlights": [
        "Keep quality, maintainability, and safety in view regardless of project phase.",
        "Fix root causes instead of suppressing errors and cover failure cases with tests.",
        "Document trade-offs, technical debt, and project context as part of regular workflow.",
        "Continuously improve security, performance, reliability, and dependency hygiene."
      ]
    }
  }
}
```
