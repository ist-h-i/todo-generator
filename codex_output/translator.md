**Restated Goal**
- Remove all coding rules from READMEs (root and subfolders like `frontend`, `backend`).
- Merge/move those rules into the appropriate existing docs under `docs/`.
- Make each README an index-style, searchable entry point with concise links to authoritative docs.

**In-Scope Changes**
- Root `README.md`: ensure it contains only project overview/index content (no rules).
- `frontend/README.md`, `backend/README.md`: remove any prescriptive rules; add a “Quick Links”/index section pointing to `docs/` guidance.
- Move Angular-specific rules into `docs/guidelines/angular-coding-guidelines.md`.
- If backend rules exist, merge into `docs/governance/development-governance-handbook.md` (or other existing backend guideline doc if present).

**Out of Scope**
- Creating new guideline documents unless absolutely necessary.
- Broad restructuring of documentation beyond minimal changes to meet the goal.

**Assumptions**
- Authoritative targets exist and should be reused:
  - `docs/governance/development-governance-handbook.md`
  - `docs/guidelines/angular-coding-guidelines.md`
  - `docs/ui-design-system.md`
  - `docs/ui-layout-requirements.md`
- “Coding rules” = prescriptive standards (must/should/do not), naming/linting/architecture/state/UI token/layout guidance.

**Constraints**
- Minimal diffs; avoid unnecessary edits or duplication.
- Preserve non-rule README content (overview, setup, commands).
- Keep links relative and valid from both root and subfolders.
- Deliver a complete, self-contained outcome within the timebox.

**Acceptance Criteria**
- No rule-like language remains in any README (root, frontend, backend).
- Subfolder READMEs include concise Quick Links to the four docs above.
- Angular rules consolidated under `docs/guidelines/angular-coding-guidelines.md`; backend rules under governance doc.
- All links resolve correctly from root and subfolders.
- Tone and structure remain consistent with existing docs.

**Unknowns**
- Which specific READMEs (besides `frontend`/`backend`) contain rules and need edits.
- Whether a separate backend-specific guideline doc (besides the Governance Handbook) exists and should receive backend rules.

**Clarifying Questions**
- Beyond `frontend` and `backend`, are there other folders with READMEs to include (e.g., `infra`, `mobile`)?
- Should the Quick Links block be identical across READMEs or lightly tailored per folder context?
- Confirm backend rules should land in the Governance Handbook; is there any alternate backend guideline doc to prefer?
- Language preference: keep edits English-only, or mirror any existing Japanese sections?