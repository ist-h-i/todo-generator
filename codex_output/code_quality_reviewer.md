**Summary**
- Goal met: All READMEs (root, frontend, backend) are index/entry points; no prescriptive coding rules remain.
- Angular-specific guidance is consolidated under `docs/guidelines/angular-coding-guidelines.md` with the newly merged topics.

**Verification**
- No rule-like language in target READMEs:
  - `README.md`, `frontend/README.md`, `backend/README.md` → clean.
- Quick Links present and correctly scoped:
  - Root: `README.md:148–153`
  - Frontend: `frontend/README.md:50–55`
  - Backend: `backend/README.md:16–21`
- Linked docs exist and resolve:
  - `docs/governance/development-governance-handbook.md`
  - `docs/guidelines/angular-coding-guidelines.md`
  - `docs/ui-design-system.md`
  - `docs/ui-layout-requirements.md`
- Angular guidelines include merged topics:
  - `takeUntilDestroyed`, avoid manual subscribe, Resource API/RxResource, union types, Signal Store, LoggerService, DomSanitizer
  - `docs/guidelines/angular-coding-guidelines.md:17,19–20,32–34,66`

**Quality Nits (non-blocking, small fixes)**
- Root README environment table is broken by an inserted sentence between rows; move the sentence below the table to restore Markdown rendering:
  - Table start `README.md:73–76`; stray paragraph `README.md:77`; table continues `README.md:78–84`.
- Minor duplication: “Development Governance Handbook” appears twice in the same section; consider removing the lower duplicate for brevity:
  - Quick Links `README.md:150`; duplicated link `README.md:162`.

**Risks / Notes**
- If new subfolders add READMEs later, follow the same index-only pattern with the Quick Links block.
- Other README-like docs under `docs/` and `workflow/` intentionally retain prescriptive guidance; they are not in scope for removal.