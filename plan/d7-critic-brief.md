# D7 browser-critic brief

Independent critic for Deliverable 7 (Close Review). Do NOT modify any file. Start the app yourself, drive the production UI, return a structured report.

## Frozen baseline
`plan/freeze.md` rev `c5d28a8a`, `plan/vertical-deliverable-plan.md` (D7), `plan/d7-task-breakdown.md`, `specs/design/journal.md` (initial Close Review definition, Anchor/Source, obligation/debt semantics), `specs/design/trade-workflows.md`, `specs/adr/0005-journal-entry-and-journal-debt-are-separate.md`, `specs/acceptance/acceptance-contract.md` (AC-JOUR-001/002/003/005, AC-POS-004), `plan/deviations.md` (DEV-001). Loopback evidence only; never relabel it production HTTPS.

## Installed capabilities in D7
D1–D6 plus: a Close Review on a Closed Trade detail with its own `CloseReview:<tradeId>` obligation key, exact D1 definition (three prompts), Complete → immutable Entry with Source Trade Close, Defer → Outstanding Debt due at the next Review, Decline → distinct JournalDecline; answering a deferred Debt against its original snapshot; one outcome per obligation; and a deduplicated Journal narrative in the Closed detail. Edit, Addendum, Void, options, settlement, provider, reports, backup and restore remain uninstalled. The close itself still writes no Close Review and no Trade fact is written by any Close Review outcome.

## Start
From the worktree root run `npm run dev` (port 5182). Use `playwright-cli` at `http://localhost:5182`: `open`, `snapshot` for refs, then `fill`/`click`/`check`/`select`/`eval`/`reload`. Close browser and stop server when done.

## Fixture
Fresh browser context. Create one Institution and Account. Confirm a Long Stock Plan AAPL (10 @ 100, stop 95, target 110, Thesis/Invalidation). Record one opening Execution (10 @ 100, fee 5.00, economic time `2026-11-20T20:00:00Z`), defer reflection. Close all 10 @ 110.00 fee 4.00 with **economic time `2026-11-23T20:00:00Z`**, reason `Target Reached`, deferring the Position Change Reflection. The Closed detail shows realized P&L `91.00`. Use a fresh Trade (different underlying) for each independent disposition flow, because an obligation has exactly one outcome.

## Flows
1. **Capability honesty and no-write-on-leave.** Close Review is offered only on a Closed detail, not in navigation; no provider/report/backup/restore/option control appears. Open the form, select values, navigate to Review and back, reopen the Closed Trade: no Close Review journal row exists and the form starts clean.
2. **Complete.** Save a Complete review with `No` / worked / lesson. Exactly one `entry-CloseReview:<tradeId>` row exists: `kind: Entry`, `definitionRevision: D1`, `source: Trade Close`, snapshot with all three D1 prompts and role-keyed answers, one Trade Anchor, origin `{kind: TradeClose}`. No Debt, no Decline, no Close Reason or other Trade fact changed. Retrying does not create a second row.
3. **Defer becomes due Debt at the next Review.** Save Defer: one Outstanding Debt with the trigger-time D1 snapshot, `dueSemantics: DueAtNextDailyReview`, `dueAt: 2026-11-23`, and no blank Entry. Open Review: the Debt appears under the Debt task family and Review is `Incomplete` with `DebtDue`. Answer it from Review with `Yes, as planned`: an Entry is created against the original D1 snapshot and the Debt is Settled atomically; the Debt no longer appears in Review.
4. **Decline.** Save Decline with a reason: exactly one `JournalDecline` row with that reason and no Entry or Debt.
5. **Deduplicated narrative and durability.** After a completed review, reload, open the Closed trades list and reopen the Trade: the Journal narrative lists `CloseReview:<tradeId>` exactly once with Entry / Trade Close / answers, and the Close Review status is `Saved`. Separate obligations (Position Change Reflection, Daily Review) are not duplicated.
6. **No stale status on a newly closed Trade.** Without reloading, complete a Close Review on one Trade, then create and close a second Trade of a different underlying. The auto-opened Closed detail must show `Not started`, an empty Journal narrative, and a working **Start Close Review** button — never the previous Trade's status or narrative. Reloading must not be required.

For each flow: actions, observed result, PASS/FAIL; failures need repro, expected vs actual and a screenshot. Missing future capabilities are not defects; anything in these flows that fails is. Close browser, stop server, edit nothing. Report exact browser/OS versions.
