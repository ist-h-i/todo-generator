Lean route: coder-only. The work is purely documentation (add a single repository index and insert two small cross-links), carries no build/runtime impact, and comfortably fits within 30 minutes. Adding QA/integration stages would add overhead without improving outcome.

What the coder will do
- Create docs/INDEX.md mapping top-level areas with short descriptions and Quick Links.
- Add a single “Repository Index & Map” link to README.md and docs/README.md.
- Keep edits minimal; do not restructure or rename anything.
- Sanity-check link targets exist and avoid touching unrelated content.

Risks and mitigations
- Stale index as structure evolves: document a light rule to update docs/INDEX.md when adding new top-level dirs.
- Potential broken links: verify paths with ripgrep and existence checks before finalizing.

```json
{
  "steps": ["coder"],
  "notes": "Add docs/INDEX.md with a concise top-level directory map and Quick Links. Insert one 'Repository Index & Map' link in README.md and one in docs/README.md. Avoid restructures; keep the diff minimal and English-only.",
  "tests": "- Verify index file exists: test -f docs/INDEX.md\n- Check root README link: rg -n \"\\[Repository Index & Map\\]\\(docs/INDEX.md\\)\" README.md\n- Check docs README link: rg -n \"\\[Repository Index & Map\\]\\(INDEX.md\\)\" docs/README.md\n- Verify Quick Links exist:\n  - test -f docs/governance/development-governance-handbook.md\n  - test -f docs/guidelines/angular-coding-guidelines.md\n  - test -f docs/ui-design-system.md\n  - test -f docs/ui-layout-requirements.md"
}
```