# Workflow Logs

Each agent role in the automated development pipeline must export its deliverables as Markdown files inside this directory. Logs form the canonical audit trail for automated execution, so treat them as required artifacts, not optional notes.

## Directory Structure
- Create a subdirectory per role using the kebab-case name (e.g., `translator`, `requirements-analyst`, `coder`).
- Store each output as `YYYYMMDD-HHMM-<task-slug>.md`, where `<task-slug>` briefly identifies the effort.
- Include cross-links to related recipe files and previous workflow logs when relevant.

## Required Sections
While the exact content varies by role, every log should at minimum contain:
1. **Summary** of the role’s decisions and deliverables.
2. **Step-by-step Actions** enumerating what happened, including commands executed or analyses performed.
3. **Evidence & References** pointing to code paths, recipes, policies, and workflow logs consulted.
4. **Recipe Updates** listing every `docs/recipes/*.recipe.md` file touched, with a one-line note about the knowledge captured.
5. **Risks & Follow-ups** that downstream roles must address before the workflow can close.

Logs provide traceability across the workflow. Ensure the log is committed alongside the corresponding code or documentation changes, and cross-link related logs so reviewers can reconstruct context quickly.
