Plan summary

- Smallest viable change: README already lacks explicit coding rules. Add a concise Quick Links section to make it a searchable entry point. No need to move content unless we detect rule-like text during audit.
- Merge step becomes a no-op unless hidden/camouflaged rules are found (e.g., prescriptive “do not use any”, state management mandates, UI token requirements). If found, route Angular items into docs/guidelines/angular-coding-guidelines.md and repo-wide items into docs/governance/development-governance-handbook.md, avoiding duplication where identical guidance exists.

Actions

- Audit README for coding-rule content; classify by target (Angular vs. governance).
- If any rules exist, cut from README and integrate into the correct existing documents, aligning headings and avoiding duplication.
- Update README to include a short Quick Links section:
  - docs/governance/development-governance-handbook.md
  - docs/guidelines/angular-coding-guidelines.md
  - docs/ui-design-system.md
  - docs/ui-layout-requirements.md
- Confirm README functions as index: keep overview/setup, quality commands, and troubleshooting; exclude coding-rule guidance.

Risks and open questions

- Risk: Subtle rule-like sentences (e.g., “Never use shadows”) embedded as feature descriptions. Mitigation: grep for typical rule keywords and review surrounding sentences before moving.
- Risk: Duplicating guidance already covered in both Governance and Angular docs. Mitigation: prefer centralizing in Governance for repo-wide rules and link from Angular if necessary; don’t duplicate text.
- Open question: Any mandated README template or badges to preserve? Current README is consistent and contains no rule sections; change will be additive.

Minimal route justification

- coder: Implement small doc edits and any needed content moves.
- code_quality_reviewer: Sanity-check tone, duplication, and links; ensure README reads as an index and not a rules doc.

Validation

- Link integrity: ensure the four Quick Links resolve.
- Absence of rules in README: grep for common rule keywords to confirm.
- No style/structure breakage in target docs.

```json
{"steps":["coder","code_quality_reviewer"],"notes":"Add a Quick Links block to README and remove/move any coding-rule text if found. Given current repo, README contains no explicit rules; expect an additive Quick Links change only. If any rule-like lines are discovered, merge them into the Angular or Governance docs without duplication.","tests":"1) Link check: verify README links to docs/governance/development-governance-handbook.md, docs/guidelines/angular-coding-guidelines.md, docs/ui-design-system.md, docs/ui-layout-requirements.md. 2) Grep README for rule keywords (e.g., 'must', 'do not', 'coding', 'guideline', 'lint', 'style', 'naming', 'design tokens') and confirm no prescriptive rules remain. 3) Quick skim of modified docs to ensure headings remain coherent and no duplicate guidance was introduced."}
```