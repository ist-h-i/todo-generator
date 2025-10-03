**UI/UX Findings**

- Visual hierarchy
  - Stack Status above Content; Status should be visually lighter than the title (small, muted, uppercase badge OK).
  - Keep compact spacing; `gap-2` is appropriate. Remove `justify-between` to avoid artificial vertical stretch.
  - Left-align content (`items-start`); ensure consistent typography with existing tokens.

- Interaction and accessibility
  - DOM order must match visual order (Status first, then Content) to align screen reader and tab navigation.
  - Status control remains a distinct, easily clickable target. Ensure touch targets are ≥40px on mobile and do not trigger drag-and-drop.
  - Provide accessible status text (e.g., aria-label “Status: In Progress”). Do not rely on color alone; include text within the badge.
  - Preserve all existing behaviors (status change, navigation) unchanged.

- Responsiveness and layout
  - Apply vertical stacking across all breakpoints; no responsive exceptions unless specified.
  - Ensure titles wrap safely (`break-words`, `min-w-0`). If the list view risks growing too tall, maintain any existing truncation/line-clamp.
  - Removing `justify-between` prevents awkward gaps on tall cards; rely on `gap-2` for consistent vertical rhythm.

- Edge cases
  - Long status names and titles should wrap or truncate without overflow or clipping.
  - Missing status: show a subdued “No status” placeholder or equivalent, avoiding layout collapse.
  - RTL should be unaffected by vertical stacking; verify mirrored spacing remains correct.
  - High-contrast/dark mode: confirm badge/text contrast meets accessibility ratios.

**Interaction Flow Checks**

- Scan path: Users read Status first, then Title/Content, then any labels/metadata below; this improves quick assessment without side-by-side eye jumps.
- DnD safety: Clicking/tapping the Status should not initiate drag; keep a clear drag handle or gesture zone unchanged.
- Keyboard flow: Tab order proceeds Status → Content → actions; Enter/Space behavior unchanged.

**Acceptance Checks (UX)**

- Status appears above Content visually and in DOM for all subtask cards on the Board.
- Container uses vertical stack utilities (e.g., `flex flex-col items-start gap-2`); `justify-between` removed.
- Spacing between Status and Content is compact and consistent; no unintended gaps.
- No regressions to other card parts (labels, parent info, drag behavior).
- Works on mobile, tablet, and desktop without overflow or clipping; maintains accessible contrast and focus order.

**Open Questions (Minor)**

- Do we want a 2-line clamp on titles in dense boards to prevent tall cards?
- Should we add an explicit “No status” placeholder when absent, or keep current behavior?