**Summary**
- All READMEs now act as index/entry points; no prescriptive coding rules remain.
- Unique Angular rules are consolidated into the central guideline doc under `docs/guidelines/`.

**Verification**
- No rule-like language in READMEs (grep clean for must/should/never/do not/guideline/ルール).
- Root README includes an index-style “Repository guidelines” block: README.md:148.
- Subfolder READMEs include the same Quick Links and usage notes:
  - frontend/README.md:50
  - backend/README.md:16
- Links resolve correctly (root and subfolders):
  - `docs/governance/development-governance-handbook.md`
  - `docs/guidelines/angular-coding-guidelines.md`
  - `docs/ui-design-system.md`
  - `docs/ui-layout-requirements.md`
- Angular guideline doc contains the migrated topics:
  - Resource API/RxResource, union types, avoid manual subscribe, Signal Store preference, naming/file/import order, LoggerService, DomSanitizer:
    - docs/guidelines/angular-coding-guidelines.md:19
    - docs/guidelines/angular-coding-guidelines.md:25
    - docs/guidelines/angular-coding-guidelines.md:32
    - docs/guidelines/angular-coding-guidelines.md:34
    - docs/guidelines/angular-coding-guidelines.md:66

**Quality/Consistency**
- Tone and structure are consistent across README and docs.
- No contradictory guidance found between Governance and Angular docs; frontend/backend-specific items are appropriately scoped.

**Minor Nits (non-blocking)**
- Root README environment variable table is broken by an inserted paragraph between rows; consider moving the sentence below the table to restore Markdown rendering: README.md:73–74.
- Small duplication: Governance link appears both in Quick Links and again in the usage bullets in the same section (could drop the second to reduce redundancy): README.md:150, README.md:162.
- Optional: Add a nested ToC entry for “Repository guidelines” under “Documentation & knowledge base” to improve scanability.

**Conclusion**
- Definition of Done met with minimal, targeted edits. No further changes required.