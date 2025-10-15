Plan summary
- Add a single repository-wide index at docs/INDEX.md mapping top-level directories, key entry points, and search tips.
- Insert one link in README.md under “Documentation & knowledge base”.
- Insert one link in docs/README.md under “Contribution Tips”.
- Keep scope minimal: 1 new file + 2 one-line edits, no renames/restructures.

Why this fits the constraints
- Minimal, safe diff; no link churn or structural changes.
- Clear navigation for newcomers to backend/frontend entry points and key docs.
- Extensible if deeper coverage is needed later.

Risks / Open questions
- Coverage is intentionally shallow to keep the diff small; maintainers can extend sections per feature area.
- English-only; add bilingual notes later if required.
- Future folder renames may require updating the index (kept directory-focused to reduce drift).

Verification notes
- All links point to existing in-repo files/dirs.
- README and docs index both cross-link the new repository map.

```json
{"steps":["coder"],"notes":"Create docs/INDEX.md with a concise repository map (frontend routes/stores/APIs, backend routers/services/schemas/tests, docs, scripts, CI). Add one link in README.md under Documentation & knowledge base and one link in docs/README.md under Contribution Tips. No restructures; smallest viable diff.","tests":"- Verify new index exists: test -f docs/INDEX.md\n- Check README link added: rg -n \"Repository Index & Map\\]\\(docs/INDEX.md\\)\" README.md\n- Check docs index link added: rg -n \"Repository Index & Map\\]\\(INDEX.md\\)\" docs/README.md\n- Spot-check key references exist:\n  - test -f frontend/src/app/app.routes.ts\n  - test -f backend/app/main.py && test -d backend/app/routers && test -d backend/app/services\n  - test -f docs/guidelines/angular-coding-guidelines.md && test -f docs/governance/development-governance-handbook.md && test -f docs/ui-design-system.md && test -f docs/ui-layout-requirements.md"}
```
