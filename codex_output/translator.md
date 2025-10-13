**Summary**
- Enforce “no explicit any” in the frontend, migrate to explicit interfaces/types, review for Angular v20 best practices, apply minimal code/docs fixes.

**Objectives**
- Remove/replace existing `any` usages with safe typings.
- Prevent future `any` via lint/TS config and guideline updates.
- Align SPA code with Angular v20 best practices; apply only targeted fixes.

**Assumptions**
- The repo contains an Angular SPA subject to these rules.
- Updating `docs/guidelines/angular-coding-guidelines.md` is the primary place to codify rules; governance alignment lives in `docs/governance/development-governance-handbook.md`.
- Minimal ESLint/TS config tweaks are acceptable to enforce policy.
- Using `unknown`, generics, or domain interfaces is preferred over `any`.

**Constraints**
- Keep diffs small; change only what’s necessary.
- Fit within a 30-minute window; prioritize high-impact areas.
- Do not introduce unrelated refactors or upgrades.
- Follow existing design system and layout docs (`docs/ui-design-system.md`, `docs/ui-layout-requirements.md`).

**Deliverables**
- Targeted code changes replacing `any` with proper interfaces/types.
- Lint/config enforcement (e.g., `@typescript-eslint/no-explicit-any`) if permitted.
- Updated guidance in `docs/guidelines/angular-coding-guidelines.md` with examples.
- Brief change summary and residual risks noted in the PR.

**Non-Goals**
- Broad architecture changes or Angular version upgrades.
- Rewriting third-party or generated code beyond necessary type shims.

**Risks / Open Questions**
- Some `any` replacements may require minor runtime-safe refactors.
- Third-party types or generated code may still surface `any`.
- Full repo audit may exceed the timebox; a scoped pass may be needed first.

**Clarifying Questions**
- Which frontend paths are in scope (e.g., `src/` of which app/package)?
- May we add/modify ESLint rules (e.g., enable `no-explicit-any`) and TS compiler options (`strict`, `noImplicitAny`)?
- Preference when bridging unknown inputs: use `unknown` + type guards vs. introducing local interfaces?
- Any directories to exclude (e.g., generated code, test mocks, migrations)?
- Should we build on PR #507 or open a new PR?
- What are the acceptance criteria (e.g., zero `any` in `src/`, lint passes, docs updated)?
- Is enabling stricter settings (e.g., `noUnsafeAny` equivalents) acceptable if fallout is minimal?