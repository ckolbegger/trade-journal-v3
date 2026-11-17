# D08R critic-2 report

## 1. Header
- **When:** Tue 2026-11-17, about 10:45 to 11:35 EST.
- **Commit tested:** `949e4aef`. I built `dist` from it at the start of the run. When I finished, HEAD read `06200ded`, so another session committed to this worktree while I worked. I did not rebuild, and every observation below is from the `949e4aef` build.
- **Versions:** Node v26.12.0, Playwright 1.63.0, Chromium 153.0.8010.12 (headless). Clock pinned through `launchAt` and `pinClock`, zone America/New_York.
- **Server:** I ran `npm run build`, then `npm run preview -- --port 5175 --strictPort`, both inside one `.claude/scripts/with-browser-lock.sh` call that held the lock for the whole session. At the end I stopped my own PIDs 42528 (vite) and 42464 (npm). Port 5175 is now free, and the lock wrapper exited with 143 (TERM), as expected.
- **Tracked files:** none edited, nothing committed, and `git status` is clean. Scratch scripts, profiles and screenshots are in `test-results/critic-d08r-2/`, which git ignores.
- **Helper problem, reported as an observation:** `e2e/d8r/` does not exist on this branch. Its helpers (`buildOc3Plus`, `buildOs2x`, `addK1`, `openBreachedStockTrade`, the clock constants, `ALL_DRAWERS`) are missing. T8R.27's commit `f1e5fe8a` is not an ancestor of HEAD. In `e2e/d8p/support.ts`, `buildOc3` has no `correctedWednesdayXyz` option, and `confirmOc3` and `at` are not exported. I built the starting states myself with the D8P, D7 and D4 helpers:
  - **O-C3:** `buildOc3` with the Thursday Hold.
  - **O-C3+:** I recorded Buy 1 @ 3.30 at Fri 10-16 11:00 (fee 0.65) through the entry form.
  - **O-S2X:** D7's O-S (MNO Nov 20 $45 Put), Fri 11-20 Marks of put $0.05 and MNO 45.50, then MNO 44.25 on Mon 11-23. The MNO Marks came through a companion MNO stock Trade's Review card, since the Review no longer asks for the expired contract's Underlying.
  - **Closed by expiration:** O-S2X with its expiration recorded on Mon 11-23.
  - **K1:** NVDA Dec 18 $150 Call bought @ 8.00 on Mon 11-9, with Mon Marks of call 8.50 and NVDA 146.00, then sold in full @ 12.40 on Fri 11-13 at 11:00. The Fri NVDA Mark of 151.20 came later, through a companion NVDA stock Trade.
  - **Breached stock Trade:** XYZ 100 @ 50, Stop 47.50, Target 56, with a Mon Mark of 47.00.
  - **Before first Marks:** O-C3's Plan and entry only.
  - **Partial Marks:** O-C3 copies with only one of Friday's two Marks entered, or one of them acknowledged.

## 2. Results

| Flow | Result | Key observations |
|---|---|---|
| C8R.1 One place for each figure | PASS | **Open Trade:** O-C3 at Thu 18:00, all six drawers. **O-C3+:** at Fri 12:00. Every repeat I found is on the accepted list:<br>• The rail's $218.05 and "+$30.00 since Wed Oct 14" repeat in Price History's latest session and on the Journal card.<br>• "$2.20 away" and "2.10 away" appear on the rail and in Plan and Risk.<br>• Incurred fees appear in Position and in the Fee reconciliation.<br>• Entry Quality's 2.97 sits beside the Plan Baseline's 3.<br>• The Trade Summary line repeats.<br>• The Plan's Stop and Target rows stay (audit L5).<br>**Absent:** "Expected Mark Date", "Deviation active", "nearest", any footer, "At entry", "Distance on", "At the … Marks". I checked these against the whole DOM text, hidden panels included, on seven states. "Opening fees" survives only inside the Fee reconciliation ("Opening fees incurred"). |
| C8R.2 Today on every state | PASS | **Open (O-C3):**<br>• Thu 18:00: "Today, Thu Oct 15" 57.90 / $3.20; "Yesterday, Wed Oct 14" 57.40 / $2.90; Change +0.50 / +$0.30.<br>• Fri 12:00: Today "—"; Yesterday Thu 57.90 / $3.20; Change "—".<br>• Sat 10:00: "Next session, Mon Oct 19" and "Yesterday, Fri Oct 16", every cell "—", with the Stale context line.<br>• Mon 10-12 12:00, before the first Marks: "Today, Mon Oct 12", "Yesterday, Fri Oct 9", every cell "—", beside the "No Marks yet …" note.<br>**Settlement Due (O-S2X):**<br>• Fri 11-20 18:00, expiration evening: Today Fri 45.50 / $0.05; Yesterday Thu Nov 19 "—" / "—".<br>• Sat 11-21: "Next session, Mon Nov 23" MNO "—", Put "Expired"; Yesterday Fri 45.50 / $0.05.<br>• Mon 11-23 18:00: 44.25 / 45.50 / −1.25; Put "Expired" / $0.05 / "—".<br>• Tue 12:00: "—" / 44.25, Put Expired / Expired.<br>• Wed 11-25: all "—" and "Expired".<br>• No price tracks in any of these.<br>**Closed by sale (K1):**<br>• "Closed" stamp; "Today, Fri Nov 13" column empty.<br>• "Exit Fri Nov 13": Call $12.40, NVDA "—" until Friday's NVDA Mark exists, then 151.20 (decision P1).<br>• Sat: "Next session, Mon Nov 16". Change "—" throughout.<br>**Closed by expiration:** "Expired Fri Nov 20": MNO 45.50, Put "Expired"; Today column empty; "Closed" stamp.<br>**Stock Trade:** "XYZ Mark" row, $47.00 Mon; Tue "—" / $47.00.<br>I saw no carried-forward value in any cell. |
| C8R.3 Rail and Plan and Risk | PASS (Defect 2 applies) | **O-C3 at Thu 18:00:**<br>• Rail: "Stop · $2.20 away", "Target · 2.10 away", no Worst case or Max reward.<br>• Plan and Risk: "Risk to stop $220.00 · 1.10R", "Reward to target $180.00 · 0.90R", Value at expiration $5.00, "Worst case: $320.00 · 1.60R if the call expires worthless".<br>**Breached stock Trade, Mon 18:00:**<br>• Rail: "Stop · Breached · $0.50 past", "Target · $9.00 away".<br>• Plan and Risk: "Risk to stop $50.00 · 0.20R past", "Reward to target $900.00 · 3.60R".<br>**Stock Trade, Tue (Mark missing):**<br>• Rail: "Mark missing: XYZ, Tue Oct 13", then "−$301.00 at the Mon Oct 12 Mark".<br>• Rows: "Breached · $0.50 past · Mon Oct 12 Mark".<br>**Option on Sat:**<br>• "+$218.05 at the Thu Oct 15 Marks".<br>• "$2.20 away · Thu Oct 15 Marks".<br>**Before the first Marks:** Plan and Risk cells read "Awaiting the Mon Oct 12 close"; Position's Open P&L reads "Awaiting the Mon Oct 12 close". |
| C8R.4 Journal and Deviations | PASS | **O-C3+ at Fri 12:00:**<br>• Journal shows "1 active Deviation." plus the button "See Plan and Risk".<br>• Entries read "Position Change · Fri Oct 16, 11:00 am" and "Daily Review · Thu Oct 15, 4:00 pm". No Review Date, Anchor, Source, Moment or Authored rows.<br>**Pressing the button** (Enter key, and again by click) selects the Plan and Risk tab and moves focus to the H2 "Deviations" (tabindex −1).<br>**Plan and Risk group order:** Plan, Since the last Marks, Conditions, Plan Baseline, Entry Quality, Planned-Leg Fulfillment ("Filled with Deviation"), Deviations.<br>**Since the last Marks:** "New lots 1 contract · Average price of new lots $3.30 · Risk from that price $230.00 · 1.15R · Reward from that price $170.00 · 0.85R". It is hidden before the first Marks.<br>**Track:** the entry dot sits exactly midway between the ticks "$2.00 · Mon Oct 12" and "$3.30 · Fri Oct 16", which is $2.65. |

**Narrow layout:** I checked every drawer of O-C3+, Settlement Due on a Saturday, K1, the stock Trade, before-the-first-Marks and Closed by expiration, at 375 and 320 px.
- The page never scrolls sideways, and the Today table fits at both widths.
- axe reports no violations at any width except Defect 3.

## 3. Overall: PASS, with defects

**Defect 1 — Moderate. At desktop width the Today table opens scrolled sideways, so the first column's heading is cut off.**
- **Steps:**
  1. Open O-C3 at 1280 px on Sat 10-17 10:00, Today drawer.
  2. Also seen on Settlement Due, Sat 11-21.
- **Expected:** the headings read in full, per W29 ("Next session, Mon Oct 19"), and C8R.6 says "the Today table fits".
- **Actual:**
  - The table is wider than its box: 588 px of content in 550 px. This happens on every state at 1280 px (563 to 590 px of content).
  - It loads with scrollLeft 38, so the sticky row-header column covers the start of the first heading. The screen reads "T SESSION, MON OCT 19" (screenshot `shots/oc3-sat10-Today.png`).
  - At 375 and 320 px the table fits without scrolling.

**Defect 2 — Moderate. An Underlying condition shows an older dated distance even though the current Underlying Mark exists.**
- **Steps:**
  1. On O-C3, at Fri 10-16 17:00, enter XYZ 58.10 only, so the call's Mark is missing. The same happens when the call's Mark is acknowledged unavailable.
  2. Open the Detail at Fri 18:00.
- **Expected:**
  - A110 gives each Mark its own availability: the Underlying's Mark supplies an Underlying condition's status.
  - A231 dates only rows "whose current reading is unavailable".
  - The audit, section 7: "On an option Trade with one Mark in and one missing, each condition row carries its own date."
  - So the Target should read "Target · 1.90 away", undated.
- **Actual:** the rail and Plan and Risk both read "Target · 2.10 away · Thu Oct 15 Marks", while Today shows "XYZ Mark 58.10 / 57.90 / +0.20" on the same screen. The trader sees Thursday's distance and not today's.

**Defect 3 — Moderate. axe fails in the Payoff drawer at 320 px (`scrollable-region-focusable`).**
- **Steps:**
  1. Open Closed-by-expiration O-S2X at Mon 11-23 18:00 at 320 px, Payoff drawer.
  2. Also seen on Settlement Due at Sat 11-21.
- **Expected:** no WCAG 2.1 AA violations (AC-UI-002; B8R.7).
- **Actual:** `.payoff-section > .table-scroll` scrolls (303 px of content in a 288 px box) but cannot take keyboard focus. D8R did not touch the Payoff drawer, so this is probably older, but it is a Trade Detail drawer at a required width.

**Defect 4 — Moderate. On an option Trade, an acknowledged Underlying Mark gets no note under the Today table.**
- **Steps:**
  1. On O-C3, at Fri 10-16 17:30, enter the call at $3.40 and acknowledge XYZ's Friday Mark as unavailable.
  2. Open the Detail at Fri 18:00, Today drawer.
- **Expected:** the kept words under the table, "Mark unavailable for XYZ on …: your acknowledgment, not a price". The audit's O-C3 mockup uses this exact Underlying example, and T8R.6 says "an acknowledgment under the table … when they apply".
- **Actual:**
  - Today shows XYZ "—" with no note, so it reads like a missing Mark. Only the rail's "Target · Acknowledged unavailable" says otherwise.
  - When the call's own Mark is acknowledged, the note does appear: "Mark acknowledged unavailable for XYZ Dec 18 $55 Call on Fri Oct 16: your acknowledgment, not a price".
  - In `today.props.ts`, `notesOf` checks only `current.markResolution`, the contract's own Mark.

## 4. Minor observations
1. **Plan and Risk group order differs from the audit.** The audit's order is Plan, Plan Baseline, Conditions, Entry Quality, Since the last Marks, Fulfillment, Deviations. The build puts Since the last Marks and Conditions ahead of Plan Baseline. The breakdown fixes only that the last two come last, which they do.
2. **The Journal line has no closing period.** It reads "1 active Deviation. See Plan and Risk"; W24 reads "… See Plan and Risk.".
3. **The Conditions table is cut off at 320 and 375 px.** It scrolls inside its box: at 320 px, "Risk to stop $220.00 · 1.10R" is clipped and Value at expiration is off-screen until scrolled. The box is focusable, and axe passed.
4. **"Max reward: Unbounded above · Thu Oct 15 Marks".** An unbounded value carries a session date.
5. **The owed reflection doesn't use the one-line form.** The owed Position Change Reflection in Journal reads "Position Change at 2026-10-14 11:00", then a "Due" term with a "Due" value. That is not W27's form and repeats a word. It is an owed reflection rather than an entry.
6. **The rail's leading "·" is cosmetic.** Rail distances begin with "·" ("Stop · $2.20 away"), and at 320 px the wrapped distance starts its line with "· $2.20 away · Thu Oct 15".
7. **The weekend P&L card differs from the weekday one on Settlement Due.** On Sat 11-21 the card shows "$238.70" and "2 of 2 contracts open". On Mon 11-23 the same Trade shows "Settlement Due: MNO Nov 20 $45 Put" and "Trade P&L once the expiration is recorded". On Fri 18:00 the badge reads "Cash-Secured Put, Open" while Needs you shows Settlement Due. All of this predates D8R.
8. **The track's "now" dot lags the table at midday.** On Fri 12:00 the "now" dot sits at Thursday's $3.20 and the comparison dot is labelled "Wed Oct 14", while the table's Yesterday column is Thu Oct 15. This is a D8P track and not a table cell.
9. **The option price track's accessible name leaves out the entry.** It reads "Option price: Stop $1.00, now $3.20", with no mention of the $2.65 entry.
10. **The Stale context line still says "close".** It reads "$3.20 from Thu Oct 15 close". Revision 98 keeps these words.
