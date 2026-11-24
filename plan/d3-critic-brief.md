# D3 browser-critic brief

Independent critic for Deliverable 3 (Open a Long Stock position). Do NOT modify any implementation or test file. Start the app yourself, drive the production UI, and return a structured report.

## Frozen baseline
`plan/freeze.md` rev `c5d28a8a`, `plan/vertical-deliverable-plan.md` (Deliverable 3), `plan/acceptance-evidence-matrix.md`, `plan/d3-task-breakdown.md`, `plan/deviations.md` (DEV-001), `specs/acceptance/acceptance-contract.md`. Local `http://localhost:5182` is valid loopback evidence under DEV-001; it is never production HTTPS evidence.

## Installed capabilities in D3
Everything from D1/D2 plus: record opening Executions as one Position Change from a Planned detail; `TradeAnalysis.derive` showing Instrument Position, open Lots, allocated opening fees and realized-to-date; stored Lifecycle `Open` with index membership; Position Change Reflection completed, declined or deferred as Journal Debt with no blank Entry. No valuation, Mark, Daily Review, Report, Backup/Restore, Execution-as-a-separate-operation, or close control is installed.

## Start
From the worktree root, run `npm run dev` (port 5182 from `.env.local`). Use `playwright-cli` against `http://localhost:5182`. Begin with `playwright-cli open http://localhost:5182`, then `playwright-cli snapshot` to obtain refs; interact by ref with `click`, `fill`, `check`, `eval`, `resize`, `reload`. Close the browser and stop the server when finished.

## Fixture
Start from a fresh browser context. If absent, create one Institution and one Account through the UI. Confirm one Long Stock Plan (AAPL, qty 10, entry 100, stop 95, target 110, Thesis/Invalidation filled). Then open the Planned trade's detail.

## Flows
1. **Grouped opening decision.** Click "Add execution"; enter two Executions (6 @ 100.00 fee 3.00 and 4 @ 102.50 fee 2.00, both instrument AAPL, same Economic Time); use "Add another execution" for the second; defer the reflection; click "Record position change". Confirm an Open trade appears in the Open trades list without refresh and its detail shows Lifecycle Open, Position 10, 2 open Lots, allocated opening fees 5.00, realized-to-date 0.00, and both Executions with their own entries.
2. **Reflection Defer is not writing.** After a deferred record, inspect the IndexedDB `journal` store with `playwright-cli eval`: there is one `Debt` with a `PositionChange:` obligation key and trigger-time definition snapshot, and no blank `Entry`. The factual Open position was still stored.
3. **Reflection validation and Decline.** Enter a new Planned Trade; choose "Complete reflection" and submit with no Decision mode — expect a typed inline error naming DecisionMode and no new Open trade. Then choose "Decline reflection" with a reason and submit — the fact records and an explicit decline outcome exists (no Entry, no Debt).
4. **Capability honesty.** Navigation contains only Institutions & Accounts, Workspace, New Plan, Trades. No Mark, Review, Report, Backup, Restore, close control, or Execution-as-a-separate-operation is present. No fake Unavailable placeholder for an undelivered capability. Planned detail exposes "Add execution" only; Open detail has no Add execution, Mark, or close control.
5. **Durability and honesty.** Reload the page and confirm the Open trade, its Lots/fees and its reflection outcome persist; stored and displayed values agree. No valuation or closing Lot Match appears anywhere.
6. **Responsive.** At 1200px then 480px, the layout switches live without reload; an entered-but-unsaved Execution value and the chosen reflection disposition survive the resize.

For each flow: actions performed, observed result, PASS/FAIL. Any failure needs repro steps, expected vs actual, and a screenshot. Do not treat missing future capabilities as defects. Close the browser, stop the server, and edit nothing.
