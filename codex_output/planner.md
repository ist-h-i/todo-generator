**Plan**

- Confirm defaults: specs error, DTOs path, templates out of scope
- Update ESLint: `no-explicit-any` → error
- Add docs guidance to `docs/development-rules.md`
- Verify codebase has no `any`; fix/suppress if found
- Run lint locally and ensure CI passes
- Open PR with summary and rationale

**Owners**

- Frontend Lead: decisions, ESLint change, verification
- Docs Owner: guidance update
- CI Maintainer: confirm pipeline reflects lint failure on rule

**Dependencies**

- Existing ESLint + Prettier setup in `frontend`
- CI step running `npm run lint` with `--max-warnings=0`
- `docs/development-rules.md` present (create section if missing)

**Gates / Decisions**

- Specs severity: enforce as error (default). Rationale: consistent rule, CI already zero-warnings.
- DTOs location: `frontend/src/app/shared/models` (default) for shared interfaces/DTOs.
- Angular templates `$any(...)`: out of scope for this change; optionally track a follow-up for template linting.

**Done Criteria**

- ESLint config sets `@typescript-eslint/no-explicit-any` to error for `frontend/src/app/**` (specs included).
- `npm run lint` passes on current codebase without new warnings/errors.
- `docs/development-rules.md` updated with:
  - Why not `any`
  - Alternatives (`unknown`, generics, discriminated unions) with brief examples
  - DTOs location guidance
  - Exception policy: narrowly scoped, inline disable with short rationale
  - Unsafe boundary pattern: `unknown` + type guards (e.g., `JSON.parse`)
- No TypeScript `any` in `frontend/src/app/**`; any unavoidable cases carry justified inline disables.
- CI fails on future violations per lint setup; PR includes summary and links to docs section.

**Risks/Mitigations**

- Hidden `any` usage appears: fix or add temporary, justified inline suppression with a cleanup task.
- Third‑party typings leak `any`: add typed adapter at boundary to avoid propagation.