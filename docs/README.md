# Documentation Index

Use this index to locate the specs, playbooks, and references that keep Verbalize Yourself aligned across teams. Entries are grouped by the questions they answer so you can jump straight to the material you need.

## Architecture & Data Flow
- [Architecture overview](architecture.md) – System context, component breakdown, and service responsibilities.
- [Feature data flow reference](data-flow-overview.md) – End-to-end traces of the main product workflows, from UI signals to SQLAlchemy models.
- [Persistence detail design](persistence-detail-design.md) – Schema relationships, startup migration strategy, and storage conventions.

## Delivery Workflow
- [Development rules](development-rules.md) – Working agreements, checklists, and automation expectations for day-to-day development.
- [Known issues](known-issues.md) – Current gaps and regressions to factor into planning and QA sessions.
- [MCP helper servers](mcp-helper-servers.md) – How to launch the local MCP Git and filesystem helpers used in automation tooling.

## Feature Playbooks
- **Analyzer & status reports**: [AI intake requirements](features/analysis-intake/requirements.md), [Status reporting requirements](features/status-reporting/requirements.md), and [AI intake + status report detail design](features/ai-intake-status-reports/requirements.md).
- **Board operations**: [Board collaboration requirements](features/board/requirements.md) and [Recommendation scoring specs](features/recommendation-scoring/requirements.md).
- **Governance & competencies**: [Governance feature requirements](features/governance/requirements.md) and [Competency evaluations workflow](features/competency-evaluations/requirements.md).
- **Analytics**: [Analytics insights requirements](features/analytics-insights/requirements.md) plus the [analysis intake detail design](features/analysis-intake/detail-design.md) for proposal handling internals.

## Prompts & Automation
- [`prompts/`](../prompts) – Prompt references for AI interactions used by backend services and content moderation flows.
- [`scripts/`](../scripts) – Operational scripts, including the Codex automation pipeline and helper launchers for MCP servers.

## Contributing Tips
- Sync with `README.md` for setup instructions spanning both Angular and FastAPI stacks.
- When introducing or modifying features, update the relevant requirements and detail design documents listed above to keep this index accurate.
