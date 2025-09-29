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

## Settings page cannot edit status details
**Impact**: Administrators can add or delete statuses from `/settings`, but there is no way to update the name, category, or colour once a status exists. Teams must delete the entry and recreate it to correct typos or adjust workflow columns, which also disrupts existing cards referencing the status.

**Root cause**: The settings template renders existing statuses with a delete button only, and the component class exposes `addStatus`/`removeStatus` helpers without any edit action. No inline form is wired to call the status update API, so the workspace store never invokes `workspaceConfigApi.updateStatus` for existing rows.【F:frontend/src/app/features/settings/page.html†L17-L40】【F:frontend/src/app/features/settings/page.ts†L22-L87】【F:frontend/src/app/core/state/workspace-store.ts†L1910-L1946】

**Mitigation**:
- Invoke the `/statuses/{id}` endpoint directly via REST client or console snippet that calls `workspaceConfigApi.updateStatus(...)` until inline editing ships.
- When status edits are frequent, prefer using database scripts off-hours to adjust affected columns and card references.
- Future work: add inline edit controls (mirroring the template editor) that patch existing statuses through `WorkspaceConfigApiService.updateStatus`.
