# D6 browser critic 1

A fresh `general-purpose` agent, briefed from `.claude/docs/critic-brief.md` (brief v2), ran this at commit `43bf78b3` on 2026-11-03. Below is its final report, recorded by the main session.

**Overall: FAIL.** All ten flows passed. There was one narrow-layout defect (Defect 1).

## 1. Header

- **When:** 2026-11-03, about 09:20–10:11 EST.
- **Commit:** `43bf78b3`, branch `claude-opus-5.5`.
- **Versions:** Node v26.12.0, Playwright 1.63.0, Chromium 153.0.8010.12. It used persistent profiles in America/New_York, through `profileAt` and `launchAt`.
- **Builds:** `npm run build`, `npm run build:faults` and `npm run build:releases`, all OK.
- **Servers:** all on port 5175, one at a time, each stopped afterwards. Nothing was listening at the end.

  | Server | Used for |
  |---|---|
  | `npm run preview` | C6.1–C6.5 and C6.7, and the setup for C6.10 (stopped mid-C6.10 for the offline step) |
  | `npm run preview:faults` | C6.6 and C6.9 |
  | `npm run serve:releases -- d5r2` | C6.8, switched to `d6` with key `8` |

- **Scratch work:** under `test-results/critic-d06-1/`. The critic did not read `evidence/`.
- **`git status --short` at the end:** only untracked files (`.claude/settings.json` and the `t6.28-gate` suite-run files). No tracked file was modified.
- **Helpers:** used only for onboarding, Plans, entries, the clock, the probe, `tabTo` and `watchForUpdatingMessage`. Every exit, Close Reason, Close Review, Mark, Action, Debt answer, update check and Reload was done by hand. No helper failed.

## 2. Results

| Flow | Result | Key observations |
|---|---|---|
| C6.1 Partial exit | PASS | Exit 30 @ 52.00, fee 0.60. One Lot Match: "$50.10 on 2026-10-12 10:00 / $52.00 on 2026-10-13 10:00 / 30 / +$55.90". Lifecycle Open, Realized to date +$55.90, no Close Reason asked. Detail shows Position "70 shares of XYZ" and Open Lots 30 @ $50.10 and 40 @ $50.30. |
| C6.2 Final exit | PASS | The "Closing the Trade" section appeared only once the 50 + 20 rows reached the open quantity. The receipt shows Closed, +$248.00, +0.99R, "Closed via sale of 100 shares" and Target Reached as separate fields. The Trade is in the Closed tab, not the Open one. Fee reconciliation: $4.00 incurred, $2.00 and $2.00 allocated. Every match amount was checked by hand. |
| C6.3 Close Review choices | PASS | Completed, declined and deferred: the receipts say "Close Review saved." / "Close Review declined." / "Close Review owed". The narrative shows the Entry, "Reflection declined" and "Reflection owed". |
| C6.4 Close Review in the Review | PASS | **Tuesday 17:00:** the Empty view plus "Trades with owed reflections", each "Due in the next Review". A card answered there leaves the group. **Wednesday 17:00:** Incomplete, "Reflection due for XYZ", then Complete after answering. A Trade reflected in full appears in neither Review. |
| C6.5 Validation | PASS | "Only 100 shares are open." and "Choose a Close Reason." appear beside their fields, which are marked invalid. Values were kept, and nothing was saved after reload. Focus went to the issue summary (D1/D2 convention; minor observation 3). |
| C6.6 Earlier-dated exit | PASS | Faults build, pinned clock. The receipt's changed-matches table lists Superseded, Created and Revised entries, with "Realized to date before +$113.17 / after +$141.85". Detail's Lot Matches follow FIFO in Economic Time order, checked by hand. |
| C6.7 Exit from the Review (decision 72) | PASS | The Review has no exit link or button. The Action recorded no trade. After the exit was recorded from Detail, Monday's Review still shows XYZ with "Action Exit Saved". |
| C6.8 Update with migration (d5r2 → d6) | PASS | "Updating your journal to this release" appeared. The data and the owed reflection are intact. A Trade closed after the update. About shows schema 5. The new Workspace pointer leaves one database and no candidates. |
| C6.9 Recovery Only | PASS | Banner "Read only: this browser can't save right now". The Closed list and Closed Detail are readable. There are no Record entry or exit controls and no reflection controls. The stored data was unchanged. |
| C6.10 Offline, responsive, keyboard, About | PASS | Offline reload worked, and an offline full exit survived a restart. A half-filled exit kept every value through 1280 → 375 → 320 → 1280 px. A Trade was closed by keyboard only, with a focus ring at every stop. About lists only D1–D6 capabilities and Schema version 5. |

**Narrow layout (375 and 320 px).** No screen scrolls the page sideways. Lot Matches and the Closed table scroll inside focusable regions. Fee reconciliation wraps money mid-number (Defect 1).

## 3. Defects

**Defect 1. Fee reconciliation splits money figures across lines on narrow screens.** Severity: medium (layout only, but a figure can be misread).
- **Steps:** open a Trade Detail that has Lot Matches at 375 px, then at 320 px, and go to "Fee reconciliation".
- **Expected:** each amount stays whole and right-aligned. The ui-contract specifies "right-aligned, tabular numerals for Money" and readable reflow.
- **Actual:**
  - At 375 px, "$0.4" appears on one line with "0" on the next ("Opening fees allocated to Lot Matches"), and "$0.50" splits the same way.
  - At 320 px, "Opening fees unconsumed" also splits, and so does a Closed Trade's "$2." / "00".
  - Screenshots: `test-results/critic-d06-1/shots/n-fee-DEF-375.png` and `n-fee-320.png`.

## 4. Minor observations

1. **The owed Close Review is never named on Review cards.** It reads like a Position Change Reflection ("Position Change at … / Sell 100 JKL @ $21.00 / Reflect on …"). The "Reflection" form has no heading. Trade Detail does label it "Close Review".
2. **A91 is not shown on walked cards.** A walked card of a Trade that closed after the cutoff shows nothing about the close: no "Closed after this session's close". C6.7 does not require it.
3. **Validation focus goes to the issue summary, not the first field** (D1/D2 convention). The summary entries are not links to their fields.
4. **The C6.6 change table gives quantities only.** It shows quantity before and after for each match; realized P&L before and after appears only as the Trade's "Realized to date".
5. **Lot Matches rows can look identical.** Two Sells in one Position Change produce rows with nothing to tell them apart.
6. **Declined wording differs.** The Detail narrative shows "Close Review" with "Reflection declined", while the receipt says "Close Review declined."
7. **Close Review sort order.** In the journal, the Close Review sorts above the terminal exit's Position Change Reflection, although both have the same moment.
8. **Stray legend in the Review.** Wednesday's Review, with no walked Trade but a due owed reflection, shows the "Stop ◂ ▸ Target" legend and an empty "Positions" list.
9. **Text runs together.** The receipt reads "Reflection owedClose Review owed", and Detail reads "Position Change ReflectionReflection owed", with no separator.
10. **The exit form header reads "100 of 100 shares entered"** even when only 70 are open. The open quantity is not stated on the form.
11. **Lot Matches cells wrap at 320 px.** Dates break at hyphens, and the Realized column starts off-screen inside its scroll region.
12. **From earlier deliverables, not D6:** in Recovery Only, the empty Open list still says "Recording an entry on a Planned Trade opens it."
