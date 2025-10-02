**Summary**
- Enforce a frontend coding style: do not use `any`. Define and use custom interfaces/types to maintain TypeScript type safety.

**Intent (Clarified)**
- Prohibit `any` in the Angular/TypeScript frontend.
- Model data with explicit interfaces/types instead of loosening types.
- Improve safety and readability without broad, disruptive refactors.

**Scope (Assumed)**
- Applies to `frontend/src/app/**` (features and shared/core/lib).
- Affects new and modified code; legacy code treatment to be clarified.
- Enforced via ESLint rule(s) and brief docs note.

**Assumptions**
- Frontend uses TypeScript with ESLint + Prettier as per repo guidelines.
- Rule to use: `@typescript-eslint/no-explicit-any` (with minimal, explicit exceptions if needed).
- Prefer `unknown`, generics, or discriminated unions over `any` when dynamic typing is unavoidable.
- Data from APIs should be typed (interfaces/DTOs); if OpenAPI/SDK exists, prefer generated types.

**Unknowns / Questions**
- Policy scope: all code now vs. only new/changed code? Is a gradual migration acceptable?
- Existing usage: How many current `any` occurrences? Should we fix them now or set rule to warn first?
- Exceptions: Are narrow, documented exceptions allowed (e.g., third‑party typings, legacy facades, tests)?
- CI impact: Should ESLint fail CI on violations immediately or start as a warning?
- Documentation: Where to add/update guidance (e.g., `docs/development-rules.md` vs. a new frontend style doc)?
- API typing: Do we have generated API types or should we define interfaces manually?
- Timeline/prioritization: Is this a quick lint+doc change or part of a broader refactor?