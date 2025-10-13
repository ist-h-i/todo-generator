Summary
- README contained no coding rules; no moves/merges were needed.
- Added a small “Repository guidelines” block with Quick Links to make README a clearer search/index entry point.

Changes made
- Updated `README.md:148` to add:
  - Quick Links to:
    - `docs/governance/development-governance-handbook.md`
    - `docs/guidelines/angular-coding-guidelines.md`
    - `docs/ui-design-system.md`
    - `docs/ui-layout-requirements.md`
  - Short “How to use these guides” instructions

No other files changed.

Validation
- Link targets exist:
  - `docs/governance/development-governance-handbook.md`
  - `docs/guidelines/angular-coding-guidelines.md`
  - `docs/ui-design-system.md`
  - `docs/ui-layout-requirements.md`
- README contains no prescriptive coding rules (only a link section). Suggested quick checks:
  - `rg -n '\b(coding rules|must|should|never|do not|ルール)\b' README.md`
  - Open `README.md` to verify the new “Repository guidelines” block renders as intended.

Notes
- Scope kept minimal (single-file additive edit).
- Did not alter existing “Documentation & knowledge base” content or ToC to avoid churn.

Open questions
- Do you want this “Repository guidelines” block promoted near the top and added to the ToC? I kept it within the docs section to minimize diff.