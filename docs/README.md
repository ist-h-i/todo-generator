# Documentation Index

Use this index to locate the specs, playbooks, and references that keep Verbalize Yourself aligned. Entries are grouped by theme so you can jump straight to the material you need.

## Architecture & System Design

- [Architecture overview](architecture.md) — System context, component breakdown, guiding principles, and operational posture.
- [Feature data flow reference](data-flow-overview.md) — End-to-end traces of the main product workflows from UI signals to SQLAlchemy models.
- [Persistence detail design](persistence-detail-design.md) — Schema relationships, startup migration strategy, and storage conventions.

## Governance & Delivery

- [Development governance handbook](governance/development-governance-handbook.md) — Coding standards, workflow agreements, and AI-driven development expectations.
- [Angular coding & design guidelines](guidelines/angular-coding-guidelines.md) — SPA rules covering state management, patterns, and design-system usage.
- [Known issues & workarounds](known-issues.md) — Active gaps with mitigation ideas for support and QA teams.
- [MCP helper servers](mcp-helper-servers.md) — How to launch local MCP Git and filesystem helpers used in automation tooling.
- [Security hotspot review](security-review.md) — Findings from the last security sweep with remediation guidance.

## Feature Playbooks

- **Analyzer & status reports**: [AI intake & report requirements](features/analysis-intake/requirements.md) and [Status reporting detail design](features/status-reporting/detail-design.md).
- **Board operations**: [Board collaboration requirements](features/board/requirements.md) and [Recommendation scoring specs](features/recommendation-scoring/requirements.md).
- **Governance & competencies**: [Governance feature requirements](features/governance/requirements.md) and [Competency evaluations workflow](features/competency-evaluations/requirements.md).
- **Analytics**: [Analytics insights requirements](features/analytics-insights/requirements.md) and [Analysis intake detail design](features/analysis-intake/detail-design.md).
- **Appeals**: [Appeal generation requirements](features/appeal-generation/requirements.md) and [detail design](features/appeal-generation/detail-design.md).

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
- Code recipes are co-located next to their source files as `*.recipe.md` (for Angular classes, `ClassName.recipe.md` in the same directory).

## Contribution Tips

- Update the relevant requirements or playbooks whenever you ship a feature or adjust its workflow.
- Record architecture or workflow decisions in spec updates or issues so the next contributor inherits the rationale.
- Use the [Repository Index & Map](INDEX.md) when you need a quick tour of code layout and entry points.
