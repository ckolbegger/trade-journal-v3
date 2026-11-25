# D6 browser-critic brief

Independent critic for Deliverable 6 (Close a Long Stock position). Do NOT modify any file. Start the app yourself, drive the production UI, return a structured report.

## Frozen baseline
`plan/freeze.md` rev `c5d28a8a`, `plan/vertical-deliverable-plan.md` (D6), `plan/d6-task-breakdown.md`, `specs/design/trade-analysis.md`, `specs/design/trade-record.md`, `specs/design/trade-workflows.md`, `specs/adr/0003-authoritative-lifecycle-and-derived-disposition.md`, `specs/acceptance/acceptance-contract.md` (AC-LIFE-001, AC-POS-001, AC-POS-004, AC-JOUR-003, AC-RESP-001), `plan/deviations.md` (DEV-001). Loopback evidence only; never relabel it production HTTPS.

## Installed capabilities in D6
D1–D5 plus: terminal Long Stock `recordPositionChange`, FIFO Lot Matches, lot-aware opening/disposal fees, realized P&L, exactly one seeded Close Reason for trader agency, derived Terminal Disposition ("Closed via"), stored `Closed` lifecycle with same-commit index move, Closed trades list/detail, and the Position Change Reflection for the closing decision. Close Review, options, settlement, provider recovery, reports, backup and restore remain uninstalled.

## Start
From the worktree root run `npm run dev` (port 5182). Use `playwright-cli` at `http://localhost:5182`: `open`, `snapshot` for refs, then `fill`/`click`/`check`/`eval`/`reload`. Close browser and stop server when done.

## Fixture
Fresh browser context. Create one Institution and Account. Confirm a Long Stock Plan AAPL (10 @ 100, stop 95, target 110, Thesis/Invalidation). Record **two** opening executions as one decision: 6 @ 100 fee 3.00 and 4 @ 102.50 fee 2.00, economic time `2026-11-24T20:00:00Z`, defer reflection. The Open detail must show 10 shares, 2 lots, 5.00 opening fees. Use a fresh Trade (different underlying) for the independent invalid-close flow because close facts are sticky.

## Flows
1. **Capability honesty.** Close is offered only on an Open detail as an action, never as a navigation entry. Navigation is Accounts, Status, New Plan, Trades, Review. No provider configuration/recovery, report, backup, restore, Close Review form, option strategy or settlement control appears. The Close sheet offers only the five seeded Close Reasons (Target Reached, Stop Triggered, Thesis Invalidated, Time-Based Exit, Rolled).
2. **Invalid close writes nothing.** Open the Close sheet, fill the disposal fields but leave Close Reason on "Choose…", submit. A visible, non-colour-only prose alert names the Close Reason. Inspect IndexedDB: the Trade is still `Open` at revision 2, no `lotMatches`, no `closeReason`, no close Debt, and the lifecycle index still lists it under Open.
3. **FIFO, fees, realized P&L and disposition.** On a fresh fixture, close all 10 shares at 110.00 with fee 4.00, reason `Target Reached`, deferring reflection. The Closed detail shows realized P&L **81.00**, two FIFO Lot Matches (6 then 4 shares) with allocated opening fees 3.00/2.00 and disposal fees 2.40/1.60, Close Reason `Target Reached`, and "Closed via" `FullyDisposedByExecution` — separate facts, not one composite label. Inspect IndexedDB: the Trade is `Closed` at revision 3, `lotMatches` carries only link/quantity/method/fee fields (no copied price, basis or P&L), the lifecycle index moved it from Open to Closed in the same commit, and one `Debt-close-…` Position Change Reflection outcome exists with no Close Review obligation. No price or P&L was duplicated onto a match. The stored `agreement` must be `{ lifecycle: true, lots: true, findings: [] }` — a normal close must not manufacture a `StoredLotDisagreement` finding.
4. **Closure never waits for reflection; reload durability.** Repeat a close with the reflection **Declined** (reason "nothing to add"). The Trade closes immediately; no blank Entry is written. Reload, open the Closed trades list, reopen the Trade: lifecycle `Closed`, realized P&L, Close Reason, FIFO matches and the reflection outcome all match durable state. The former Trade is absent from Open trades.
5. **Reflection independence and no write on leave.** Open a Close sheet on a fresh Open Trade, enter values and a Close Reason. The sheet has a working **Cancel** button and a clickable backdrop that both close it. Click Cancel, then navigate to Review and back, select the Trade: the sheet must not auto-open. Click **Close position** again: the form starts clean (empty fields, "Choose…" reason, Defer selected). Nothing was written and the Trade remains Open throughout.

For each flow: actions, observed result, PASS/FAIL; failures need repro, expected vs actual and a screenshot. Missing future capabilities are not defects; anything in these flows that fails is. Close browser, stop server, edit nothing. Report exact browser/OS versions.
