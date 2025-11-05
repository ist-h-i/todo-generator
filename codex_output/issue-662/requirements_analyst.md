**Functional Requirements**
- Close the options panel immediately when an option is clicked (single‑select).
- Register the selection before closing the panel.
- Return focus to the trigger after intentional close.
- Keep keyboard behavior: Enter selects and closes; ESC/outside‑click close unchanged.
- Leave multi‑select/native `<select>` behavior unchanged.

**Non‑Functional Requirements**
- Minimal, localized change; no broad UI/UX refactors.
- Preserve accessibility (roles/states, focus management, ESC behavior).
- Avoid regressions to keyboard navigation and outside‑click handling.
- No dependency or API changes.

**Out of Scope**
- Redesigns, overlays/portals, or adding search/typeahead.
- Changing multi‑select behavior (no auto‑close per selection).
- Backend/contract changes or unrelated UI adjustments.

**Assumptions**
- Target is a custom single‑select component (not native `<select>`).
- Existing focus management and ESC/outside‑click close are in place.
- No embedded search/typeahead in the panel, or unaffected by this change.

**Risks**
- Blur vs. click ordering in some browsers could interfere with selection; may require careful event sequencing if observed.
- Space key parity is unspecified; expectations may vary across users.
- Rich HTML in option labels could introduce XSS if not sanitized.
- If selection triggers server actions, require server‑side validation/allowlisting and CSRF protection.
- Future portal/overlay rendering may affect outside‑click containment.

## Clarifying questions
- Which component/file implements the selector to change?
- Should Space also select/close in single‑select for keyboard parity?
- Is there a search/typeahead inside the panel we must account for?
- Confirm scope: single‑select only; multi‑select/native paths remain unchanged?