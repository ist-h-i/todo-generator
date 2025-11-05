**Summary**
- Goal: Close the custom single-select panel immediately when an option is clicked.
- Prior findings suggest this behavior already exists; confirm target component/file to avoid unnecessary changes.

**Scope**
- Single-select custom selector only.
- Exclude multi-select and native `<select>` behavior changes.

**Acceptance Criteria**
- Click on an option selects it and closes the panel.
- Focus returns to the trigger after intentional close.
- Enter key selection mirrors click; ESC and outside-click close remain unchanged.
- Multi-select/native `<select>` paths remain unchanged.

**Non-Functional Constraints**
- Minimal, localized change only (or confirm no change needed).
- Preserve accessibility: ARIA roles/states, focus management, ESC handling.
- No dependency, API, or broader UI/UX changes.

**Out Of Scope**
- Redesigns, overlays/portals, or adding search/typeahead.
- Changing multi-select auto-close behavior.
- Backend or schema changes.

**Verification**
- Open → click option → value updates, panel closes, focus returns to trigger.
- Arrow keys + Enter → selection and close.
- ESC closes; outside click closes without forced focus.
- Multi-select/native paths behave as before.

**Residual Risks / Open Questions**
- Component path mismatch: confirm actual file for the selector (referenced path may not exist in this snapshot).
- Keyboard parity: should Space also select/close for single-select?
- Blur vs click ordering edge cases in some browsers; only adjust event ordering if an issue is observed.
- Future overlay/portal rendering could affect outside-click containment.
- If option labels include rich HTML now or later, ensure sanitization/escaping to avoid XSS.
- If selection triggers server-side changes, confirm server validation/allowlisting and CSRF protection.

**Next Step**
- Please confirm the selector component’s file path. If current behavior already matches the criteria, we can close with no code changes; otherwise, we’ll apply a minimal update to the option click handler (select → close → restore focus).