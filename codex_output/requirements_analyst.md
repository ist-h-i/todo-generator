**Functional Requirements**
- Disallow `any` in frontend TypeScript (`frontend/src/app/**`).
- Define and use explicit interfaces/types for API DTOs, components, services, and utils.
- Prefer `unknown`, generics, or discriminated unions over `any` for dynamic values; add type guards where needed.
- Enforce via ESLint rule `@typescript-eslint/no-explicit-any` for main source; allow narrowly scoped, justified exceptions via inline disable comments.
- Provide minimal adapters/wrappers to type third‑party or generated code without leaking `any` into app code.
- Add brief developer guidance with examples and migration tips.

**Non‑Functional Requirements**
- Minimal disruption: avoid broad refactors; focus on enforcement + light touch fixes.
- Align with existing ESLint + Prettier setup and repo conventions.
- Keep CI signal clear; avoid flakiness and unnecessary warnings.
- Maintain readability and DX (don’t force verbose types where inference suffices).
- Document rationale and limited exception policy.

**Acceptance Criteria**
- ESLint configured in `frontend` to enable `@typescript-eslint/no-explicit-any` (error) for `frontend/src/app/**`; decision recorded for specs/tests handling.
- Linting `npm run lint` passes on current codebase or includes explicit, commented suppressions with justification where unavoidable.
- Short guidance added to `docs/development-rules.md` covering: why not `any`, alternatives (`unknown`, generics), interface examples, when/how to justify exceptions.
- New/modified code in `frontend/src/app/**` contains no `any` in declarations, parameters, or return types.
- For external/unsafe boundaries (e.g., `JSON.parse`, 3rd‑party libs), code uses `unknown` + runtime checks or typed adapters.
- CI configuration (existing lint step) fails on `any` violations per agreed scope.

**Out of Scope**
- Large‑scale refactoring of legacy modules purely to remove `any` unless needed to pass lint per scope.
- Backend typing or API generation changes beyond typing app‑side DTOs.

**Risks**
- High existing usage of `any` could cause widespread changes or many suppressions.
- Overuse of type assertions (`as`) to bypass checks reduces safety.
- Third‑party typings or generated clients may include `any` that leaks into app code.
- Developers may choose `unknown` without adding guards, hurting runtime safety.
- CI failures if severity is set to error without handling legacy hotspots.

**Open Questions**
- Scope now vs. gradual: enforce on all code immediately or only new/changed code (with baseline exceptions)?
- Tests/specs: treat `*.spec.ts` as error, warn, or allow justified disables?
- Inventory: how many current `any` instances exist; do we fix them now or gate with targeted overrides?
- API typing: do we have/generated DTOs, or define interfaces manually (and where to store them)?
- Documentation location: confirm `docs/development-rules.md` as the canonical place vs. a new frontend style doc.

**Assumptions**
- Angular frontend uses ESLint + Prettier per repo rules.
- CI already runs `npm run lint` and will pick up the rule change.
- Team agrees to minimal, explicit exceptions with inline comments and follow‑up cleanup tasks if necessary.