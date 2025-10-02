**Summary**
- The change stacks “status” above “content” and updates DOM order accordingly. This improves meaningful sequence for assistive tech.
- Verified at `frontend/src/app/features/board/page.html:261` through `:270`: container now `div.flex.flex-col.items-start.gap-2` with status span before the title heading.

**WCAG**
- 1.3.2 Meaningful Sequence: Pass. Visual and DOM order align (status → content).
- 1.3.1 Info and Relationships: Pass. Title remains a heading (`h4`), status is contextual text.
- 1.4.10 Reflow / 1.4.12 Text Spacing: Likely pass; flex column and wrapping preserved.
- 1.4.3 Contrast (Minimum): Risk. `text-slate-500` at 11px uppercase may not meet 4.5:1 against the card’s gradient/surface.

**Keyboard**
- No new focusable elements; tab order unchanged and logical (status then title).
- If either status badge or title gains interactivity elsewhere, ensure focus order and visible focus states remain clear.

**Screen Reader Order**
- Now reads status before title, matching visual order. This is consistent and predictable.
- Heading navigation remains available via `h4`.

**ARIA**
- No ARIA changes required. Optional enhancement: if the card (`article`) needs stronger semantic ties, set `aria-labelledby` to the title `h4` and `aria-describedby` to the status span.
- Avoid using `order-*`; DOM order already reflects intended sequence.

**Contrast & Text Legibility**
- Status: `text-[11px] uppercase tracking-[0.2em] text-slate-500` at `frontend/src/app/features/board/page.html:262` might be hard to read:
  - Small size + all-caps + large letter-spacing can reduce legibility.
  - Action: verify contrast of `text-slate-500` on the actual surface; if low, consider a higher contrast token (e.g., `text-slate-600` or a `text-on-surface-subtle` token) or increase font-size to ≥12px.

**Flex Gap Fallback**
- If legacy Safari is in scope and flex `gap` is unreliable, consider a local fallback margin on the status element to maintain vertical separation. Non-blocking.

**No Regressions Observed**
- Truncation/wrapping on title preserved (`min-w-0 break-words`), no unexpected content exposure.
- Semantics remain sensible: `article` wrapper, `h4` for title.

**Recommendations**
- Verify and, if needed, adjust status text contrast and/or size for WCAG 1.4.3 at small text thresholds.
- If the status label’s meaning could be ambiguous out of context, consider a visually hidden prefix (e.g., “ステータス:”) for clarity; optional and low impact.
- Optionally add `aria-labelledby` from the `article` to the title `h4` to reinforce name computation for the card.

**Verification Points**
- File: `frontend/src/app/features/board/page.html:261` shows `div.flex.flex-col.items-start.gap-2`.
- Order: status span at `:262–:266` precedes title `h4` at `:267–:269`.
- Run an axe scan on the board view; check contrast for the status label specifically.