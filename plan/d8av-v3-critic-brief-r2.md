# D8aV V3 — repeat critic brief

Independent read-only browser critic, round 2. Start the app yourself, drive the production UI, edit nothing. DEV-001 loopback only. Authority and exclusions as in `plan/d8av-v3-critic-brief.md`.

## Prior FAILs to re-verify
1. **Primary next action and stepper.** The day card now has an `Enter the Marks` primary button when a Mark is missing. Stepper states are derived from task families: with a Marks task open the row is `[now, '', '']`; with only Trades open it is `['ok', 'now', '']`; with only Debt/Settlement it is `['ok', '', 'now']`.
2. **Ordering and header figures.** `orderReviewItems` now receives `item.attention.band`, so a Blocker/Mark-due card sorts before an EvidenceLimited/acknowledged card. Each trade header now shows Marked P&L and Change figures, and the large planNow meter has a labelled `Stop … · Target … · Mark/no Mark` line.
3. **Close Review overlay.** The header `Back to the Review` button sits above the form in stacking order; the overlay body is a two-column hero + form layout, not a floating right drawer. The hero shows realized-to-date, a key-moment selector and a Replay control.
4. **Closed card status.** Saved, declined and deferred Close Reviews are read from the journal and shown on the Closed card; Write/Decline controls are hidden once an outcome exists.

## Regression guard
Re-check the round-1 PASS items: replay overlay read-only with all store counts unchanged, and the 480px one-column layout with no horizontal overflow. Also confirm acknowledgement vs exact Mark still differ and only the existing Mark command writes, and that a saved Close Review still agrees with the Closed detail.

Actions, observed evidence, PASS/FAIL per check. Any FAIL needs repro, expected vs actual, screenshot. Close browser and stop the server. Report exact browser/OS versions. Edit nothing.
