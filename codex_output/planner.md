**Scope And Intent**
- Target only root `README.md` and `docs/README.md` for small, safe edits.
- Focus on correctness and clarity; avoid renames/restructures to preserve links.

**Proposed Minimal Changes**
- Root `README.md`
  - Fix minor wording: “Manual setup (macOS/Linux)”.
  - Scan for obvious typo/formatting inconsistencies; do not reorder sections.
- `docs/README.md`
  - Remove stray “ E” artifacts and unify list formatting.
  - Add a link to `docs/recipes/README.md` under “Prompts & Automation” or a short “Recipes” line.
  - Keep section order and link text stable to minimize diff.

**Why This Fits 30 Minutes**
- Two files, surgical edits, no renames or structural moves.
- No external tools; simple content changes and local link checks only.

**Risks / Open Questions**
- Language preference: Issue is Japanese, current docs are English. Proceeding in English to minimize scope.
- Hidden consumers may depend on exact wording; keeping changes minimal mitigates this.
- We’re not performing a full link audit across all docs (out of scope for 30 min).

**Acceptance Criteria**
- `README.md` reads cleanly with corrected “macOS/Linux”.
- `docs/README.md` has no stray “ E” artifacts, all listed links resolve to existing local files.
- No file renames; existing inbound links continue to work.

```json
{"steps":["coder"],"notes":"Apply small, targeted edits to README.md and docs/README.md: fix macOS/Linux wording, remove stray artifacts in docs index, and add a single missing link to the recipes index. Avoid restructures and renames to keep the diff minimal and safe.","tests":"- Verify no stray artifacts: `rg -n \" E\" docs/README.md` returns no results.\n- Validate key links exist: `test -f docs/governance/development-governance-handbook.md && test -f docs/guidelines/angular-coding-guidelines.md && test -f docs/ui-design-system.md && test -f docs/ui-layout-requirements.md && test -f docs/recipes/README.md`.\n- Spot-check README wording: confirm it contains \"Manual setup (macOS/Linux)\"."}
```