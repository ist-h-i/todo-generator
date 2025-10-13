**Restated Goal (English)**

- Remove any coding rules from all READMEs (root and subfolders like `frontend`, `backend`).
- Merge those rules into the appropriate existing docs under `docs/` so guidance lives in one place.
- Make READMEs serve as concise, searchable entry points (index/quick links), not rule repositories.

**Assumptions**

- Authoritative targets already exist:
  - `docs/governance/development-governance-handbook.md` (repo-wide/backend/quality gates)
  - `docs/guidelines/angular-coding-guidelines.md` (SPA coding/design/state management)
  - `docs/ui-design-system.md` and `docs/ui-layout-requirements.md` (UI/UX rules)
- “Coding rules” = prescriptive guidance (must/should/do not), naming/linting conventions, architecture/state rules, UI token/layout rules.
- Avoid duplication: prefer consolidating into one doc and linking rather than copying.

**Constraints**

- Minimal diff, smallest viable edits; no new files or broad restructures.
- Preserve non-rule README content (overview, setup, commands).
- Keep links relative and valid; do not break existing anchors.
- 30-minute window; target only READMEs with rule-like content.

**Unknowns**

- Which specific README sections currently contain rules (root and subfolders).
- Whether backend-specific rules need a separate destination beyond the Governance Handbook.
- Any existing team- or module-specific guideline docs outside `docs/`.

**Clarifying questions**

- Should the “Repository Guidelines” Quick Links block be added verbatim to root README (and adapted for sub-READMEs), or tailored per folder context?
- For backend rules, is the Governance Handbook the single source of truth, or is there another backend guideline doc to prefer?
- Placement preference: should the index/Quick Links appear near the top of each README or within an existing “Documentation” section to minimize churn?
- Language preference: keep READMEs in English, or mirror Japanese where present?
- Any additional folders with READMEs (e.g., `infra`, `mobile`) that must be included beyond `frontend`/`backend`?