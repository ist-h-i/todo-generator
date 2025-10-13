Completed: removed rule text from READMEs, merged unique Angular guidance into the guidelines doc, and added index-style Quick Links.

What changed
- Angular guidelines updated with unique rules from frontend README:
  - `docs/guidelines/angular-coding-guidelines.md:11` TypeScript standards updated (arrow functions, avoid manual subscribe, union types).
  - `docs/guidelines/angular-coding-guidelines.md:22` Naming & file conventions added (camelCase/PascalCase/UPPER_SNAKE_CASE, suffixes, import order, aliases).
  - `docs/guidelines/angular-coding-guidelines.md:28` State/data flow expanded (Signal Store preference, Resource API/RxResource, error handling via LoggerService).
  - `docs/guidelines/angular-coding-guidelines.md:65` Security added (DomSanitizer, HttpInterceptor, CSRF).
- Frontend README: removed “Coding Guidelines” section; added Quick Links block so it acts as an index
  - `frontend/README.md:50` Repository guidelines + usage bullets with `../docs/...` links.
- Backend README: added the same Quick Links block near the top
  - `backend/README.md:16` Repository guidelines + usage bullets with `../docs/...` links.
- Root README: already index-oriented; no changes.

Why this is minimal
- Consolidates rules in a single authoritative place without duplicating governance/CI/commit policies (already covered in the handbook).
- Keeps READMEs as searchable entry points without prescriptive guidance.

Validation
- No prescriptive rules remain in READMEs:
  - `rg -n '\b(must|should|never|do not|guideline|ルール)\b' README.md frontend/README.md backend/README.md`
- Links resolve:
  - `docs/governance/development-governance-handbook.md`
  - `docs/guidelines/angular-coding-guidelines.md`
  - `docs/ui-design-system.md`
  - `docs/ui-layout-requirements.md`
- New Angular topics present:
  - `RxResource`, `Signal Store`, `union types`, `DomSanitizer`, `LoggerService` in `docs/guidelines/angular-coding-guidelines.md`.

Residual risks / notes
- Minor duplication risk if future edits reintroduce similar bullets; current additions are scoped to unique items.
- I intentionally did not migrate “Conventional Commits” or CI/CD bullets from the frontend README since the Governance Handbook already covers them. If you want explicit cross-links, I can add a sentence referencing the handbook sections.
