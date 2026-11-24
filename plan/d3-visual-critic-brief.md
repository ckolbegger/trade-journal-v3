# D3 visual-fidelity critic brief

Follow-up critic after a reported defect: the first D3 UI read as a functional scaffold rather than the prototype's visual language. Do NOT modify any file. Start the app yourself, drive the production UI with `playwright-cli`, and report.

## Frozen baseline
`plan/freeze.md` rev `c5d28a8a`, `plan/d3-task-breakdown.md`, `specs/design/ui-contract.md` (Visual language, Forms and evidence capture, Trade and Journal presentation), `specs/reference/ui-screenshots/index.md`, `plan/deviations.md` (DEV-001). Prototype screenshots are visual references only: never copy their "adherence", `+$0`/`+0%`, "Close position", Insights, stock multiplier arithmetic or prototype nav labels. Domain semantics always win.

## Start
From the worktree root, run `npm run dev` (port 5182 from `.env.local`). Use `playwright-cli` at `http://localhost:5182`: `open`, `snapshot` for refs, then `click`/`fill`/`check`/`eval`/`resize`/`reload`. Close the browser and stop the server when finished.

## Fixture
Fresh context. Create one Institution and Account through the UI. Confirm a Long Stock Plan (AAPL, qty 10, entry 100, stop 95, target 110, Thesis/Invalidation). Open its Planned detail.

## Flows
1. **Visual language — list.** The Trades screen uses a warm cream page ground (`#f5f2ea`) and white rounded cards with quiet borders. Planned and Open rows are rounded white cards with a monogram circle, title, subtitle, small-caps section labels and a compact semantic lifecycle badge. Open rows show right-aligned tabular figures.
2. **Visual language — Planned detail.** Card hierarchy: headline card with underlying, Planned badge, 1R/Plan R:R figures; a Plan Reflection card; an outlined "Add execution" action. No "adherence", close control, Mark or fake valuation.
3. **Add Execution sheet.** "Add execution" opens a bottom sheet on narrow and a right-hand drawer on wide, over a dimmed page, with a small-caps "ADD EXECUTION" label, a pill "Buy" action chip, two-column quantity/price and fee/economic-time fields, pill radio chips for Defer/Decline/Complete reflection, a Cancel action and a black primary "Record position change" button. Enter two Executions (6 @ 100.00 fee 3.00; 4 @ 102.50 fee 2.00), defer, and submit.
4. **Open detail.** Card hierarchy: headline card with underlying, Open badge, large right-aligned tabular Position figure, and labelled Open lots / Allocated opening fees / Realized to date figures; separate Executions and Open Lots cards with tabular numerals. Values: 10, 2 open lots, 5.00, 0.00, both lots with basis and allocated fee. No valuation, Mark, close control or closing Lot Match.
5. **Behaviour not regressed.** Defer creates one Debt with a `PositionChange:` obligation key and trigger-time definition snapshot in IndexedDB, no blank Entry; the factual Open state persisted. Reload and confirm the display matches durable state.
6. **Responsive and evidence capture.** At 1200px and 480px the sheet is a drawer and a bottom sheet respectively; layout switches live without reload, preserving unsaved values and the selected reflection chip. Cancel records nothing; typed errors are visible and non-colour-only.

For each flow: actions performed, observed result, PASS/FAIL. Failures need repro steps, expected vs actual and a screenshot. Report exact browser/OS versions. Missing future capabilities are not defects; anything in these flows that fails is. Close browser, stop server, edit nothing.
