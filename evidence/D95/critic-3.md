# D95 critic-3 report

## 1. Header

- **When:** Tue 2026-11-24, about 00:00 to 00:23 EST.
- **Commit tested:** `e5c65653`. While I was running, HEAD moved to `cefbf560`. That commit was made by someone else and changes only `evidence/D95/structural.md`, so the code I tested is unchanged.
- **Versions:** Node v26.12.0, Playwright 1.63.0, Chromium 153.0.8010.12 (headless). Each viewport was set at launch: 1280×900, 375×900 and 320×900. I recorded `innerWidth` in every run.
- **Build:** `npm run build:faults &amp;&amp; npm run build:releases`, run under `.claude/scripts/with-browser-lock.sh`. It rebuilt `dist-releases/current` from the checked-out code.
- **Server:** the suite's release server (`tools/release-server.ts`) on `localhost:5175`, serving `dist-releases/current` through the d4 `test` fixture. It is not `vite preview`. Every run was under the browser lock, and the fixture started and stopped the server.
- **My own script faults:**
  - The first run started from the wrong working directory and got HTTP failures. I discarded it.
  - One C95.4 run hung for about 9 minutes on my own `inputValue` call against a cell that had become "No price". I aborted it, fixed the script and reran.
  - At the end nothing was listening on 5175 and no Playwright or Chromium process was left.
- **Edits:** none to any tracked file, and no commits. `git status --porcelain` is empty. My scripts, JSONL observations and screenshots are in `/Users/ckolbegger/src/trade-journal-v3/worktrees/claude-opus-5.5/test-results/critic-d95-3/` (`flows/`, `obs/`, `obs/shots/`), which git ignores.
- **Helpers:** used only to reach starting states or to read stored data:
  - `onboardedPage` and `createTrades` for the four-Trade fixture, and `copySetup(STANDARD_REVIEW)` for the standard Review.
  - `saveAction`, only to save Monday's Holds as setup for Tuesday.
  - `answerSlipQuestions`, only in C95.3 and C95.4 setup, after I had seen the question myself.
  - `probe` for stored data.
  - I performed every flow action myself, by role and label. No helper failed.
  - `brokenFiguresInDialog` was the wrong tool for a card (it flags every figure), so I ignored its output and ran my own line-break scan instead.

## 2. Results

| Flow | Result | Key observations |
|---|---|---|
| C95.1, a routine day by keyboard, at 1280 and 375 | PASS | **Start:** four-Trade fixture on Mon Oct 12. Tab from the Open list reached "Review", then Enter. The day card read "4 Trades · 4 Marks and 4 Actions to go", the steps "1 Marks / 2 Trades / 3 The day", "Incomplete", and each line "Marks needed / To do: Mark, Action". **Marks:** Tab reached "Enter the Marks"; Enter focused "XYZ Mark, Mon Oct 12". Typing and Enter moved through XYZ, DEF, JKL and ABC to "Save Marks (4)", and Enter saved. The grid folded to "Marks for Mon Oct 12 · 4 of 4 saved" with "Edit". Focus went to ABC's header. **After the save:** the cards re-sorted to ABC "Past Stop", DEF "At Target", XYZ "31% to Target", JKL "5% to Target". The day card read "Next: ABC" and "Day so far: +$597.00" (−251 + 619 + 180 + 49). **Holds:** on each card, Tab reached the radio "Hold [checked]", then Tab to "Save" and Enter. Focus moved to the next card owed, and the counts went 3, 2, 1 Actions to go. **Finished day:** "Complete", "The day +$597.00", "Past a line Past Stop: ABC · At Target: DEF", "You chose Hold ABC, DEF, XYZ, JKL", "You held ABC past the Stop. Tomorrow's Review asks again.", "You held DEF past the Target, with no new line.", "Next Review Tue Oct 13, after the close.". **Stored:** 4 Hold entries and 4 `InitialManual` Marks. **Figures checked by my arithmetic:** XYZ "+$180.00 · +0.72R", "−$4.50 to Stop (lose −$450.00)", Worst case "$5,200.00 more · 20.80R", "0.89 to 1 · Plan 2.40 to 1". No sideways scroll at either width. |
| C95.2, a day of slips, at 1280 and 375 | PASS | Standard Review on Tue Nov 17. **Refusals:** AXIO `4x.1` gave "Not a price. Digits only, like 45.10."; AXIO `0` gave "A share price can't be $0.00.". **Ten-times slip:** AXIO `440` asked "$44.00 or $440.00?"; "$44.00" set 44.00. Leaving the cell again asked nothing. **Zero option:** Call `0` asked "Worth nothing?" with "Yes, $0.00 / Retype"; Retype emptied the input and focused it, then 3.00 passed. Put `0`, then "Yes, $0.00", kept 0. **Far move, answered both ways:** DALE 49.00 asked "−7.9% from $53.20. Right?". Two Enters stayed in the input with the question open, the hint read "1 Mark to check first.", and pressing "Save Marks (4)" stored nothing (probe: no Tue Nov 17 data). Retype, then 53.90, passed. BREN 112 asked "+7.7% from $104.00. Right?"; "Yes, $112.00" kept it and nothing more was asked. **Save:** the cards re-sorted from BREN, AXIO, DALE to AXIO, DALE, BREN; focus went to AXIO's header; "Day so far: +$2,420.00" (0 + 2,652 − 232). **Fix in place:** "Edit" showed "Saved in this Review: fix it in place, no reason needed.". Put 0 → 3.70 and AXIO 44 → 45.00 asked no reason and opened no dialog. The store holds revision 2 of each with `intention: "Correction"` and `reason: "Fixed in the same Review"`. "Day so far" became +$300.00 and AXIO "−$940.00 · −1.57R"; both match my arithmetic. The 375 run differed from 1280 only in layout. |
| C95.3, each card against Trade Detail, at 1280, 375 and 320 | PASS, with Defect 1 | **Mon Nov 16, past the lines.** Every card figure equals Trade Detail's: **AXIO** (stock, past Stop): "−$1,040.00 · −1.73R", "$3.00 past Stop (−$300.00 so far)", "+$12.00 to Target (gain $1,200.00)", Worst "$4,400.00 more · 7.33R", Realized, open "−$440.00 · −$600.00". **BREN** (long call, at Target): "+$988.00 · +3.05R", "$0.16 past Target (+$32.00 so far)", "−$3.36 to Stop (lose −$672.00)", Worst "$832.00 more · 2.57R", Expiration "… then: +$956.00", which equals Payoff. **DALE** (short put, past Stop): "−$2,088.00 · −1.36R", "$0.80 past Stop (−$552.00 so far)", Worst "$31,848.00 more · 20.73R", Max reward "$2,652.00 more", Expiration "−$2,016.00", which equals Payoff. The finished day's "AXIO (6 sessions), DALE (2 sessions) · BREN (3 sessions)" matches the fixture series: first crossings Nov 9, Nov 13 and Nov 12, counted inclusively. **Tue Nov 17 before the Marks:** "Past Stop Mon", "At Target Mon"; "Figures wait for today's Marks. Below: at the Mon Nov 16 Marks."; "No Action until today's Mark is in. Enter it"; the top line "Mon Nov 16 you chose Hold, no reason given.". **Tue Nov 17 inside the lines** (AXIO 48, BREN 105, Call 3.00, DALE 55, Put 2.50): AXIO "−$640.00 · −1.07R", "−$1.00 to Stop (lose another −$100.00)", "8.00 to 1 · Plan 2.00 to 1". BREN "+$756.00", "0.45 to 1 · Plan 2.95 to 1", Expiration "+$1,156.00". DALE "−$936.00 · −0.61R", Worst "$33,000.00 more · 21.48R", Max "$1,500.00 more". All equal Trade Detail. The day was "+$1,320.00". **Fixed since critic-2:** the labels read "67% to Stop" (AXIO), "58% to Target" (BREN) and "61% to Stop" (DALE), the same as each card's line and the Pressure formula. At 320, "Your last decisions" shows "Mon Nov 16 · Hold ·" then "−$1,040.00" whole on the next line. **Captions:** one length for both at every width; the full sentence is each caption's accessible name and `title`; a past-line caption is bold (`&lt;b&gt;`) at the full and first-shorter forms and not at 320's shortest form. **Screen reader** (accessibility tree): heading "Now · Tue Nov 17", then the Marks paragraph, then the drawing named "P&amp;L …", then two notes, then the term and definition rows, then the key list. **320 and 375:** no sideways scroll on the page, the day card, any card, or the open grid with a slip question. My line-break scan found no figure or sign split across lines. **Open list:** "In the Review's order": AXIO, DALE, BREN. |
| C95.4, Complete with Unavailable Marks, at 1280 and 375 | PASS | **Stocks, Mon Oct 12:** XYZ marked "Can't get a price" with "Halted, no quote". The fold read "4 of 4 saved · 1 no price". XYZ's line and card say "No price today" and "Mark acknowledged unavailable for XYZ on Mon Oct 12"; Worst case reads "Acknowledged unavailable: XYZ, Mon Oct 12". After four Holds the day card read "Complete with Unavailable Marks", "You chose Hold XYZ, ABC, DEF, JKL", "Instruments: XYZ", "Trades: XYZ (Long 100 shares @ $50.18)", "Not calculated: Valuation, Risk, Reward, Condition status". The stored acknowledgment holds the reason. **Option, Tue Nov 17:** the Put marked "Can't get a price" by pressing N, with "No quote". The finished day read "Past Stop: AXIO (7 sessions), DALE (3 sessions) · At Target: BREN (4 sessions)", "DALE, BREN expire Fri Nov 20: 3 sessions left.", the "Missed" list, "Next Review Wed Nov 18, after the close.", and "Instruments: DALE Nov 20 $57.50 Put". AXIO "−$990.00 · −1.65R" and BREN "+$996.00 · +3.07R" are correct. DALE's card still does not mention the missing price; that is already known, and no worse. |

## 3. Overall: PASS

All four flows (C95.1, C95.2, C95.3 and C95.4) met their pass conditions. There is one moderate defect.

### Defects

1. **Moderate. The card's drawing and meter state a different percent from the card's label for a partly sold Trade.**
   - **Steps:** standard Review. Save the Mon Nov 16 Holds, move to Tue Nov 17, enter AXIO 48.00 (answer Yes), BREN 105.00, Call 3.00, DALE 55.00, Put 2.50, and save. Read AXIO's and BREN's headers and Now boxes. Seen at 1280, 375 and 320.
   - **Expected:**
     - Since critic-2, a Trade's percent follows the spec's Pressure share (`specs/design/daily-review.md`, the Pressure paragraph; T95.11 case 7). One card should not state two shares for "the way to the Stop".
   - **Actual:**
     - AXIO's label reads "67% to Stop", and its line reads "67% of the way from entry to the Stop". On the same card, the drawing's name and tooltip read "P&amp;L −$640.00, 86% of the way to the Stop. …". The collapsed header's meter and the Open list row's meter carry the same "86%" sentence.
     - BREN reads "58% to Target" against "79% of the way to the Target".
     - A screen-reader user in C95.3 hears 67% in the header and then 86% in the drawing. The drawing's marker is also drawn at the P&amp;L share.
     - DALE, which has no sale, reads 61% in both places.
   - **Note:** the drawing uses the shared meter's sentence, as T95.17 case 13 requires, and the shared meter is not edited (S12). This conflict between the plan's two rules may therefore need the user's choice, not only a code fix.

## 4. Minor observations

- **Hold is pre-selected (`[checked]`) on every card**, including Trades past their Stop. Part B (T95.31, Q1) changes this, so I did not count it.
- **Tab order in the grid:** each earlier-session cell is a focusable button (for example "DALE Mark, Mon Nov 16"). Tab from an input lands there rather than on the next input. Enter does move to the next input, as W105 says.
- **Save Marks while a question is open:** the button is not disabled. Pressing it does nothing, and the reason is shown only as the hint "1 Mark to check first.". This meets W109, but nothing new appears when it is pressed.
- **Wording:**
  - An acknowledged-unavailable stock's Now box reads "XYZ No Mark", while its label says "No price today".
  - "More figures" reads "breakeven 56.56" with no "$", unlike W92's "$53.29". It does match Trade Detail's "Breakeven 56.56".
  - For a winning Trade, the first-shorter Stop caption drops "lose", for example "−$2.20 (−$440.00)" beside "+$1.00 (gain $200.00)". It is the same length level as its partner, so it is not a length defect.
- **320 layout:** "Mon Nov 16" wraps to two lines in AXIO's grid row while a slip question is open. Nothing is cut off.
- **Still present, already known:**
  - "0 means it closed with no value" under a stocks-only grid.
  - The "At entry" block on a card with a missing or unavailable Mark.
  - "Stop breached" and "Target reached" in the day card's hidden reasons.
  - "Their Marks are optional." when those Marks exist.
  - No day total with an unavailable Mark.
  - Lower-case "short" in DALE's Plan Entry.
  - Focus falls to `body` after the last Hold.
  - DALE's card is silent about the unavailable Put.
- **Not exercised:** a real screen reader (I read the accessibility tree), "Add them" for skipped sessions whose Marks are missing, and the 440 → $440.00 choice at 375.
