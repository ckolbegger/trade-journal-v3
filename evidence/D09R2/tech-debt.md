# D09R2 tech debt

Style-only ocr findings and low critic defects (the user's rule, 2026-11-19). Reviewed with the user after the gate.

| # | Source | Kind | Item |
|---|---|---|---|
| 1 | critic-1, defect 6 | low | At 1280 px the Marks grid briefly renders turned (2 header cells) when the panel opens, before measuring wide (23 cells). |
| 2 | ocr on T9R2.17-B2 (91d98afb), low, style only | maintainability | `src/ui/screens/CardMarks.tsx:268`: the draft input's `field` nests one ternary in another; pull the field name into a variable. |
