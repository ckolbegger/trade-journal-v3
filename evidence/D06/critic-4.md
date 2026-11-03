# D6 browser critic 4

A fresh `general-purpose` agent, briefed as critic 3 was, ran this at commit `097d1cd9` on 2026-11-03. Below is its final report, recorded by the main session.

**Overall: incomplete.** Nine flows and the narrow-layout checks passed, and the critic found no defects. **C6.8 was not run**: the permission system refused three times to start `npm run serve:releases`. The user chose to allow `serve:releases` and have C6.8 run by a fresh critic of its own. It passed (`critic-4-c6.8.md`), so with this report every flow passes at `097d1cd9`.

## 1. Header

- **When:** 2026-11-03, about 16:00–16:17 EST.
- **Commit:** `097d1cd9`, branch `claude-opus-5.5`.
- **Versions:** Node v26.12.0, Playwright 1.63.0 (playwright-core 1.64.1), Chromium 153.0.8010.12.
- **Servers:** all on port 5175, each stopped at the end.

  | Server | Used for |
  |---|---|
  | `npm run build && npm run preview` | C6.1–C6.5, C6.7, C6.10 and the narrow layout (stopped for the offline step, then restarted) |
  | `npm run build:faults`, then `npm run preview:faults` | C6.6 and C6.9 (`dist-faults` was rebuilt, being older than the last code commit) |
  | `npm run serve:releases` | **Not run.** Refused three times by the permission system ("Interfere With Workloads", "Expose Local Services"). |

  - It did not run `build:releases` and never touched port 5181, `.cache/bench/` or `dist-releases/`.
- **Scratch work:** under `test-results/critic-d06-4/`.
- **Helpers:** used only for setup and probe reads, plus `enterMark` and `saveAction` on walked cards a flow doesn't name. Every exit and every owed-reflection answer in the Review was done by hand.
- **`git status --short` at the end:** only `?? .claude/settings.json`, present at the start. No tracked file was edited.

## 2. Results

| Flow | Result | Key observations |
|---|---|---|
| C6.1 Partial exit | PASS | Sell 30 @ 52.00, fee 0.60. No Closing section or Close Reason. Receipt: Open, "Realized to date +$55.90", one Lot Match "+$55.90". Detail: "Position 70 shares of XYZ", Open Lots 30 @ $50.10 and 40 @ $50.30. Fee reconciliation: allocated $0.50, unconsumed $1.50, disposal $0.60. |
| C6.2 Final exit | PASS | The Closing section appeared only at 70 shares. Closed, "+$248.00", "+0.99R", "Closed via sale of 100 shares" and a separate Close Reason "Target Reached". Four Lot Matches; fees reconcile to $4.00. Closed tab only. |
| C6.3 Close Review choices | PASS | Completed (Close Review Entry), declined ("Reflection declined / Reason: No reason given"; receipt "Close Review declined.") and deferred ("Close Review Reflection owed, Due in the next Review"). "Reflection owed" badge on the deferred Trade only. |
| C6.4 Close Review in the Review | PASS | **Tue 17:00:** owed Trades under "Trades with owed reflections", "Due in the next Review"; Complete while unanswered; one answered there. **Wed 17:00:** "1 reflection due", Incomplete with a blocker linking ABC, Complete once answered and after reload. Fully reflected Trades absent. |
| C6.5 Validation | PASS | "Only 100 shares are open." and "Choose a Close Reason." in the summary and beside their fields, marked invalid, values kept. Focus to the summary (D2's rule, T2.29). Nothing stored. |
| C6.6 Earlier-dated exit | PASS | Faults build. "Changed Lot Matches" listed Created, Revised and Created rows; "Realized to date before +$54.53", "after +$63.35". Detail's Lot Matches in FIFO, Economic Time order. No Lot-Match store. |
| C6.7 Exit from the Review (decision 72) | PASS | "Saved Action: Exit"; no exit link, button or form; facts unchanged. After the exit from Detail at 17:00, the Review shows "Closed after this session's close · Closed" and "Action Exit Saved". |
| C6.8 Update with migration | **NOT RUN** | `serve:releases` refused by the permission system. About on d6 shows "Schema version 5". |
| C6.9 Recovery Only | PASS | "Read only: this browser can't save right now". Closed list, Closed Detail and Open Detail readable; no Record entry, Record exit, Reflect or Decline controls; `?action=Sell` shows a not-available page. Stored data byte-identical. |
| C6.10 Offline, responsive, keyboard, About | PASS | An offline full exit saved (+$398.00, +1.99R). A half-filled exit kept every value at 375, 320, 959, 961 and 1280 px. A Trade closed by keyboard only with visible focus. About: D1–D6 capabilities only. |

**Narrow layout (375 and 320 px):** no page-level sideways scroll on the exit form (with Closing section and errors), both exit receipts, Open Detail with Lot Matches and Fee reconciliation, the Closed tab, Closed Detail, and the Review's owed card with its form open.

## 3. Defects

None among the flows run.

## 4. Minor observations

1. Validation focus goes to the error summary, not the first invalid field (D2's rule, T2.29), unlike a literal reading of C6.5 and B6.3. The critic suggests a decision.
2. At 375 and 320 px the Lot Matches table shows only Bought before scrolling inside its region, and its centred caption is clipped.
3. A declined Close Review reads "Close Review" plus "Reflection declined" on Detail, but "Close Review declined." on the receipt.
4. The Close Review and the exit's Position Change Reflection, at the same Moment, are ordered differently between Trades.
5. On a Review owed card with both reflections owed, both buttons are named "Reflect on 2026-10-12 15:00", so a screen reader can't tell them apart.
6. In Recovery Only, the `?action=Sell` route says "Record entry isn't available … an entry can't be recorded", not exit wording.
7. The receipt's Lot Matches lacks Detail's "Each match's amount is rounded to the cent for display." note.
8. Changed Lot Matches shows quantities before and after, not each match's realized amount (meets the pass condition).
9. A walked card whose Trade closed after the cutoff still offers "Change" on its saved Exit Action.
10. Reloading the exit receipt URL lands on Trade Detail.
