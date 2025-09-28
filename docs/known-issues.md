# Known Issues

## Windows socket exhaustion during long async runs
**Impact**: Backend test suites or development servers that open many concurrent HTTP connections can trigger `OSError: [WinError 10055]` on Windows. The asyncio loop stops when the OS runs out of socket buffers or ephemeral ports, halting the dev server or test run.

**Reproduction**: Launch the FastAPI app with auto reload and repeatedly run `pytest backend/tests` or integration scripts that open many `httpx.AsyncClient` sessions without pauses.

**Mitigation**:
- Close idle terminals or tools that leave network connections open. `Get-NetTCPConnection | Group-Object OwningProcess | Sort-Object Count -Descending | Select-Object -First 5` helps locate offenders.
- Stagger large concurrent test batches, or insert short sleeps between runs so Windows can recycle ports.
- As a last resort, reboot the machine or increase `MaxUserPort` and lower `TcpTimedWaitDelay` (requires admin rights and should be coordinated with IT).

## Settings page lacks status reorder controls
**Impact**: Administrators can create and delete statuses from `/settings`, but they cannot adjust ordering once a status exists. The backend honours `status.order`, yet the UI only appends new statuses at the end.

**Mitigation**:
- Update orders manually through the database (not recommended for production).
- Short term workaround: delete and recreate statuses in the desired order.
- Future work: add drag-and-drop reorder support in `WorkspaceStore` and surface it in the settings UI using `workspaceConfigApi.updateStatus`.

## Analyzer proposal eligibility is optimistic client-side only
**Impact**: `WorkspaceStore.isProposalEligible` filters analyzer proposals by comparing titles and statuses stored in memory. The backend currently accepts all proposals without duplicate checks, so race conditions can still create near-duplicate cards when multiple operators publish simultaneously.

**Mitigation**:
- After publishing proposals, refresh the board to ensure duplicates are obvious.
- Before multi-operator shifts, agree on quick filters (for example, 'recently created') so duplicates are spotted early.
- Future work: add server-side duplicate detection in `cards.py` during analyzer publishes.

## WorkspaceStore regression breaks analyzer imports and board preferences
**Impact**: The Angular `WorkspaceStore` currently submits analyzer proposal confidence scores in the 0–1 range and discards cached board filters when workspace metadata is still loading. The first regression causes analyzer imports to persist cards with `ai_confidence` values like `0.82`, which fails the CI expectation of 0–100 percentages. The second regression resets stored filters to empty arrays, so cached groupings, search text, and remote layouts never reach the UI. The failures surface in `workspace-store.spec.ts` as five broken tests covering analyzer imports and board preference loading/persistence.

**Root cause**:
- `buildCardCreateRequest` forwards `sanitizeConfidence(payload.confidence)`, and `sanitizeConfidence` simply clamps numeric values without scaling fractional inputs. Analyzer proposals deliver confidences between 0 and 1, so the generated card requests violate the spec expectation of percentage integers.【F:frontend/src/app/core/state/workspace-store.ts†L1686-L1713】【F:frontend/src/app/core/state/workspace-store.ts†L315-L325】【F:frontend/src/app/core/state/workspace-store.spec.ts†L134-L205】
- `sanitizeFilterIds` removes every filter identifier that is not present in the current workspace settings. When the store has not fetched statuses and labels yet (the common case during login), the allowed sets are empty, so both cached preferences and remote board layouts are sanitised down to empty lists. Subsequent persistence attempts see no changes, which prevents remote updates from firing and leaves the board toolbar stuck at defaults.【F:frontend/src/app/core/state/workspace-store.ts†L2800-L2833】【F:frontend/src/app/core/state/workspace-store.spec.ts†L235-L411】

**Fix plan**:
- Extend the confidence normalisation helpers so that proposal confidences at or below 1.0 are multiplied by 100 before clamping. Reuse the same logic for local persistence and API payloads to keep card state and backend requests consistent.
- Teach `sanitizeFilterIds` to retain string identifiers when the allowed set is empty or metadata has not been fetched yet. Once statuses and labels arrive, the existing `reconcileFiltersForSettings` path will sanitise out truly invalid IDs while preserving cached user intent.
- Backstop the changes with focused unit specs covering both fractional confidences and preference hydration so that future regressions are caught at the store level.