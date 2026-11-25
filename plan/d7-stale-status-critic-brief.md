# D7 defect-repair critic brief

A repeat critic observed (non-gating) that an already-mounted Closed detail kept showing `Outstanding Debt` after its deferred Close Review Debt was answered from Daily Review. Do NOT modify any file. Start the app yourself and drive the production UI.

## Setup
From the worktree root run `npm run dev` (port 5182). Use `playwright-cli` at `http://localhost:5182`. Fresh browser context: create one Institution and Account; confirm Long Stock AAPL (10 @ 100, stop 95, target 110, Thesis/Invalidation); record one opening Execution (10 @ 100, fee 5.00, `2026-11-20T20:00:00Z`, defer reflection); close all 10 @ 110.00 fee 4.00 with economic time `2026-11-23T20:00:00Z`, reason `Target Reached`, defer reflection. Closed detail shows realized P&L `91.00`.

## Flows
1. On the AAPL Closed detail, Start Close Review → Defer review → Save. Status must be `Outstanding Debt`.
2. Open Review. The Debt `CloseReview:trade-aapl-…` must appear under the Debt family with `Review TakeAgain`; choose `Yes, as planned` and click **Answer Close Review debt**. The Debt must disappear from Review.
3. Return to Trades **without reloading**. The still-mounted AAPL Closed detail must now show status `Saved` and a Journal narrative with exactly one `CloseReview:trade-aapl-… · Entry · Trade Close` row (answers `TakeAgain: Yes, as planned`). It must not show `Outstanding Debt`. Inspect IndexedDB: the Debt is `Settled` and one Entry with `definitionRevision: D1` exists.
4. Reload, reopen the Closed trade from the Closed trades list, and verify the same `Saved` status and single narrative row.

For each flow report actions, observed result and PASS/FAIL; screenshots for failures. Local loopback only per DEV-001; never production HTTPS. Close the browser and stop the server when done. Confirm you edited nothing.