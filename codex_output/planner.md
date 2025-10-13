Summary
- Current READMEs already act as index/entry points; no prescriptive coding rules found in root, frontend, or backend.
- Angular-specific rules live under docs/guidelines/angular-coding-guidelines.md and include the previously cited items (RxResource, Signal Store, union types, DomSanitizer, LoggerService).
- Frontend and backend READMEs include the Quick Links block pointing to governance, Angular guidelines, and UI docs, with correct relative paths.

Why a minimal route
- No additional edits appear necessary; the task reduces to verification.
- A single code_quality_reviewer pass can validate the absence of rule-like language and link integrity within the 30-minute window.

Risks/open points
- Minor formatting nit in the root README environment table may exist but is non-blocking and out of scope for this change.
- If other non-specified subfolders later add READMEs, they should follow the same index-only pattern.

```json
{"steps":["code_quality_reviewer"],"notes":"Repository already meets the goal: READMEs are index-only; Angular rules consolidated under docs/guidelines. Run a lightweight verification to confirm no prescriptive rules remain and links resolve from subfolders.","tests":"1) Ensure no rule-like language in target READMEs: rg -n \"\\b(must|should|never|do not|guideline|ルール)\\b\" README.md frontend/README.md backend/README.md\n2) Verify Quick Links presence in subfolder READMEs: rg -n \"Repository guidelines|Development Governance Handbook\" frontend/README.md backend/README.md\n3) Check link targets exist: test -f docs/governance/development-governance-handbook.md && test -f docs/guidelines/angular-coding-guidelines.md && test -f docs/ui-design-system.md && test -f docs/ui-layout-requirements.md\n4) Confirm Angular doc contains merged topics: rg -n \"RxResource|Signal Store|union types|DomSanitizer|LoggerService\" docs/guidelines/angular-coding-guidelines.md\n5) Spot-check that other READMEs don’t accidentally contain rules: rg -n \"\\b(must|should|never|do not|guideline|ルール)\\b\" workflow/README.md docs/README.md docs/recipes/README.md"}```