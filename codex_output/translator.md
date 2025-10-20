**Summary**
Replace any string fields that store user-identifying data (e.g., email, nickname) on domain objects (e.g., Cards, Tasks) with a stable `userId` reference. Display the user’s nickname by resolving from `userId`. Remove logic that overwrites labels from nickname to email.

**Goals**
- Persist user linkage via `userId` instead of email/nickname strings.
- Show assignee labels using the resolved user nickname.
- Eliminate post-processing that overwrites labels with email.

**Assumptions**
- There is a canonical Users source exposing `userId`, `email`, and `nickname`.
- `userId` is stable/unique and suitable as a foreign key.
- Existing objects (e.g., Card, Task) currently store assignee as a string (email or nickname).
- The SPA (Angular) renders assignee labels from object fields presently.
- Backend and/or state management can resolve a user by `userId`.
- Nicknames may change over time; resolving at read-time is acceptable.

**Constraints**
- Minimize scope and avoid unrelated refactors.
- Deliver a complete, self-contained change (models, persistence, API/contracts, UI).
- Maintain backward compatibility or provide a safe one-time migration for existing data.
- Follow repo governance and Angular guidelines when touching SPA code.

**Unknowns**
- Exact entities/fields storing user info as strings (e.g., `Card.assignee`, `Task.owner`).
- Source of truth for Users (DB table, API endpoint, cache).
- Type/format of `userId` (UUID, numeric, string).
- Whether multiple assignees are supported anywhere.
- Current API contracts: do they already include `userId`?
- Required handling when `userId` cannot be resolved to a user (deleted/disabled users).

**Acceptance Criteria**
- All relevant objects use `userId` for user linkage.
- UI shows nickname resolved from `userId`.
- Logic that overwrites nickname with email is removed.
- Migration path exists for legacy records (email/nickname → userId).
- Tests or verifiable steps cover resolution and fallback behavior.

**Residual Risks**
- Data migration mismatches (emails without corresponding users).
- Performance regressions if nickname resolution adds extra calls without caching/batching.
- UI/state bugs if `userId` resolution fails; need clear fallback strategy.
- External integrations relying on email strings may break if not coordinated.

## Clarifying questions
- Which exact models and fields currently store user data as strings (list all: names and locations)?
- What is the canonical Users interface and its fields (id, email, nickname)? API paths?
- What is the `userId` type and validation rules?
- Do any views or APIs require email display alongside nickname?
- Should we resolve nickname server-side (embed in payload) or client-side (SPA fetch/selector)?
- What is the fallback if `userId` is unresolved (show email, placeholder, or “Unassigned”)?
- Is there any multi-assignee or watcher concept that needs the same change?
- Are there migration windows/constraints (e.g., zero-downtime, versioned API compatibility)?