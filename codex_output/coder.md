**Changed Files**
- `frontend/src/app/features/board/page.html:261`

**Full Replacement Block**
- Replaced the horizontal flex container with a vertical stack and reordered children so Status appears above Content:
  - Old: `div.flex.items-start.justify-between.gap-2` containing `h4` (title) then `span` (status)
  - New: `div.flex.flex-col.items-start.justify-start.gap-2` containing `span` (status) then `h4` (title)

Patched snippet:
- frontend/src/app/features/board/page.html:261
  - `<div class="flex flex-col items-start justify-start gap-2">`
  - Status `span` now precedes title `h4`

**Verification Commands Run**
- Searched for updated classes to confirm change:
  - `rg -n "flex items-start justify-between gap-2|flex flex-col items-start justify-start gap-2" frontend/src/app/features/board/page.html`
    - Found the new class at `frontend/src/app/features/board/page.html:261`

**Notes**
- Scope limited to subtask cards in the Board view.
- DOM order now matches visual order for accessibility (Status before Content).
- Kept `gap-2` and alignment with `items-start`; removed `justify-between` to avoid vertical stretching.

Would you like me to attempt running frontend tests/lint locally? Network access is restricted here, so if dependencies aren’t installed, those steps may fail.