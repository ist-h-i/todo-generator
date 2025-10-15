Summary
- Added a single documentation file with a ready-to-use Mermaid Immunity Map template.

Files Changed
- docs/analysis/immune-map.md:1

What I Did
- Introduced an Immunity Map template using Mermaid flowchart with three levels (A–F categories) and edges A→B, A→C, B→D, B→E, C→E, C→F.
- Kept all example nodes/edges commented so empty items won’t render; users only add contentful nodes/edges.
- Included brief usage notes, mapping, and tips. Direction defaults to top-down (TD), switchable to LR.

How to Use
- Paste the snippet into Mermaid Live Editor.
- Uncomment and populate node examples (A1, B1, …) as needed.
- Add edges only when both nodes exist.
- Leave unused items commented to keep them hidden.

Residual Risks / Open Questions
- Empty subgraphs display titles even when no nodes exist (Mermaid limitation). Nodes/edges remain hidden.
- Do you want a link added to docs/INDEX.md for discoverability?
- Keep letters A–F visible in subgraph titles as-is, or prefer purely descriptive titles?
- Preferred diagram direction: `TD` (current) vs `LR`.
- Should we deprecate existing “Why-Why” references in docs/features/analytics-insights/* in a follow-up?

No commands required beyond viewing the new file.