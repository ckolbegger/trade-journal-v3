# D09AR tech debt

The user's rule, 2026-11-19: from now on, style-only ocr findings and low critic defects are recorded here as tech debt, not fixed as tasks. Once the gate has passed, this list is reviewed with the user. Earlier items of this kind were already fixed as tasks; they are not listed.

| Source | Kind | Item |
|---|---|---|
| critic-3, defect 1 | moderate defect, moved here by the user's decision | On the Review card (`CardFigures.tsx`), the past-a-line row sits under a heading: "Current Risk · Past the Stop by $300.00 (0.50R)" (AXIO, DALE), "Remaining Reward · Past the Target by $32.00 (0.10R)" (BREN). The replay sets it above both headings (W56, decision 7, coach point 6). Fix: drop the heading from that row, in both the card's groups. |
| critic-3, defect 2 | low defect | Finished Trades (BREN sold out, DALE expired) draw the At Stop and At Target lines with no label, against A280 ("a line is drawn with its label or not at all"). |
| critic-3, defect 3 | low defect | Labels drawn over away from the entry session: BREN "Sold 2 at $4.00" under the Target line; AXIO "Realized −$440" under the sale line and flag pole; the "No Mark" column label under the cursor; at 320, "Strike" under the price line, and a Mark dot on the slider value's minus sign. |

