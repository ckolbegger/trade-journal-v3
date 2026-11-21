# D09R2 tech debt

Style-only ocr findings and low critic defects (the user's rule, 2026-11-19). Reviewed with the user after the gate.

| # | Source | Kind | Item |
|---|---|---|---|
| 1 | critic-1, defect 6 | low | At 1280 px the Marks grid briefly renders turned (2 header cells) when the panel opens, before measuring wide (23 cells). |
| 2 | ocr on T9R2.17-B2 (91d98afb), low, style only | maintainability | `src/ui/screens/CardMarks.tsx:268`: the draft input's `field` nests one ternary in another; pull the field name into a variable. |
| 3 | critic-2, defect 4 | low | A Missing Review Date cell looks the same as an optional earlier cell (no warning-tone border, no column tint), and Acknowledged Unavailable is plain text, not a chip (research page section 4, "Cell states"). The "Review Date" tag and "1 needed" badge still carry the meaning. |
| 4 | critic-3, defect 1 | low | Price History's Trade P&L cell for an acknowledged session is "—" named "No Mark", while the Mark cell above reads "Acknowledged Unavailable" (W9 as amended by decision 123; AC-MARK-003). |
| 5 | critic-3, defect 2 | low | Cell styles differ from the mockup's "Cell states": the Review Date input looks like an optional one (no warning border, no column tint), a typed unsaved input keeps the dashed border, Acknowledged Unavailable has no chip, and tagged headers sit higher than untagged ones. Overlaps item 3. |

## Reviewed with the user (2026-11-21)

All five accepted as recommended: every item stays tech debt, none fixed now.
- Items 1 and 2: stay as listed.
- Items 3 and 5: merged into one item; it goes to the coach review, which U2 already holds restyling for.
- Item 4: goes to the coach review (a screen-words choice).
