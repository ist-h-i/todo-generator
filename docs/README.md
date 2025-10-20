# Documentation Index

Use this index to locate the specs, playbooks, and references that keep Verbalize Yourself aligned across teams. Entries are grouped so you can jump straight to the material you need.

## Architecture & System Design

- [Architecture overview](architecture.md) — System context, component breakdown, and service responsibilities.
- [Feature data flow reference](data-flow-overview.md) — End-to-end traces of the main product workflows, from UI signals to SQLAlchemy models.
- [Persistence detail design](persistence-detail-design.md) — Schema relationships, startup migration strategy, and storage conventions.
- [System architecture playbook](system-architecture-playbook.md) — Reusable principles, decision workflows, and role expectations that generalise beyond this product.

## Governance & Delivery

- [Development governance handbook](governance/development-governance-handbook.md) - Unified coding standards, workflow agreements, and AI-driven development expectations.
- [Angular coding & design guidelines](guidelines/angular-coding-guidelines.md) - Coding standards, state management, and design-system rules for the SPA.
- [Known issues & workarounds](known-issues.md) — Actively tracked gaps with mitigation ideas for support and QA teams.
- [MCP helper servers](mcp-helper-servers.md) — How to launch the local MCP Git and filesystem helpers used in automation tooling.
- [Security hotspot review](security-review.md) — Findings from the last security sweep with remediation guidance.

## Feature Playbooks

- **Analyzer & status reports**: [AI intake requirements](features/analysis-intake/requirements.md), [Status reporting requirements](features/status-reporting/requirements.md), and [AI intake + status report detail design](features/ai-intake-status-reports/requirements.md).
- **Board operations**: [Board collaboration requirements](features/board/requirements.md) and [Recommendation scoring specs](features/recommendation-scoring/requirements.md).
- **Governance & competencies**: [Governance feature requirements](features/governance/requirements.md) and [Competency evaluations workflow](features/competency-evaluations/requirements.md).
- **Analytics**: [Analytics insights requirements](features/analytics-insights/requirements.md) plus the [analysis intake detail design](features/analysis-intake/detail-design.md) for proposal handling internals.

## UI & Experience Design

- [UI design system](ui-design-system.md) — Tokens, components, and accessibility expectations for shared UI primitives.
- [UI layout requirements](ui-layout-requirements.md) — Responsive layout constraints and navigation heuristics for multi-pane workflows.

## Spec Updates & Implementation Notes

- [HTTP error interceptor requirements](spec-updates/http-error-interceptor.md) — Shared error handling banner and notifier contract for API failures.
- [Notification layer relocation](spec-updates/toast-layer-layout.md) — Placement rules for the global error banner, hover message stack, and analyzer toasts.
- [Gemini migration](spec-updates/gemini-migration.md) — Configuration and rollout plan for the Gemini-powered AI flows.

## Prompts & Automation

- [`prompts/`](../prompts) — Prompt references for AI interactions used by backend services and content moderation flows.
- [`scripts/`](../scripts) — Operational scripts, including the Codex automation pipeline and helper launchers for MCP servers.
- Code recipes are co-located next to their source files as `*.recipe.md` (for Angular classes, `ClassName.recipe.md` in the same directory). See files adjacent to the code they document.

## Contribution Tips

- Sync with `README.md` for setup instructions spanning both Angular and FastAPI stacks.
- When introducing or modifying features, update the relevant requirements and detail design documents listed above to keep this index accurate.
- Capture architecture or workflow changes in the playbooks so the next contributor inherits the latest rationale.
- See the [Repository Index & Map](INDEX.md) for a quick tour of code layout and entry points.
