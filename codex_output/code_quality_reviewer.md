**Summary**
- README now acts as an index and contains no prescriptive coding rules. The new “Repository guidelines” block with Quick Links is appropriate and minimal.

**Verification**
- No rule-like language remains in `README.md` beyond link text (grep check ok).
- Links resolve:
  - `docs/governance/development-governance-handbook.md`
  - `docs/guidelines/angular-coding-guidelines.md`
  - `docs/ui-design-system.md`
  - `docs/ui-layout-requirements.md`
- New section is clearly scoped: `README.md:148` header “Repository guidelines” with links at `README.md:150-153` and usage bullets at `README.md:155-164`.

**Quality/Readability**
- The section reads as a concise index; tone is consistent with the rest of the README.
- No duplication introduced in guideline documents; no rewording needed there.

**Minor Nits (non-blocking)**
- Small duplication: “Development Governance Handbook” linked in both the quick list (`README.md:150`) and again in usage bullets (`README.md:162`). Consider dropping one to reduce redundancy.
- Optional ToC tweak: if desired, add a nested ToC entry for “Repository guidelines” under “Documentation & knowledge base” to improve scanability.

**Out of Scope Observations**
- `README.md` environment-variable table formatting breaks between `DATABASE_URL` and `DEBUG` due to an inserted paragraph; not part of this change but worth a future tidy.

**Conclusion**
- Definition of Done met with a minimal diff. No further action required.