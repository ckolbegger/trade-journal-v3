# D09R2 tech debt

Style-only ocr findings and low critic defects (the user's rule, 2026-11-19). Reviewed with the user after the gate.

| # | Source | Kind | Item |
|---|---|---|---|
| 1 | critic-1, defect 6 | low | At 1280 px the Marks grid briefly renders turned (2 header cells) when the panel opens, before measuring wide (23 cells). |
| 2 | ocr on T9R2.17-B2 (91d98afb), low, style only | maintainability | `src/ui/screens/CardMarks.tsx:268`: the draft input's `field` nests one ternary in another; pull the field name into a variable. |
| 3 | critic-2, defect 4 | low | A Missing Review Date cell looks the same as an optional earlier cell (no warning-tone border, no column tint), and Acknowledged Unavailable is plain text, not a chip (research page section 4, "Cell states"). The "Review Date" tag and "1 needed" badge still carry the meaning. |
