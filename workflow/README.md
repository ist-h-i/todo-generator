# Workflow Logs

Each agent role in the automated development pipeline must export its deliverables as Markdown files inside this directory.

## Directory Structure
- Create a subdirectory per role using the kebab-case name (e.g., `translator`, `requirements-analyst`, `coder`).
- Store each output as `YYYYMMDD-HHMM-<task-slug>.md`, where `<task-slug>` briefly identifies the effort.
- Include cross-links to related recipe files and previous workflow logs when relevant.

## Required Sections
While the exact content varies by role, every log should at minimum contain:
1. **Summary** of the role’s decisions and deliverables.
2. **Evidence & References** pointing to code paths, recipes, or policies consulted.
3. **Risks & Follow-ups** that downstream roles must address.

Logs provide traceability across the workflow. Ensure the log is committed alongside the corresponding code or documentation changes.
