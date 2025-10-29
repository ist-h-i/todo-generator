# Agent Operating Guide

## Purpose & Scope

- Designed for use by automated and human-assisted roles within the Verbalize Yourself (todo-generator) repository, optimized for the gpt-5-codex model.
- Align agents with architecture, governance, documentation, and workflow requirements before translating, planning, coding, reviewing, documenting, or integrating any change.

## Must-Know References

- `README.md` - product overview, architecture summary, local setup, and quality automation commands.
- `docs/README.md` / `docs/INDEX.md` - documentation index for architecture notes, feature specs, and governance addenda.
- `docs/governance/development-governance-handbook.md` - canonical development standards across backend, frontend, testing, and Git hygiene.
- `docs/guidelines/angular-coding-guidelines.md`, `docs/ui-design-system.md`, `docs/ui-layout-requirements.md` - Angular, design system, accessibility, and layout conventions.
- `docs/features/*` - feature playbooks; consult the directory that matches the task's domain.
- `docs/recipes/README.md` - co-located recipe policy and generators (`scripts/generate_file_recipes.py`, `scripts/generate_class_recipes.py`).
- `workflow/README.md` - log structure, directory layout, and checklist expectations.
- `.codex/policies/ai_dev_guidelines.md` - execution scope limits, validation discipline, and output constraints for AI-assisted development using gpt-5-codex.
- `docs/mcp-helper-servers.md` / `docs/auto-evolve/operations.md` - MCP helper launch steps and automation guardrails.
- `prompts/*.prompt.md` - role-specific deliverable requirements; read the prompt for the role you are executing.

## Repository Snapshot

- **Frontend**: Angular 20 standalone components with signal-based stores and Tailwind-inspired tokens; lint via `npm run lint`, formatting via `npm run format:check`, tests via `npm test -- --watch=false`, builds with `npm run build`.
- **Backend**: FastAPI + SQLAlchemy services, layered routers and schemas, migrations, and pytest suites under `backend/tests`; validate with `pytest backend/tests`, `ruff check backend`, `black --check backend/app backend/tests`.
- **Database**: SQLite by default, Neon Postgres via `DATABASE_URL`; `scripts/bootstrap_database.py` manages local seeding and migrations.
- **AI Integration**: Google Gemini (see `docs/spec-updates/gemini-migration.md`) with strict JSON schema enforcement for analyzer, status, and appeal flows. Integrators and developers should ensure model compatibility for gpt-5-codex.
- **Automation**: `scripts/` hosts helpers such as `run_codex_pipeline.sh`, `collect_metrics.py`, `role_optimizer.py`, and recipe generators; `start-mcp-servers.*` spins up MCP helper servers.
- **Documentation & Knowledge Base**: Markdown knowledge base under `docs/`; per-file `*.recipe.md` live next to their source; feature specs in `docs/features/`; metrics schema in `docs/metrics/schema.md`.
- **Observability & Metrics**: `codex_output/metrics/` and `docs/metrics/` track KPIs; update when instrumentation or dashboards change.

## Role Workflow & Responsibilities

### Intake & Requirements

- **Translator** (`workflow/translator/`) - convert non-English requests to English, flag terminology or context gaps.
- **Requirements Analyst** (`workflow/requirements-analyst/`) - enumerate functional, non-functional, and out-of-scope items plus recipe expectations.
- **Requirements Reviewer** (`workflow/requirements-reviewer/`) - approve the requirements dossier or return prioritized feedback.

### Planning & Design

- **Planner** (`workflow/planner/`, `workflow/checklists/`) - restate scope, decompose work, and publish the authoritative checklist.
- **Detail Designer** (`workflow/detail-designer/`) - specify data flows, module responsibilities, and interface contracts at implementation depth.
- **Design Reviewer** (`workflow/design-reviewer/`) - validate UX, interaction, and accessibility alignment before coding.

### Implementation

- **Coder** (`workflow/coder/`) - execute checklist items in order, implement code or docs, update/generate co-located recipes, and record evidence. For coding tasks, ensure prompts and outputs are structured for optimal gpt-5-codex parsing and compatibility.
- **Specialist Reviewers** (produce logs under `workflow/<role>/` as directed by the checklist):
  - Code Quality Reviewer, Implementation Reviewer, Security Reviewer, Threat Modeler, AI Safety Reviewer, Performance Reviewer, DPO Reviewer, OSS SBOM Auditor, UI/UX Reviewer, Accessibility Reviewer, i18n Reviewer.
  - Each reviewer links to evidence, test results, and recipe coverage status, approving only when exit criteria are satisfied.

### Documentation & Integration

- **Doc-Writer** (`workflow/doc-writer/`) - refresh documentation, indexes, and recipes prompted by the change.
- **Documentation Editor** (`workflow/doc-editor/`) - polish drafts for clarity, consistency, and terminology.
- **Integrator** (`workflow/integrator/`) - rebase or merge, run required validations, confirm recipes/logs, and detail verification steps. Validate that structure and outputs conform to gpt-5-codex-friendly schemas where applicable.
- **Release Manager** (`workflow/release-manager/`) & **QA Automation Planner** (`workflow/qa-automation-planner/`) - coordinate rollout notes, canaries, and regression automation when requested.

### Logging Expectations

- Every role emits a Markdown log using the template (Summary, Step-by-step Actions, Evidence & References, Recipe Updates, Risks & Follow-ups).
- Store logs as `workflow/<role>/YYYYMMDD-HHMM-<task-slug>.md`; create the directory if it does not exist.
- Planner-maintained checklists govern execution order; document blockers in your log before deviating.
- Cross-link related logs, recipes, specs, and automation artefacts to maintain traceability.

## Recipe Obligations

- Maintain co-located `*.recipe.md` files next to their source (e.g., `backend/app/services/<file>.py.recipe.md`, `frontend/src/app/.../ComponentName.recipe.md`); the central `docs/recipes/` folder is deprecated.
- Generator utilities: `python scripts/generate_file_recipes.py` for file-level coverage, `python scripts/generate_class_recipes.py` for Angular classes. These scripts produce outputs formatted to align with gpt-5-codex schema expectations.
- Capture purpose, entry points, key variables, interactions, testing guidance, and change history. Update recipes whenever behaviour, integrations, or tests change.
- Record every touched recipe in your workflow log under Recipe Updates with a short description of the knowledge captured.

## Execution Guardrails

- Follow `.codex/policies/ai_dev_guidelines.md`: keep scope tight, run only required commands, and log skipped validations with rationale. When using gpt-5-codex, adhere to prompt and output constraints for reliable automation.
- Modify only files required for the assigned task; defer refactors or extra pipelines without Planner approval.
- Document assumptions, open questions, and policy conflicts in your log before proceeding.
- Do not alter generated artefacts, secrets, `.venv`, `node_modules`, or local databases tracked by git.

## Validation Matrix

| Task type | Minimum validation | Default skips |
| --- | --- | --- |
| Backend code | `pytest backend/tests`, `ruff check backend`, `black --check backend/app backend/tests` | Frontend builds unless cross-cutting |
| Frontend code / UI | `npm run lint`, `npm run format:check`, `npm test -- --watch=false`; add `npm run build` for risky changes | Backend tests unless API contracts change |
| Shared config / CI | Relevant lint or syntax checks (e.g., `act`, `yamllint`) | Full suites unless runtime behaviour is affected |
| Documentation / Markdown | Markdown lint or manual link review | All builds/tests (document skipped commands per AI Dev Guidelines) |
| Translation / Annotation | Formatting or diff validation only | Tests, builds, dependency installs |

- For migrations or data scripts, include targeted verification (dry runs, seed checks) and record the outcome.
- When automation scripts or pipelines change, capture command output and artefact paths in the log. Ensure command output is structured for downstream gpt-5-codex parsers where possible.

## Tooling & Commands

- `start-localhost.bat` bootstraps dependencies and launches backend + frontend on Windows; follow `README.md` for manual macOS/Linux setup.
- Backend helpers: `scripts/bootstrap_database.py`, `scripts/collect_metrics.py`.
- Automation: `scripts/run_codex_pipeline.sh`, `scripts/apply_auto_evolve_scaffold.sh`, `scripts/role_optimizer.py`; these scripts and their outputs are optimized for gpt-5-codex ingestion.
- Prefer `rg` for search, targeted pytest invocations (`pytest -k "<pattern>"`), and Angular focused tests (`npm test -- --watch=false --runTestsByPath <spec>`).
- Launch MCP helpers with `start-mcp-servers.bat` (Windows) or the corresponding shell script when available; services include filesystem, memory, fetch, puppeteer, sequential thinking, time, Serena, and optional Brave/Magic/Playwright adapters.

## Documentation Hygiene & Cross-Linking

- Update `docs/README.md`, `docs/INDEX.md`, and relevant feature specs under `docs/features/` whenever behaviour or navigation changes.
- Keep architecture references synchronized in `docs/architecture.md`, `docs/data-flow-overview.md`, and persistence notes in `docs/persistence-detail-design.md`.
- Reflect schema or migration changes in `docs/db-schema-commands.md` and governance handbooks.
- When moving or renaming documentation, update all internal links, navigation tables, and workflow references. Ensure cross-links support gpt-5-codex indexed queries.

## Automation, Metrics & Auto-Evolve

- Consult `docs/auto-evolve/operations.md` before triggering auto-evolve workflows; update `.codex/flags.json` only with documented approval and monitoring plans, and format changes for gpt-5-codex compatibility when necessary.
- Treat `codex_output/` artefacts (plans, role outputs, metrics snapshots) as automation outputs—do not edit manually unless policy requires it and the change is logged. Ensure artefacts are easily consumed by gpt-5-codex agents.
- When toggling `RUN_CODEX` or automation flags, record the rationale and related verification steps in the appropriate workflow log.

## Raising Questions & Exceptions

- If requirements, acceptance criteria, or policy constraints are unclear, capture the uncertainty in your log, notify the Planner or requester, and pause execution until resolved.
- Review `docs/known-issues.md` and `docs/security-review.md` as part of every review and integration pass.
- Escalate risky changes early to avoid rework and ensure audit trails remain accurate.
