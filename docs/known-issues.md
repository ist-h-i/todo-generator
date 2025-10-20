# Known Issues & Workarounds

Each item summarises the impact, root cause, and current mitigations so delivery teams can plan around active gaps. Update this file whenever a workaround changes or the issue is resolved.

## Windows socket exhaustion during long async runs

- **Impact**: Backend test suites or development servers that open many concurrent HTTP connections can trigger `OSError: [WinError 10055]` on Windows. The asyncio loop stops when the OS runs out of socket buffers or ephemeral ports, halting the dev server or test run.
- **Root cause**: Windows aggressively limits the number of concurrently open sockets. Long-lived development shells and repeated FastAPI reloads may exhaust the quota before sockets return to the pool.
- **Mitigation**:
  - Close idle terminals or tools that leave network connections open. `Get-NetTCPConnection | Group-Object OwningProcess | Sort-Object Count -Descending | Select-Object -First 5` helps locate offenders.
  - Stagger large concurrent test batches, or insert short sleeps between runs so Windows can recycle ports.
  - As a last resort, reboot the machine or increase `MaxUserPort` and lower `TcpTimedWaitDelay` (requires admin rights and should be coordinated with IT).

## Settings page lacks status reorder controls

- **Impact**: Administrators can create and delete statuses from `/settings`, but they cannot adjust ordering once a status exists. The backend honours `status.order`, yet the UI only appends new statuses at the end.
- **Root cause**: The settings template renders existing statuses with a delete button only, and the component class exposes `addStatus`/`removeStatus` helpers without any edit action. No inline form is wired to call the status update API, so the workspace store never invokes `workspaceConfigApi.updateStatus` for existing rows.【F:frontend/src/app/features/settings/page.html†L17-L95】【F:frontend/src/app/features/settings/page.ts†L22-L113】【F:frontend/src/app/core/state/workspace-store.ts†L1910-L1955】
- **Mitigation**:
  - Update orders manually through the database (not recommended for production).
  - Short term workaround: delete and recreate statuses in the desired order.
  - Future work: add drag-and-drop reorder support in `WorkspaceStore` and surface it in the settings UI using `workspaceConfigApi.updateStatus`.

## Analyzer proposal eligibility is optimistic client-side only

- **Impact**: `WorkspaceStore.isProposalEligible` filters analyzer proposals by comparing titles and statuses stored in memory. The backend currently accepts all proposals without duplicate checks, so race conditions can still create near-duplicate cards when multiple operators publish simultaneously.
- **Root cause**: Duplicate detection lives only in the client store; the `/analysis` publish path lacks server-side safeguards to reject already-accepted proposals.
- **Mitigation**:
  - After publishing proposals, refresh the board to ensure duplicates are obvious.
  - Before multi-operator shifts, agree on quick filters (for example, "recently created") so duplicates are spotted early.
  - Future work: add server-side duplicate detection in `cards.py` during analyzer publishes.

## Settings page cannot edit status details

- **Impact**: Administrators can add or delete statuses from `/settings`, but there is no way to update the name, category, or colour once a status exists. Teams must delete the entry and recreate it to correct typos or adjust workflow columns, which also disrupts existing cards referencing the status.
- **Root cause**: The settings page lists statuses with only a delete button and the form always creates new entries. The component calls `WorkspaceStore.addStatus`/`removeStatus` but never exposes an edit path, leaving `workspaceConfigApi.updateStatus` unused.【F:frontend/src/app/features/settings/page.html†L17-L95】【F:frontend/src/app/features/settings/page.ts†L22-L113】【F:frontend/src/app/core/state/workspace-store.ts†L1910-L1955】
- **Mitigation**:
  - Invoke the `/statuses/{id}` endpoint directly via REST client or console snippet that calls `workspaceConfigApi.updateStatus(...)` until inline editing ships.
  - When status edits are frequent, prefer using database scripts off-hours to adjust affected columns and card references.
  - Future work: add inline edit controls (mirroring the template editor) that patch existing statuses through `WorkspaceConfigApiService.updateStatus`.

## Settings page cannot edit label details

- **Impact**: Workspace managers cannot rename labels, adjust colours, or toggle system flags once a label is created from `/settings`. Typos or colour mismatches require deleting the label, which cascades to every card using it.
- **Root cause**: The settings page lists labels with only a delete button and the form always creates new entries. The component calls `WorkspaceStore.addLabel`/`removeLabel` but never exposes an edit path, leaving `workspaceConfigApi.updateLabel` unused.【F:frontend/src/app/features/settings/page.html†L105-L155】【F:frontend/src/app/features/settings/page.ts†L32-L89】【F:frontend/src/app/core/state/workspace-store.ts†L1868-L1903】【F:frontend/src/app/core/api/workspace-config-api.service.ts†L106-L119】
- **Mitigation**:
  - Until inline editing exists, call `PUT /labels/{id}` through the API client or browser console helper that invokes `workspaceConfigApi.updateLabel(...)`.
  - Audit label usage before deleting entries so cards can be re-tagged quickly.
  - Future work: add inline edit controls with colour pickers and validation that route through `WorkspaceConfigApiService.updateLabel`.

## Workspace data is not persisted outside the container

- **Status**: Mitigated when the backend is configured to use the managed Neon PostgreSQL instance.
- **Impact**: All boards, cards, and configuration disappear whenever the FastAPI process restarts if the service runs against an ephemeral SQLite file.
- **Root cause**: SQLite stores the database in the local filesystem by default. Restarting a containerised or cloud environment without a mounted volume discards the file.
- **Mitigation**: Provide the Neon connection string via the `DATABASE_URL` environment variable before launching the backend. If you intentionally point to SQLite for experimentation, mount a persistent volume or export data regularly to avoid data loss.

## AI recommendation services run without a live provider

- **Impact**: Recommendation scores and explanations never reflect real-time AI output. Operators see heuristic-based values, so confidence indicators may drift from the production-grade LLM behaviour.
- **Root cause**: `RecommendationScoringService` replaces the intended AI integration with deterministic token similarity heuristics and returns a static fallback when scoring fails; no HTTP client or SDK connects to an external provider yet.【F:backend/app/services/recommendation_scoring.py†L29-L89】
- **Mitigation**:
  - Implement the real AI client and wire it into `RecommendationScoringService` before relying on recommendation scores operationally.
  - Guard the heuristic scorer behind a feature flag for offline development once live integration ships.
  - Document dashboards and workflows that depend on the production scorer so teams can validate behaviour after enabling the provider.
