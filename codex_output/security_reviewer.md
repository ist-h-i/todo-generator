**Summary**
- Change is UI-only (stack Status above Content) and already implemented in `frontend/src/app/features/board/page.html:247` using `flex flex-col items-start justify-start gap-2`. No risky bindings introduced.

**UI/DOM & XSS**
- Interpolations use Angular binding (`{{ ... }}`) and no `[innerHTML]` found across frontend; mitigates XSS.
- Dynamic styles are bound to status/accent colors: `[style.color]`, `[style.background]` at `frontend/src/app/features/board/page.html:222`, `frontend/src/app/features/board/page.html:288`. Angular sanitizes style values, but upstream color input should still be constrained.

**Input Validation**
- Frontend trims and requires non-empty inputs for titles; however backend allows creating/updating subtasks without a server-side non-empty title constraint (`backend/app/schemas.py:300` `SubtaskCreate`, `SubtaskUpdate`). Recommend adding validators to enforce non-empty `title` server-side.

**Backend AuthZ**
- Subtask updates are properly scoped: card ownership is enforced and subtask must belong to the card (`backend/app/routers/cards.py:704`, `backend/app/routers/cards.py:721`). This prevents cross-tenant escalation via UI DnD/status changes.

**Secrets & Config**
- Config uses a weak documented default `DEFAULT_SECRET_ENCRYPTION_KEY` (`backend/app/config.py:6`). Ensure a strong `SECRET_ENCRYPTION_KEY` is set in non-dev. CORS parsing blocks `*` with credentials; keep `allowed_origins` aligned with deployed SPA.

**Dependency Risks**
- Frontend deps are current (Angular 20, Tailwind 3.4, Puppeteer pinned; overrides for `glob`/`rimraf` reduce known CVEs). Backend pins recent FastAPI/SQLAlchemy/httpx/Pillow/cryptography. Still recommend periodic SCA in CI.

**Privacy/Exposure**
- Stacking may reveal slightly more content vertically; current template shows short fields (status, title, parent and labels). No new fields exposed; keep any existing truncation policies consistent if added elsewhere.

**Proposed Fixes (Minimal, High-Value)**
- Backend validation:
  - Enforce non-empty subtask titles:
    - Add `@field_validator('title')` to `SubtaskCreate` and `SubtaskUpdate` to reject blank/whitespace-only strings (`backend/app/schemas.py`).
- Color input hardening:
  - Constrain `Status.color` to safe formats (e.g., hex/rgb(a)) via `field_validator` in `StatusCreate/StatusUpdate` (`backend/app/schemas.py`). This reduces CSS injection surface even though Angular sanitizes.
- Secret hygiene:
  - On startup, warn or fail in non-debug if `SECRET_ENCRYPTION_KEY` equals the default (`backend/app/config.py`), to prevent weak default in production.
- CI hardening:
  - Add `pip-audit` and `npm audit --omit=dev` gates; keep existing lint/format/test jobs.

**Quick Validation Notes**
- No `[innerHTML]` present in frontend (scan OK).
- DOM order aligns with visual order in subtask card container (`frontend/src/app/features/board/page.html:270..279`): status `span` precedes title `h4`.
- Backend activity logging records IDs/metadata, not full content; avoids leakage of user text.