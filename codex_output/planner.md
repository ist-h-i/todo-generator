Proposed route: keep it coder-only. The change is purely documentation (1 new index file + 1–2 link insertions). No build or code behavior changes, so adding QA or integration stages offers little value under the 30-minute cap.

What will be done
- Create a concise repository-wide index at docs/INDEX.md mapping top-level areas and key docs.
- Add a single cross-link in README.md to the index.
- Add a single cross-link in docs/README.md to the index.
- Keep all edits minimal and avoid restructuring or renaming.

Residual risks and notes
- Coverage is intentionally shallow to keep the diff minimal; can be extended later.
- Filename choice INDEX.md keeps it predictable; switch to 00-index.md later if ordering is desired.
- English-only for now; bilingual can be added in a follow-up if requested.

```json
{"steps":["coder"],"notes":"Add docs/INDEX.md with a top-level directory map and links to key docs. Insert a single 'Repository Index & Map' link in README.md and docs/README.md. Avoid restructures and keep the diff minimal.","tests":"- Verify index file exists: test -f docs/INDEX.md\n- Check root README link: rg -n \"\\[Repository Index & Map\\]\\(docs/INDEX.md\\)\" README.md\n- Check docs README link: rg -n \"\\[Repository Index & Map\\]\\(INDEX.md\\)\" docs/README.md\n- Verify Quick Links exist:\n  - test -f docs/governance/development-governance-handbook.md\n  - test -f docs/guidelines/angular-coding-guidelines.md\n  - test -f docs/ui-design-system.md\n  - test -f docs/ui-layout-requirements.md"}
```