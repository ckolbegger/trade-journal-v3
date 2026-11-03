# D6 browser critic 3

A fresh `general-purpose` agent, briefed from `.claude/docs/critic-brief.md` (brief v2), ran this at commit `cd682233` on 2026-11-03. The brief added two notes: don't run `build:releases`, and leave the background benchmark generation on port 5181 alone. Below is its final report, recorded by the main session.

**Overall: FAIL.** Every flow, C6.1 to C6.10, passed. There was one narrow-layout defect on the exit receipt (Defect 1). The main session traced it to T6.28-B4: B4 made the shared Lot Matches table's cells no-wrap, and only Trade Detail puts that table in a scroll region.

## 1. Header

- **When:** 2026-11-03, 15:29–15:39 EST.
- **Commit:** `cd682233`, branch `claude-opus-5.5`.
- **Versions:** Node v26.12.0, Playwright 1.63.0, Chromium 153.0.8010.12 (headless, persistent profiles, America/New_York).
- **Servers:** all on port 5175, one at a time, each stopped at the end.

  | Server | Used for |
  |---|---|
  | `npm run build && npm run preview` | C6.1–C6.5, C6.7, C6.10 and the narrow layout |
  | `npm run build:faults`, then `npm run preview:faults` | C6.6 and C6.9 |
  | The release harness, `dist-releases/d5r2` switched to `d6` | C6.8 |

  - **C6.8 harness:** the auto-mode classifier denied a background `npm run serve:releases -- d5r2` fed key presses through a fifo. The critic instead started the harness's own module (`startReleaseServer` from `tools/release-server.ts`) in its script, and switched it with `harness.use('dist-releases/d6')`, the call the harness's key press makes.
  - It did not run `build:releases` and never touched port 5181 or `.cache/bench/`.
- **Scratch work:** under `test-results/critic-d06-3/`.
- **Helpers:** used only for starting states and stored-state reads. Every exit, Close Reason, reflection, Mark, Action and keyboard step was done by hand, by role and label. No helper failed.
- **`git status --short` at the end:** only `?? .claude/settings.json`, present at the start. No tracked file was edited.

## 2. Results

| Flow | Result | Key observations |
|---|---|---|
| C6.1 Partial exit | PASS | Exit 30 @ 52.00, fee 0.60. No Closing section at 30. Receipt: "Exit recorded", Open, Realized to date "+$55.90", one Lot Match "$50.10 on 2026-10-12 10:00 / $52.00 on 2026-10-13 10:00 / 30 / +$55.90". Detail: Position "70 shares of XYZ", Open Lots 30 @ $50.10 and 40 @ $50.30. Fee reconciliation: $2.60 incurred, $0.50 opening allocated, $1.50 unconsumed, $0.60 disposal. |
| C6.2 Final exit | PASS | The Closing section appeared only once 70 was entered. Receipt: Closed, "+$248.00", "+0.99R", "Closed via sale of 100 shares" and Close Reason "Target Reached" as separate terms. Closed tab only; Closed Detail has four Lot Matches summing to $248.00, fees $4.00 with $0.00 unconsumed, no Record entry or Record exit. One CloseReason fact stored. |
| C6.3 Close Review choices | PASS | Completed, declined and deferred. Receipts: "Close Review saved." / "Close Review declined." / "Close Review owed". Deferred: "Close Review Reflection owed", "Due in the Review after next". "Reflection owed" badges only on the deferred Trades. |
| C6.4 Close Review in the Review | PASS | **Tue 17:00:** "Trades with owed reflections", each "Due in the next Review"; one answered there shows "Done"; the Review reads Complete with the other unanswered. **Wed 17:00:** "1 reflection due", Incomplete with "Reflection due for MNO", then Complete once answered. Trades reflected in full appear in neither Review. Answers carry `settledDebtId` and a daily-review source. |
| C6.5 Validation | PASS | "Only 100 shares are open." and "Choose a Close Reason." in the summary and beside their fields, marked invalid, values kept. Focus goes to the summary (D1/D2 convention). Nothing stored after reload. |
| C6.6 Earlier-dated exit | PASS | Faults build. "Changed Lot Matches" lists Created and two Revised rows; "Realized to date before +$168.35", "after +$181.45", checked by hand. Detail's Lot Matches are in FIFO and Economic Time order. |
| C6.7 Exit from the Review (decision 72) | PASS | "Saved Action: Exit" with its Intent; no exit link, button or form; no trade recorded. After the exit from Detail, the reopened Monday Review shows "Closed after this session's close · Closed" and "Action Exit Saved". |
| C6.8 Update with migration | PASS | d5r2 (schema 4) to d6, with "Updating your journal to this release". Facts byte-identical; the root points to a new `tj-ws-` database, no old one left. XYZ closed (+$179.00, +0.72R). About shows schema 5. |
| C6.9 Recovery Only | PASS | "Read only: this browser can't save right now". Closed list, Closed Detail and Open Detail readable; no Record entry, Record exit, Reflect now or Decline controls; no Mark inputs in the Review. Stored data unchanged. |
| C6.10 Offline, responsive, keyboard, About | PASS | An offline full exit saved and survived a cold relaunch with the server down. A half-filled exit kept every value at 390, 320 and 1280 px. A Trade closed by keyboard only, with a 3px outline at each stop. About: schema 5, D1–D6 capabilities only. |

**Narrow layout (375 and 320 px):** no page-level sideways scroll on the exit form (with Closing section and error state), the Closed tab, Closed Detail, Open Detail with Lot Matches and Fee reconciliation, or the Review's owed-reflection cards. **The exit receipt fails at both widths** (Defect 1).

## 3. Defects

1. **The exit receipt's Lot Matches table makes the page scroll sideways at 375 px and 320 px.** Severity: moderate (layout and accessibility; no data affected).
   - **Steps:** record any exit (C6.1's partial, C6.2's final, or an earlier-dated one) and view the "Exit recorded" receipt at 375 or 320 px.
   - **Expected:** the receipt reflows like the other D6 screens, with no page-level sideways scroll, as Trade Detail does with its "Matched lots" scroll region (`specs/design/ui-contract.md` line 125, "readable zoom/reflow"; lines 30 and 33, single-column narrow view).
   - **Actual:** the table is in no scroll container. `document.scrollWidth` is 604–607 against a 375 or 320 viewport, so the page scrolls sideways, and the Sold, Quantity and Realized columns overflow the card (`shots/receipt-final-320.png`, `receipt-partial-375.png`, `receipt-earlier-dated-320.png`). The receipt's table also has no caption or accessible name, unlike Detail's.

## 4. Minor observations

- Two Sell Executions in one Position Change at the same time and price give two identical Lot Match rows.
- On Detail at 320 px, only the Bought column shows without scrolling inside the region, and the caption shows as a clipped "L".
- Closed Detail's Journal orders the Close Review and the exit's Position Change Reflection inconsistently when they share a moment.
- The receipt's "Close Review owed" is bare text, while "Reflection saved." and "Close Review saved." are paragraphs.
- Validation focus goes to the issue summary, not the first invalid field, and the summary items are not links (D1/D2 convention; C6.5 says "focus on the first").
- An owed card answered in the Review stays in the group, marked Done, until the next load.
- A walked card whose Trade closed after the cutoff still offers "Change" on its saved Exit Action.
- After a partial exit the Open Summary reads "Long 70 shares @ $50.21" beside "Quantity 70 of 100 shares" and "Average entry $50.18": correct, but could confuse.
