# Known Issues

## Card detail text overflow on board page

The "カード情報" section inside the board card detail drawer renders long summaries
and field values without any wrapping rules. The template simply prints the raw
text (`card-overview__summary` and the `<dd>` elements in `card-overview__list`),
while the corresponding stylesheet only sets typography and colors and omits any
`word-break`/`overflow-wrap` guard.

```
frontend/src/app/features/board/page.html
└─ section.card-overview > p.card-overview__summary and dd

frontend/src/styles/pages/_board.scss
└─ .card-overview__summary/.card-overview__item dd → missing word-break rules
```

As a result, long continuous strings (for example long Japanese sentences or
URLs pasted from a ticket) spill across the padded boundary and appear to touch
or overflow the card frame. The board tiles apply `word-break: break-word;`
(see `.board-card__title`), but the detail drawer does not, which explains the
visual difference. Adding an explicit wrapping rule to the detail styles will
resolve the overflow.
