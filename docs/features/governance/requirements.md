# Governance & Competency Administration – Requirements

## Document Control

- **Version:** 1.0
- **Status:** Draft
- **Last updated:** 2025-09-26
- **Maintainers:** Governance product owner, Platform engineering lead
- **Source systems:** FastAPI admin routers, Angular settings workspace, competency evaluator service

## Objectives

- Centralize administrative controls for credentials, quotas, and competency frameworks so governance teams can enforce organizational policy without developer intervention.
- Provide auditable, quota-aware competency evaluations that respect daily limits and approval workflows.
- Ensure sensitive configuration (such as API secrets) is encrypted, lifecycle-managed, and surfaced through UI experiences that guide administrators through compliant workflows.

## Scope

- **In scope:** Admin API credential management, quota defaults & overrides, competency library maintenance, manual evaluation triggers, and workspace settings UI flows for labels, statuses, and templates.
- **Out of scope:** Authentication/SSO setup, analytics dashboards beyond evaluation telemetry, and non-administrative workspace customization.

## Personas

- **Governance Administrator:** Configures API integrations, manages quotas, approves evaluations, and maintains competency definitions.
- **People Development Lead:** Curates competency rubrics, criteria, and evaluation templates, and monitors evaluation outcomes.
- **Security Officer:** Audits credential usage, encryption posture, and approval trails for compliance attestation.
- **Team Member:** Receives evaluations and interacts with workspace settings indirectly (via applied templates and quotas).

## User Stories

1. **Credential control:** As a governance administrator, I need to rotate external API credentials so that integrations stay active without exposing plaintext secrets.【F:backend/app/routers/admin_settings.py†L21-L84】
2. **Quota guardrails:** As a governance administrator, I need to adjust default and user-specific quotas so daily evaluations cannot exceed contractual limits.【F:backend/app/routers/admin_settings.py†L86-L139】
3. **Competency curation:** As a people development lead, I need to create, update, and deactivate competencies and criteria to reflect our latest rubric standards.【F:backend/app/routers/competencies.py†L20-L124】
4. **Manual evaluation:** As a governance administrator, I need to trigger an evaluation for a user while respecting daily quota reservations and capturing audit logs.【F:backend/app/routers/competencies.py†L126-L203】
5. **Workspace templating:** As a governance administrator, I need UI controls to manage statuses, labels, and card templates that align with approved governance workflows.【F:frontend/src/app/features/settings/page.ts†L1-L220】【F:frontend/src/app/features/settings/page.html†L1-L228】

## Functional Requirements

### 1. Administrative Settings & Credentials

- Encrypt API secrets with platform-managed ciphers before persistence and store only hints for administrators to confirm rotation events.【F:backend/app/routers/admin_settings.py†L37-L62】
- Support activating/deactivating provider credentials while retaining historical metadata for audits.
- Provide REST endpoints for CRUD operations secured by admin-only dependencies (`require_admin`).【F:backend/app/routers/admin_settings.py†L21-L84】
- Surface UI affordances in the settings workspace for credential lifecycle actions (add, rotate, deactivate), including hint display and last-updated metadata (future enhancement placeholder).

### 2. Quota Management

- Expose endpoints for retrieving and updating global quota defaults and individual overrides, with audit-friendly persistence of the updating administrator.【F:backend/app/routers/admin_settings.py†L86-L139】
- Enforce quota reservations during evaluation triggers using atomic checks that return HTTP 429 when limits are reached.【F:backend/app/routers/competencies.py†L159-L188】
- Provide UI feedback for quota status when administrators schedule evaluations (to be surfaced in future competency admin screens).

### 3. Competency Library

- Allow listing, filtering, and retrieval of competencies by level or activation status for targeted governance reviews.【F:backend/app/routers/competencies.py†L20-L59】
- Support creation and updates of competencies, including ordered criteria with prompts and weights, ensuring the rubric remains versionable.【F:backend/app/routers/competencies.py†L61-L124】
- Persist evaluation jobs with status transitions (`running`, `failed`, `succeeded`) and summary stats to create an auditable trail.【F:backend/app/routers/competencies.py†L189-L203】

### 4. Workspace Configuration UI

- Provide Angular UI flows for managing statuses, labels, and templates with validation, default selections, and removal safeguards that keep templates consistent.【F:frontend/src/app/features/settings/page.ts†L24-L206】【F:frontend/src/app/features/settings/page.html†L1-L228】
- Ensure template configuration captures field visibility, default labels/statuses, and recommendation thresholds so governance policies propagate to generated cards.
- Implement signal-based state management via `WorkspaceStore` to broadcast updates throughout the workspace without page reloads.【F:frontend/src/app/features/settings/page.ts†L6-L152】

### 5. Approval & Evaluation Workflow

- Require admin authentication for all governance actions; non-admin users cannot access admin routers (`require_admin`).
- When triggering evaluations, capture the initiator, period scope, and timestamps, and link job outcomes to downstream analytics for reporting.【F:backend/app/routers/competencies.py†L159-L203】
- Provide mechanisms for approvers to review pending evaluations before release (future UI workflow aligned with job status and approval attributes).

## Non-Functional Requirements

- **Security:** All admin endpoints must validate admin identity, leverage encrypted storage for secrets, and sanitize user input before persistence.
- **Reliability:** Quota updates and evaluation triggers must be transactional; failures should roll back changes and surface actionable errors to administrators.
- **Performance:** Listing competencies and settings should complete within 500 ms for typical datasets (<200 competencies, <100 templates), leveraging filtered queries and eager loading where appropriate.【F:backend/app/routers/competencies.py†L20-L59】
- **Usability:** Settings UI must guide administrators with contextual copy, default values, and guardrails (e.g., preventing template edits without selection) to reduce misconfiguration risk.【F:frontend/src/app/features/settings/page.html†L1-L228】

## Compliance & Governance Considerations

- Maintain audit logs for credential updates, quota overrides, and evaluation jobs, including timestamps, admin identity, and actions taken (extend models as needed).
- Enforce separation of duties by limiting credential rotation and quota approval to designated governance administrators; implement role-based access controls.
- Provide retention policies for evaluation data aligned with organizational privacy requirements (e.g., purge evaluation jobs after defined retention window).
- Ensure competency criteria and evaluation prompts are reviewed for bias and align with regulatory guidance (e.g., EEOC, labor regulations) before publication.
- Support export of competency definitions and evaluation outcomes for compliance reviews and external audits.

## Security, Encryption, and Data Protection

- Secrets must be encrypted using platform-managed ciphers at rest and decrypted only within controlled services; no plaintext exposure in logs or UI.【F:backend/app/routers/admin_settings.py†L37-L62】
- Implement secret rotation policies, including mandatory rotation frequency and optional forced expiration for inactive credentials.
- Use HTTPS/TLS for all transport, with additional HSTS policies enforced by infrastructure (documented outside this scope).
- Store quota and evaluation records with integrity protections and monitor for tampering (e.g., database-level write audit logs).

## Quota & Approval Workflow Expectations

- Default quotas should be defined centrally and inherited by users unless overridden for specific governance-approved scenarios.【F:backend/app/routers/admin_settings.py†L86-L139】
- Approval workflows must ensure over-quota requests generate alerts for manual review before execution.
- Evaluation triggers log approval metadata (`triggered_by`, `triggered_by_user`) and support multi-step approvals in future iterations.【F:backend/app/routers/competencies.py†L173-L199】

## Metrics & Alerts

- Track daily quota consumption vs. limits to identify near-capacity usage; raise alerts at configurable thresholds (e.g., 80% of daily limit).
- Monitor credential rotation frequency, failed decryptions, and deactivated credentials to ensure integrations remain operational.
- Capture evaluation job throughput, success/failure rates, and processing latency for performance governance.【F:backend/app/routers/competencies.py†L189-L203】
- Log administrative actions (creation/deletion of statuses, labels, templates) for change management and notify governance stakeholders of significant configuration changes.【F:frontend/src/app/features/settings/page.ts†L120-L208】
