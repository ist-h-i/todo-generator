# Agent Operating Guide

## Purpose & Scope

- Provide orientation for automated and human-assisted agent roles operating in the Verbalize Yourself repository.
- Enforce consistency with architecture, governance, documentation, and workflow expectations before any plan, code, review, or integration task begins.

## Must-Know References

- `README.md` - Product overview, architecture summary, local setup, and quality automation commands.
- `docs/README.md` - Documentation index; use it with `docs/INDEX.md` to locate architecture notes, feature specs, and governance guidance.
- `docs/governance/development-governance-handbook.md` - Source of truth for repository structure, coding standards, CI requirements, and AI expectations.
- `docs/guidelines/angular-coding-guidelines.md` - Angular SPA conventions, state management patterns, and UI requirements.
- `docs/ui-design-system.md` / `docs/ui-layout-requirements.md` - Design tokens, accessibility rules, layout heuristics; mandatory for UI-facing work.
- `.codex/policies/ai_dev_guidelines.md` - Execution scope limits, validation discipline, and output constraints for every agent role.
- `docs/architecture.md`, `docs/data-flow-overview.md`, `docs/known-issues.md` - System boundaries, request lifecycles, and active risks to consider while planning or reviewing.
- `docs/mcp-helper-servers.md` & `docs/auto-evolve/operations.md` - Automation and MCP helper instructions for Codex pipelines.
- `prompts/*.prompt.md` - Role-specific expectations; consult the file that matches your assigned role for deliverable formats and guardrails.

## Repository Snapshot

- **Frontend**: Angular 20 standalone components, signal-based stores, Tailwind-inspired design tokens; lint via `npm run lint`, build with `npm run build`, tests via `npm test -- --watch=false`.
- **Backend**: FastAPI + SQLAlchemy services with layered routers and schemas; validate using `pytest backend/tests`, `ruff check backend`, and `black --check backend/app backend/tests`.
- **Database**: SQLite by default; Neon Postgres via `DATABASE_URL` for shared environments.
- **AI Integration**: Google Gemini (see `docs/spec-updates/gemini-migration.md`) with strict JSON schema enforcement.
- **Documentation**: Markdown knowledge base under `docs/`; co-located `*.recipe.md` files accompany source modules; repository workflow logs live in `workflow/`.
- **Automation**: `scripts/` contains Codex helpers; use `start-mcp-servers.*` when interacting with MCP helper servers.

## Multi-Agent Workflow

### Role Sequence

1. **Planner** - Decomposes requirements, issues the ordered checklist in `workflow/checklists/`, and produces the planning log.
2. **Coder** - Executes checklist items in order, edits code/docs, updates recipes, and records an implementation log.
3. **Reviewers** - Role-specific reviewers (code quality, security, AI safety, UI/UX, performance, etc.) audit the change in the prescribed order, each producing a workflow log.
4. **DocWriter / DocEditor** - Refreshes documentation and recipes, ensuring navigation links and indexes stay accurate.
5. **Integrator** - Rebases/merges, verifies required checks, confirms recipe updates, and documents results.
6. **Release Manager / QA Automation Planner (as needed)** - Perform release notes, rollout, or regression automation planning.
   - Limit the workflow to at most three implementation->review cycles unless governance docs explicitly allow more.

### Logs & Checklists

- Every role writes Markdown logs under `workflow/<role>/YYYYMMDD-HHMM-<task-slug>.md` with the required sections (Summary, Step-by-step Actions, Evidence & References, Recipe Updates, Risks & Follow-ups) and cross-links to related logs.
- Planner-generated checklists are authoritative; downstream roles must mark blockers in their logs before deviating. Update checklists only through the Planner or by logging an explicit exception.
- Link logs to co-located recipes and relevant documentation sections to preserve traceability.

### Recipe Obligations

- Treat `*.recipe.md` files next to source files as canonical references; update them whenever behaviour, variables, integration points, or tests change.
- For Angular classes, maintain `ClassName.recipe.md` alongside the TypeScript file. Use generators in `scripts/` if a recipe is missing.
- Record recipe paths touched inside workflow logs so reviewers and future agents can audit coverage quickly.

## Execution Guardrails

- Work only within the scoped files and directories needed for the task; do not refactor or run pipelines beyond what the checklist or governance docs require.
- Capture assumptions, open questions, and policy conflicts in your workflow log before proceeding.
- Follow the validation matrix below and document any skipped command in your log with the rationale provided by the governance guidelines.

| Task type | Minimum validation | Default skips |
| --- | --- | --- |
| Backend code | `pytest backend/tests`, `ruff check backend`, `black --check backend/app backend/tests` | Frontend builds unless cross-cutting |
| Frontend code / UI | `npm run lint`, `npm run format:check`, `npm test -- --watch=false` (or targeted specs), consider `npm run build` for risky changes | Backend tests unless APIs changed |
| Shared config / CI | Lint or syntax checks relevant to the file (e.g., `act`, `yamllint`) | Full test suites unless configuration affects runtime |
| Documentation / Markdown | Markdown lint if available; manual link review | All code builds/tests (unless doc change reflects code that must be validated) |
| Translation / Annotation | Formatting diffs only | Tests, builds, dependency installs |

- Honour `.codex/policies/ai_dev_guidelines.md`: document skipped work, minimize redundant commands, and never expand scope without Planner approval.
- Avoid modifying generated artefacts or secrets; never commit `.venv`, `node_modules`, or local databases.

## Tooling & Commands

- Use `start-localhost.bat` for one-click Windows setup; for macOS/Linux follow the manual steps in `README.md`.
- Backend dependency extras live in `backend/requirements*.txt`; the frontend relies on `frontend/package.json`.
- Run `scripts/run_tests_with_coverage.sh` before invoking SonarQube (`sonar-scanner`) when coverage is required.
- Prefer `rg` for code search, `pytest -k "<pattern>"` for targeted backend tests, and `npm test -- --watch=false --runTestsByPath <spec>` for focused Angular checks.

## Automation & MCP Helpers

- `docs/mcp-helper-servers.md` documents how to launch MCP Git and filesystem helpers that support Codex automation and recipe generation.
- `docs/auto-evolve/operations.md` outlines how to trigger and monitor the auto-evolve pipeline; review it before running automation outside routine workflows.
- Update `codex_output/` artefacts only through automated runs unless governance rules instruct otherwise.

## Documentation Hygiene & Cross-Linking

- When adding or moving documentation, update `docs/README.md`, `docs/INDEX.md`, and any feature-specific tables of contents.
- Reflect architecture or workflow changes in `docs/architecture.md`, `docs/data-flow-overview.md`, or the relevant spec under `docs/spec-updates/`.
- Note intentional deviations and cross-link decisions in both the updated document and the associated workflow logs.

## Raising Questions & Exceptions

- If requirements are unclear or blockers surface, document them in the current workflow log and notify the Planner or requesting party before continuing.
- Treat known issues from `docs/known-issues.md` and security considerations from `docs/security-review.md` as mandatory checkpoints for reviewers and integrators.
- Escalate risky changes or policy conflicts early to avoid rework and ensure audit trails stay accurate.
