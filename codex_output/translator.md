**Clarified Request (English)**
- On the board screen, update the subtask card layout so that within the container currently using `class="flex items-start justify-between gap-2"`, the “status” and “content” are stacked vertically instead of side-by-side, with status on top and content below.

**Assumptions**
- The project uses Tailwind CSS; the cited class is from Tailwind.
- The referenced container belongs specifically to the subtask card on the board view.
- “Status” is a visible badge/label element and “content” is the subtask text/details.
- Only layout changes are required (no text/content changes, no API/data changes).
- Vertical stacking should apply at all breakpoints unless otherwise specified.
- Left alignment remains appropriate (`items-start`), with vertical spacing preserved (e.g., `gap-2`).

**Unknowns**
- Exact component/template file(s) containing this container (e.g., Angular component path).
- Whether this exact class combination is reused elsewhere (risk of unintended changes).
- If the order in the DOM needs to change or if Tailwind order utilities should be used.
- Desired width behavior (full-width blocks vs. content-width), and any max-width constraints.
- Any responsive exceptions (e.g., horizontal on desktop, vertical on mobile).
- Specific spacing between status and content (keep `gap-2` or adjust?).
- Any related tests or visual regression checks that must be updated.