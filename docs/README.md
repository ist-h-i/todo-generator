# Documentation Index

Welcome to the Verbalize Yourself knowledge base. Use this index to navigate architecture references, feature playbooks, and operations guidance that keep the product aligned across teams.

## Start Here

- [Repository Index & Map](INDEX.md): Quick tour of source directories, entry points, and supporting tools.
- [Development Governance Handbook](governance/development-governance-handbook.md): Source of truth for repository structure, quality gates, and AI-assisted delivery expectations.
- [Angular Coding & Design Guidelines](guidelines/angular-coding-guidelines.md): Standards for the SPA, including state management, patterns, and shared component design.
- [Test case checklist](testing/test-cases-checklist.md): Inventory of missing Playwright (E2E) and Angular unit test cases, formatted as checklists.
- [UI Design System](ui-design-system.md): Tokens, components, and accessibility rules for consistent UI primitives.
- [UI Layout Requirements](ui-layout-requirements.md): Responsive layout grids, navigation heuristics, and multi-pane workflow guidance.

## How to Use These Guides

- Start with the governance handbook when planning changes that affect architecture, quality workflows, or delivery guardrails.
- Apply the Angular guidelines whenever you touch the SPA so state, styling, and data flow stay consistent.
- Keep design documents and workflow specs in sync with component or tooling updates, documenting intentional deviations for the next contributor.
- Cross-check the Repository Index whenever you need a refresher on file locations or new entry points.

## Architecture & Platform

- [Architecture overview](architecture.md): System context, service boundaries, and operational posture.
- [Feature data flow reference](data-flow-overview.md): End-to-end traces for primary workflows from UI signals to persistence.
- [Persistence detail design](persistence-detail-design.md): Storage conventions, migration strategy, and schema relationships.
- [Database schema commands](db-schema-commands.md): Reference for managing migrations and schema tooling.
- [Security hotspot review](security-review.md): Findings from the latest security audit with mitigation guidance.
- [Metrics schema](metrics/schema.md): Definitions for telemetry points consumed by observability dashboards.

## Feature Playbooks

- **Analyzer & status reports**: [AI intake requirements](features/analysis-intake/requirements.md) and [Status reporting detail design](features/status-reporting/detail-design.md).
- **Board operations**: [Board collaboration requirements](features/board/requirements.md) and [Recommendation scoring specs](features/recommendation-scoring/requirements.md).
- **Authentication & user management**: [ユーザー登録・ユーザー種別・管理者ユーザー管理 要件定義](features/user-management/requirements.md).
- **Governance & competencies**: [Governance feature requirements](features/governance/requirements.md) and [Competency evaluations workflow](features/competency-evaluations/requirements.md).
- **Analytics**: [Analytics insights requirements](features/analytics-insights/requirements.md) and [Analysis intake detail design](features/analysis-intake/detail-design.md).
- **Immunity map**: [Immunity map requirements](features/immunity-map/requirements.md) and [Immunity map detail design](features/immunity-map/detail-design.md).
- **Appeals**: [Appeal generation requirements](features/appeal-generation/requirements.md) and [Appeal detail design](features/appeal-generation/detail-design.md).
- **Achievement output（実績出力）**: [Achievement output requirements](features/achievement-output/requirements.md) and [Achievement output detail design](features/achievement-output/detail-design.md).

## UI & Experience Design

- [UI design system](ui-design-system.md): Token definitions, component catalog, and accessibility expectations.
- [UI layout requirements](ui-layout-requirements.md): Layout constraints, responsive rules, and navigation heuristics for complex flows.

## Spec Updates & Operational Notes

- [Known issues & workarounds](known-issues.md): Active gaps with mitigation ideas for QA, support, and incident response.
- [HTTP error interceptor requirements](spec-updates/http-error-interceptor.md): Shared error handling banner contract for API failures.
- [Notification layer relocation](spec-updates/toast-layer-layout.md): Placement rules for the global error banner and toast stack.
- [Gemini migration](spec-updates/gemini-migration.md): Configuration and rollout plan for Gemini-powered AI flows.
- [Gemini backend upgrade plan](spec-updates/gemini-backend-upgrade.md): Inventory and migration plan to remove heuristic/fallback logic and standardize on live Gemini API requests.

## Prompts, Automation, and MCP Tooling

- [`prompts/`](../prompts): Prompt definitions for AI interactions used across backend services and operational flows.
- [`scripts/`](../scripts): Automation scripts, including Codex pipelines and helper launchers for MCP servers.
- [MCP helper servers](mcp-helper-servers.md): Instructions for running the MCP helper suite (filesystem, memory, fetch, puppeteer, sequential thinking, time, serena, and optional adapters).
- [Auto-evolve operations](auto-evolve/operations.md): Guardrails and workflows for the auto-evolve automation loop.

## Recipes & Reusable Patterns

- [Recipes overview](recipes/README.md): Index of `*.recipe.md` files co-located with their source modules for ready-to-copy implementation snippets.

## Analysis & Research

- [Immune map](analysis/immune-map.md): Research notes that inform anomaly detection and analyst workflows.

## Keeping Documentation Fresh

- Update requirements, design notes, and specs alongside feature or workflow changes so contributors inherit accurate context.
- Record architecture and decision outcomes in spec updates or project issues when deviating from the established guidance.
- Link new documents from this index (and the Repository Index) so navigation stays comprehensive.
