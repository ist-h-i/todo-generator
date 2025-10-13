**Summary**
- Applied minimal, surgical documentation fixes to improve clarity and formatting without restructuring.
- Updated root README TOC label and repaired a broken table.
- Cleaned artifacts in docs index and added a link to the Recipes index.

**Changes Made**
- README.md
  - Fixed TOC label to match section header: Manual setup (macOS/Linux) (README.md:13).
  - Repaired the environment variable table by moving an interjected note below the table to avoid breaking Markdown rendering (README.md:84).
- docs/README.md
  - Removed stray “ E” artifacts and unified list formatting using “ — ” separators (docs/README.md:6).
  - Added a “Recipes index” link under Prompts & Automation pointing to docs/recipes/README.md (docs/README.md:36).

**Patch Overview**
- README.md
  - [Manual setup (macoslinux)] → [Manual setup (macOS/Linux)] with the same anchor.
  - Moved the Neon credentials note to below the table, keeping content intact.
- docs/README.md
  - Replaced “ E” artifacts with “ — ” for all affected bullets.
  - Added: “- [Recipes index](recipes/README.md) — How to write and maintain code recipes.”

**Verification Commands**
- Confirm no stray artifacts remain:
  - `rg -n " E" docs/README.md`
- Validate key links exist:
  - `test -f docs/governance/development-governance-handbook.md && test -f docs/guidelines/angular-coding-guidelines.md && test -f docs/ui-design-system.md && test -f docs/ui-layout-requirements.md && test -f docs/recipes/README.md && echo links_ok || echo links_missing`
- Spot-check README wording:
  - `rg -n "Manual setup \\(macOS/Linux\\)" README.md`

**Residual Risks / Open Questions**
- Full link audit across all docs not performed; focused on the touched files only.
- Language remains English to minimize scope; advise if bilingual updates are required.