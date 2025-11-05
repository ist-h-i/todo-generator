**Summary**
- Change timing so the custom single‑select closes its options panel immediately upon clicking an option. Keep keyboard and dismissal behavior unchanged. Multi‑select and native `<select>` are out of scope. If the current implementation already behaves this way, no code change is needed.

**Functional Requirements**
- Clicking an option selects it and closes the panel immediately.
- After intentional close (click/Enter/Escape), focus returns to the trigger.
- Arrow-key navigation is unchanged; Enter selects and closes; Escape closes without selection.
- Outside click closes the panel without forcibly moving focus.
- Disabled options (if present) must not select or close.

**Non‑Functional Requirements**
- Minimal, localized change (or confirm as already compliant).
- No API or dependency changes.
- Preserve accessibility roles/states and focus management.
- No regressions to keyboard/outside‑click behavior.

**Out of Scope**
- Multi‑select auto‑close changes.
- Native `<select>` behavior changes.
- Overlays/portals, search/typeahead, or broader redesigns.
- Backend/API modifications.

**Assumptions**
- A custom single‑select component controls its panel and focus.
- Existing Escape and outside‑click close behaviors already work.
- Multi‑select and native paths are separate and remain unchanged.

**Residual Risks / Open Questions**
- Blur vs click ordering could cause rare race conditions in some browsers.
- Space key parity with Enter is unspecified; users may expect Space to select/close.
- If the panel is rendered via a portal/overlay, outside‑click containment may need adjustment.
- If option labels can include rich HTML, ensure proper escaping/sanitization.
- If selection triggers server actions, enforce server‑side validation/allowlisting and CSRF protections.

## Clarifying questions
- Which component/file implements the target selector in this repository snapshot?
- Should the Space key also select and close in single‑select mode?
- Do disabled options exist, and should clicks on them be ignored without closing?
- Is the panel rendered inline or via an overlay/portal?
- Are there tests or analytics coupled to the current timing that must remain stable?