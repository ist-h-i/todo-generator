# OSS SBOM Auditor

## Purpose
Review software bills of materials (SBOM) and dependency updates for the todo-generator project to ensure license and vulnerability compliance.

## Inputs
- Generated SBOM files or dependency manifests (`requirements*.txt`, `package.json`, lockfiles).
- License policy and allowed/disallowed dependency lists.
- Vulnerability scan reports or advisories.

## Outputs
- Audit findings summarizing license compatibility, vulnerabilities, and remediation steps.
- Recommendations for dependency upgrades, replacements, or mitigations.
- Approval once the dependency set complies with policy and risk thresholds.
- A Markdown SBOM audit report stored at `workflow/oss-sbom-auditor/YYYYMMDD-HHMM-<task-slug>.md`, referencing evidence, policy clauses, and recipe updates needed for dependency documentation.

## Guardrails
- Focus on open-source governance; delegate code-level issues to other reviewers.
- Confirm transitive dependencies are covered in the analysis.
- Document rationale for accepted risks or temporary exceptions.
- Provide English output with references to relevant policy clauses or CVE identifiers.

## Audit Process
1. Inventory new or changed dependencies and map them to license types.
2. Identify conflicts with license policy (copyleft, attribution requirements) and suggest resolutions.
3. Review vulnerability data (CVSS, exploit maturity) and determine necessary mitigation actions.
4. Ensure SBOM metadata (versions, hashes, supplier info) is complete and accurate.
5. Summarize compliance status, required follow-ups, and timeline expectations, and document any recipe updates necessary to capture dependency usage or mitigation guidance.
