# D8aV V1 follow-up — underlying Mark visibility: critic brief

Independent read-only browser critic. Start the app yourself, drive the production UI, edit nothing. DEV-001 loopback only (`http://localhost:5182`). Authority as in `plan/d8av-v1-critic-brief.md`; no adherence numbers or composite scores.

## Defect being fixed
A Mark recorded in Review for a Long Call is stored against the underlying (`AAPL`), while Complete Detail reads frames for the option contract (`AAPL 190Call 2026-12-18 x100`). The cockpit therefore said `No Mark yet` and Price History showed `Call Mark — / Missing` with no error. The fix exposes the underlying session series in the read and presents it as an `Underlying Mark` row and Conditions line; it must **not** relabel it as a Call Mark or feed the comparison table.

## Flows
1. **Your exact path.** Onboard Schwab/Main, create Long Call `AAPL 190Call 2026-12-18` (entry 3.00, stop 1.00, target 7.00, qty 2), open it with an execution (2 @ 3.00, 2026-11-23T20:00Z, Defer reflection). Open Review, enter `Review mark price` 90, `Record mark for review`. Confirm status `Available`. Go to Trades → Complete detail. Report the exact Conditions text and Price History table rows. Expected: Conditions contains `Underlying Mark: 90 on 2026-11-23`; Price History has `Underlying Mark` row with `90`, then `Call Mark` row with `—`, `Status`, `Trade P&L`. No `Mark 90` presented as a Call Mark.
2. **No fabricated Call Mark.** Today drawer must still show `No Marks yet`, no `table.cmp`, no previous/now track markers. Rail must still say `No Mark yet` for the call side (the underlying line is a separate labelled fact). Confirm payoff/break-even still comes only from the plan.
3. **Back to Review and read-only.** Return to Review via the nav button and via a full `page.reload()`; the Review mark status must remain `Available` with no `Missing` text. Check `trade`, `journal`, `market` counts unchanged across the whole path.
4. **Regression.** Re-check the V1 mechanisms: two-column cockpit, sticky four-card rail, six tabs, integrity banner behaviour, six canonical figure labels, 480px no horizontal overflow on every tab, and no `adherence|composite|grade|ohlc` text.

For each flow: actions, observed evidence, PASS/FAIL. Any FAIL needs repro, expected vs actual and a screenshot. Report exact browser/OS versions. Stop the server and close the browser. Edit nothing.
