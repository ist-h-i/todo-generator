Plan summary

- Scope is limited to READMEs: root, frontend, backend.
- Root README already contains an index-style “Repository guidelines” block and no coding rules; no changes needed there.
- frontend/README.md contains a large “Coding Guidelines” section; move its unique Angular guidance into docs/guidelines/angular-coding-guidelines.md, then remove the section and add a concise Quick Links block.
- backend/README.md contains no prescriptive rules; add a minimal Quick Links block so it also works as a search/index entry point.

Minimal actions

- Merge unique Angular guidance from frontend’s “Coding Guidelines” into the existing Angular guidelines doc without duplicating existing bullets:
  - Data fetching via Resource API (RxResource).
  - Prefer Angular Signal Store for global state; reserve NgRx for existing/exceptional cases.
  - Union types for resource states.
  - Naming conventions (camelCase, PascalCase, UPPER_SNAKE_CASE; suffix patterns; kebab-case filenames).
  - Avoid manual subscribe; integrate signals and takeUntilDestroyed.
  - Error handling patterns (surface via Resource states or try/catch and LoggerService).
  - Import order (Angular → third-party → application) and absolute aliases.
  - Brief security note (sanitize innerHTML, centralize via HttpInterceptor, CSRF).
- Do not copy governance items from frontend README (Conventional Commits, CI/CD) since handbook already covers them; avoids duplication.
- Replace frontend “Coding Guidelines” section with a Quick Links block pointing to ../docs/… targets.
- Add the same Quick Links block to backend/README.md using ../docs/… relative links.

Risks and mitigations

- Duplication in Angular guidelines: integrate as short bullets into existing sections; avoid repeating content already covered.
- Broken relative links from subfolders: ensure links use ../docs/... in frontend and backend.
- Tone/consistency: keep wording aligned with existing guideline style; avoid expanding scope.

Selected stages

- coder: implement doc moves and small README edits.
- code_quality_reviewer: verify links, duplication, and that READMEs contain no prescriptive rules.

Validation

- Verify no prescriptive rules remain in READMEs:
  - grep for rule-like keywords in README.md, frontend/README.md, backend/README.md.
- Link checks:
  - Confirm Quick Links resolve from subfolders: ../docs/governance/development-governance-handbook.md, ../docs/guidelines/angular-coding-guidelines.md, ../docs/ui-design-system.md, ../docs/ui-layout-requirements.md.
- Angular doc merge sanity:
  - Confirm presence of added topics: “RxResource”, “Signal Store”, “Naming”, “Security”.
  - Skim to ensure no contradictory guidance.

Open questions

- Placement preference in sub-READMEs: top vs near the bottom; defaulting to a small “Repository guidelines” section near the docs/links area to minimize churn.
- Language: repository is English-first; keeping edits in English.

```json
{"steps":["coder","code_quality_reviewer"],"notes":"Move unique Angular guidance from frontend/README.md into docs/guidelines/angular-coding-guidelines.md without duplicating existing bullets; remove the frontend 'Coding Guidelines' section and add a Quick Links block. Add the same Quick Links block to backend/README.md. Root README remains unchanged as it already acts as an index.","tests":"1) Ensure no prescriptive rules remain in any README: `rg -n '\\b(must|should|never|do not|guideline|ルール)\\b' README.md frontend/README.md backend/README.md`. 2) Validate subfolder Quick Links: check that ../docs/governance/development-governance-handbook.md, ../docs/guidelines/angular-coding-guidelines.md, ../docs/ui-design-system.md, ../docs/ui-layout-requirements.md exist. 3) Confirm Angular guidelines include merged topics by grepping for 'RxResource', 'Signal Store', 'Naming', 'innerHTML'. 4) Manual skim for tone/duplication in docs/guidelines/angular-coding-guidelines.md."}
```
