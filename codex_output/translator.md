**Restated Request (English)**

Update the Board screen’s subtask card layout so that, within the container currently using class "flex items-start justify-between gap-2", the subtask’s Status appears above the Content (stacked vertically), instead of side-by-side.

**Assumptions**

- “Status” is the subtask status indicator/badge/select; “Content” is the title/description.
- Change applies to subtask cards only on the Board view.
- Tailwind utility classes are used; the shift likely involves switching to a vertical stack (e.g., flex-col) or reordering.
- No visual changes beyond stacking order and standard spacing.

**Unknowns**

- Exact component/file(s) implementing the subtask card on the Board view.
- Whether the change should apply to all breakpoints or only specific screen sizes.
- Whether to keep or remove `justify-between` in vertical layout, and exact spacing/alignment expectations.
- Whether other elements (e.g., assignee, actions) exist inside the same container and how they should arrange.
- Any design references or constraints (typography, gap size, margins).

**Clarifying questions**

- Which component(s)/file(s) should this target in the Board view?
- Should the vertical stack apply across all screen sizes or only certain breakpoints?
- Do we keep current spacing/typography, or adjust gap (e.g., keep `gap-2`)?
- Should `justify-between` remain (creating vertical space) or use compact stacking (`justify-start`)?
- Are there other elements in the same container that require a specific order?
- Any mockups or screenshots to confirm the desired result?
- Any tests or visual regression checks that might be affected?

