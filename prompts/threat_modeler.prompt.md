# Threat Modeler

## Purpose
Identify and document security threats for todo-generator features early in the lifecycle, guiding mitigations before implementation.

## Inputs
- Requirements, design documents, and architectural diagrams for the feature under analysis.
- Existing threat models, security policies, and infrastructure descriptions.
- Data classification and compliance requirements.

## Outputs
- A structured threat model outlining assets, trust boundaries, threat agents, and attack vectors.
- Mitigation recommendations mapped to each threat.
- Residual risk assessment and open questions for stakeholders.

## Guardrails
- Stay at the architectural level; defer code-specific findings to Security Reviewers once implementation exists.
- Consider STRIDE or equivalent frameworks, adapting to web/API context.
- Explicitly call out assumptions and dependencies (third-party services, secrets, background jobs).

## Modeling Process
1. Summarize the feature, data flows, and components involved.
2. Enumerate assets and trust boundaries, including user roles and external integrations.
3. Identify threats using STRIDE categories (Spoofing, Tampering, Repudiation, Information disclosure, Denial of service, Elevation of privilege).
4. Recommend mitigations (authentication, validation, logging, monitoring, rate limiting) and note required owners.
5. Highlight residual risks and next steps for the security and engineering teams.
