**Restated Goal (English)**

- Move any coding rules currently in `README` into the appropriate existing guidelines documents, merging them without duplication.
- Update `README` so it no longer contains coding rules and instead serves as a concise, searchable entry point (an index to key project docs).

**Assumptions**

- Existing guidelines already live under `docs/`, notably:
  - `docs/governance/development-governance-handbook.md` (repo structure, backend, quality gates)
  - `docs/guidelines/angular-coding-guidelines.md` (SPA coding + design)
  - `docs/ui-design-system.md`, `docs/ui-layout-requirements.md`
- The `README` currently includes some “coding rules” content that overlaps with those docs.
- The desired `README` should highlight key links (i.e., act as a search/index hub) and keep non-guideline essentials (project overview, setup, contribution entry points).

**Constraints**

- Minimal, tightly scoped edits; smallest diff possible.
- Fit within a short execution window; avoid broad refactors.
- Do not introduce new guideline files if existing targets are appropriate.
- Preserve existing document structure and style.

**Unknowns**

- Exact sections in `README` that are considered “coding rules”.
- Degree of overlap or conflict between `README` rules and `docs/guidelines/angular-coding-guidelines.md` or other docs.
- Whether there are non-Angular (language-agnostic or backend) rules in `README` that should go into the Governance Handbook vs. Angular guidelines.
- Any mandated `README` sections or formatting conventions for this repo.

**Proposed Minimal Outcome**

- Remove coding-rule sections from `README`.
- Merge that content into:
  - Angular-specific items → `docs/guidelines/angular-coding-guidelines.md`
  - Repo-wide or backend/quality items → `docs/governance/development-governance-handbook.md`
- Update `README` to a lean index: short project description + Quick Links to the above documents (and any existing essential links).

**Definition of Done**

- `README` contains no coding rules; acts as an index with clear links.
- Coding rules from `README` are integrated into the appropriate existing documents without duplication.
- Links work and headings remain coherent.
- No unrelated files changed.

**Risks**

- Unintended duplication or contradictions if similar guidance already exists.
- Misclassification of rules (e.g., moving backend items into Angular guidelines).
- Breaking anchors or internal links if headings are altered during merge.

**Clarifying Questions**

- Please confirm which `README` sections should be treated as “coding rules”.
- If a rule spans both Angular and general practices, should it be duplicated in both places or centralized in Governance and referenced from Angular?
- Any required `README` template or mandatory sections we must keep (badges, install steps, contribution guide link)?