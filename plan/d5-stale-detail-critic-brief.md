# D5 defect-repair critic brief

A trader reported: record a Mark in Review, return to Trade Detail, and it still shows the Expected Mark as Missing; reopening Review shows an empty "Review mark price" input. A failing browser test reproduced this when returning via the **Trades** navigation with the detail still mounted (the cached evaluation snapshot was stale). Do NOT modify any file.

## Setup
Start the app yourself with `npm run dev` (port 5182) and drive `http://localhost:5182` with `playwright-cli`. Fresh browser context; create Institution + Account; confirm a Long Stock Plan AAPL (10 @ 100, stop 95, target 110, Thesis/Invalidation); record one opening Execution (10 @ 100 fee 5, instrument AAPL, economic time `2026-11-23T20:00:00Z`), defer reflection; open the AAPL Trade Detail (so it is mounted) and then click **Review**.

## Flows
1. In Review, enter price `105.00` in "Review mark price" and click **Record mark for review**. Status must become `Available` and a "Saved Mark: 105.00 on 2026-11-23" disclosure must appear. The input must show the saved value, not an empty box.
2. Click the **Trades** navigation button only (do not re-click the Trade row). The mounted detail must now show Expected Mark status `Available`, Marked P&L `45.00` and Ongoing risk `100.00` — no Missing from a stale snapshot.
3. Reload the page, open Review again and verify the saved Mark is still shown and its status is `Available`.
4. Change the Review mark price to `90.00`, record again, and verify it is a deliberate override in the IndexedDB `market` revision chain (two mark versions, newest effective), and that the Trade Detail (via Trades nav) shows Stop Overrun `50.00`.

For each flow report actions, observed result, PASS/FAIL. Capture screenshots for failures. Confirm you edited nothing; close the browser and stop the server when done. Local loopback only under DEV-001; not production HTTPS.
