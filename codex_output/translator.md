**Request Summary**
- Perform a periodic security review: identify vulnerabilities, apply minimal-impact fixes, and harden the project, delivering a self-contained outcome.

**Objectives / Definition of Done**
- Identify issues across code, configs, and dependencies.
- Apply smallest viable fixes with minimal diff.
- Document findings, changes, and residual risks.
- Keep builds/tests green; update docs where affected.
- Avoid unnecessary tasks or scope creep.

**Constraints**
- Minimize changes; fewest steps to completion.
- Each task must fit within ~30 minutes.
- Network access is restricted; avoid tools requiring external calls unless approved.
- Filesystem: workspace-write; no approval prompts available.
- Follow repo’s governance/design guidelines when applicable.

**Assumptions**
- Dependency updates (patch/minor) are acceptable when fixing known CVEs.
- No secrets should be present; secret scanning is allowed.
- Tests/builds exist or can be run locally.
- “Regular” implies repeatability but this cycle needs a one-off, complete outcome.

**Unknowns**
- Tech stack(s) and package manager(s) in use.
- Existing CI/CD and security gates.
- Severity thresholds (e.g., fix High/Critical only?).
- Compliance requirements (e.g., SOC2, ISO27001).
- Allowed tooling additions (linters, pre-commit hooks).
- Target environments and threat model.

**Clarifying Questions**
- What parts of the repo are in scope (all code, infra, CI/CD)?
- What tech stack and package managers are used?
- Are dependency upgrades allowed, and to what level (patch/minor/major)?
- Are we permitted to run networked audits (e.g., npm audit, pip-audit)?
- Any existing security policies or baselines to follow?
- Which environments are targeted (dev/staging/prod) and key threats to prioritize?
- Do you want this to set up recurring automation or is it a one-off pass?
- Any deadlines or severity priorities (e.g., fix Critical/High only this cycle)?

**Residual Risks (if proceeding without answers)**
- Missing environment- or compliance-specific issues.
- Potential regressions from dependency updates.
- Under- or over-scoping the review.
- Incomplete coverage of critical assets.