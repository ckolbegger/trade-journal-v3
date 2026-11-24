# D95 critic-2 report

## 1. Header

- **When:** Mon 2026-11-23, about 21:26 to 22:00 EST.
- **Commit:** `a09ecafa` on branch `claude-opus-5.5`.
- **Versions:** Node v26.12.0, Playwright 1.63.0, Chromium 153.0.8010.12 (headless). The viewports were real ones set at launch: 1280×900, 375×900 and 320×900. I recorded `innerWidth` in every run.
- **Build:** `npm run build:faults &amp;&amp; npm run build:releases`, run under `.claude/scripts/with-browser-lock.sh`. `dist-releases/current` was rebuilt at 21:29 from HEAD.
- **Server:** the suite's release server (`tools/release-server.ts`) on `localhost:5175`. The suite's `test` fixture started it and stopped it inside the lock for each run. It served `dist-releases/current`, the production build of the checked-out code; every spec logs this. It is not `vite preview`.
  - My first C95.2 run was served `dist-faults`, because d9ar's `test` defaults to it. I discarded that run and repeated it on `dist-releases/current`.
  - At the end nothing was listening on 5175 and no Playwright or Chromium process was left, including from one run I aborted.
- **Edits:** none to any tracked file, and no commits. `git status --porcelain` is empty. Scratch specs, JSONL observations and screenshots are under `/Users/ckolbegger/src/trade-journal-v3/worktrees/claude-opus-5.5/test-results/critic-d95-2/` (`flows/`, `obs/*.jsonl`, `obs/shots/`).
- **Helpers:** used only to reach starting states and to read stored state:
  - `onboardedAt` and `createTrades` for the four-Trade fixture.
  - `copySetup(STANDARD_REVIEW)` for the standard Review.
  - `saveAction`, only to save Monday's Holds as setup for the Tuesday "last decisions" checks.
  - `probe` for stored state.

  I performed every flow action myself, by role and label. No helper failed. Two hangs were faults in my own scripts, not in the app: an `Edit` button that is absent after a reload, and a row locator I wrote badly.

## 2. Results

| Flow | Result | Key observations |
|---|---|---|
| C95.1, a routine day by keyboard, at 1280 and 375 | PASS | **Start:** the four-Trade fixture on Mon Oct 12, keyboard only from the Open list. Tab reached "Review", then Enter. The day card read "4 Trades · 4 Marks and 4 Actions to go", the steps "1 Marks / 2 Trades / 3 The day", "Incomplete", and each line "Marks needed / To do: Mark, Action". **Marks:** Tab reached "Enter the Marks"; Enter focused "XYZ Mark, Mon Oct 12". Typing a price and pressing Enter moved to each next input, then to "Save Marks (4)", and Enter saved. The grid folded to "Marks for Mon Oct 12 · 4 of 4 saved" with "Edit". Focus went to the ABC header ("… 25% to Stop −$51.00 · −0.26R −$51.00 today"). **After the save:** the day card showed "Next: ABC" and "Day so far: +$227.00", which is −51 + 99 + 80 + 99 by my arithmetic. **Holds:** for each card, Enter on the header, Tab to the radio "Hold [checked]", Tab to "Save", Enter. Focus moved to the next card still owed, and the counts went 3, 2, 1 Actions to go. **Finished day:** "Complete", "The day +$227.00", "You chose Hold ABC, DEF, XYZ, JKL", "Next Review Tue Oct 13, after the close.", and every line "Done · Hold". **Stored:** 4 Actions and 4 Marks (`InitialManual`). Every card figure matched my own arithmetic (for example XYZ "+$80.00 · +0.32R", "Reward to risk 1.43 to 1 · Plan 2.40 to 1"). No sideways scroll at either width. |
| C95.2, a day of slips, at 1280 and 375 | PASS | Standard Review moved to Tue Nov 17. **Refusals:** AXIO `4x.1` gave "Not a price. Digits only, like 45.10."; AXIO `0` gave "A share price can't be $0.00.". **Ten-times slip:** AXIO `440` asked "$44.00 or $440.00?". At 1280, "$44.00" set 44.00. At 375, "$440.00" kept 440. Leaving the cell again asked nothing more. **Zero option:** Call `0` asked "Worth nothing? Yes, $0.00 / Retype"; Retype emptied and focused the input. Put `0` with "Yes, $0.00" kept 0. **Far moves:** DALE `49.00` asked "−7.9% from $53.20. Right?". Enter twice stayed in the input with the question open, the hint read "1 Mark to check first.", and pressing "Save Marks (4)" stored nothing (probe: no Tue observation). Retype emptied the input, and 53.90 then passed. BREN `112.00` asked "+7.7% from $104.00. Right?"; "Yes, $112.00" kept it and asked nothing again. **Save:** focus went to the AXIO header. **Fix in place:** "Edit" showed "Saved in this Review: fix it in place, no reason needed.". Put 0 → 3.70 at both widths, plus AXIO 440 → 43.20 at 375, asked no reason. The store holds revision 2 with `intention: "Correction"` and `reason: "Fixed in the same Review"` for each fix. "Day so far" went from +$2,870.00 to +$650.00 at 1280 (+$570.00 at 375), which matches my arithmetic. The cards re-sorted after the fix (AXIO, DALE, BREN). |
| C95.3, each card against Trade Detail, at 1280, 375 and 320 | PASS, with Defects 1 and 2 | **Mon Nov 16, past the lines:** every card figure equals Trade Detail's and my arithmetic. AXIO (stock, past Stop): "−$1,040.00 · −1.73R", "$3.00 past Stop (−$300.00 so far)", "+$12.00 to Target (gain $1,200.00)", Worst case "$4,400.00 more · 7.33R", "Realized, open −$440.00 · −$600.00". BREN (long call, at Target): "+$988.00 · +3.05R", "$0.16 past Target (+$32.00 so far)", "−$3.36 to Stop (lose −$672.00)", Worst "$832.00 more · 2.57R", Expiration "… with BREN at $104.00 then: +$956.00", which equals Payoff. DALE (short put, past Stop): "−$2,088.00 · −1.36R", "$0.80 past Stop (−$552.00 so far)", "−$4.22 to Target (gain $2,532.00)", Worst "$31,848.00 more · 20.73R", Max reward "$2,652.00 more", Expiration "then: −$2,016.00", which equals Payoff. **Tue Nov 17, before the Marks:** labels "Past Stop Mon" and "At Target Mon"; "Figures wait for today's Marks. Below: at the Mon Nov 16 Marks."; "No Action until today's Mark is in. Enter it"; top line "Mon Nov 16 you chose Hold: “Up today. One more day.”". **Tue Nov 17, inside the lines** (AXIO 48, BREN 105 with the Call at 3.00, DALE 55 with the Put at 2.50): AXIO −$640.00, BREN +$756.00 and DALE −$936.00. The distances, risks, worst cases and payoffs equal Trade Detail's. "Reward to risk 8.00 to 1 · Plan 2.00 to 1" appears only inside the lines. "Your last decisions" shows "Held past the Stop last session.", "Mon Nov 16 · Hold · −$1,040.00" and "no reason given", and the top line is hidden. **Captions:** one length for both; the full sentence is each caption's name and `title`; the shortest forms appear at 375 and 320; a past-line caption is bold except in its shortest form; captions sit on two rows without overlap. **Screen reader (accessibility tree):** heading "Now · Mon Nov 16", then the Marks line, then a drawing named "P&amp;L −$1,040.00, past the Stop by $300.00. Realized −$440.00. …", then the two named notes, then the term and definition rows, then the key. **320 wide:** no sideways scroll on the page, the day card or any card. DALE's Expiration row now keeps "−$2,016.00" whole (critic-1's B2 is fixed). **Open list:** "In the Review's order": AXIO, DALE, BREN, the same as the Review. |
| C95.4, Complete with Unavailable Marks, at 1280 and 375 | PASS, with Defect 3 | **Four stocks, XYZ "Can't get a price" with "Halted, no quote":** the fold read "4 of 4 saved · 1 no price". XYZ's line and card say "No price today" and "Mark acknowledged unavailable for XYZ on Mon Oct 12", and Worst case reads "Acknowledged unavailable: XYZ, Mon Oct 12". After four Holds the day card read "Complete with Unavailable Marks", "You chose Hold XYZ, ABC, DEF, JKL", "Instruments: XYZ", "Trades: XYZ (Long 100 shares @ $50.18)" and "Not calculated: Valuation, Risk, Reward, Condition status". The stored acknowledgment holds the reason. **Option case, Tue Nov 17:** DALE 53.40, the Put "Can't get a price" with "No quote". DALE is now labelled "Past Stop" and ordered AXIO, DALE, BREN, so critic-1's B1 is fixed. The finished day read: "Past Stop: AXIO (7 sessions), DALE (3 sessions) · At Target: BREN (4 sessions)", "You held AXIO, DALE past the Stop. Tomorrow's Review asks again.", "You held BREN past the Target, with no new line.", "DALE, BREN expire Fri Nov 20: 3 sessions left.", "Missed Mon Nov 2 … Mon Nov 16", "Next Review Wed Nov 18, after the close.", and the Unavailable Marks group naming the Put. I checked all the session counts. DALE's own card says nothing about the missing price (Defect 3). |
| The keys and the 320 layout (extra) | PASS, with Defect 2 and low defects | ↓ and ↑ move up and down the column. N in an empty input opens "Why no price, …" with no letter typed. The key hint shows at 375 and 320. The finished day at 320 reads "Complete", "The day +$1,320.00", "Tomorrow DALE, BREN expire Fri Nov 20: 3 sessions left." and "Missed" only when a session had no Review. No sideways scroll at 320. |

## 3. Overall: PASS

None of C95.1, C95.2, C95.3 or C95.4 failed its pass condition. There are 3 moderate and 2 low defects.

### Defects

1. **Moderate. The label's percent contradicts the card's own line and the spec's Pressure.**
   - **Steps:** standard Review, moved to Tue Nov 17. Enter AXIO 48.00 (answer Yes), BREN 105.00, Call 3.00, DALE 55.00, Put 2.50. Save Marks and open AXIO's card. Seen at 1280, 375 and 320.
   - **Expected:**
     - The label comes "from its band and reasons" (A302).
     - "keep each label's reason as its accessible description" (T95.11 case 7).
     - `specs/design/daily-review.md`, the Pressure paragraph: the losing share is "risk consumed since entry … divided by risk at entry", using the open Lots. For AXIO, 100 shares at $50 with the Stop at $47 and a Mark of $48, that is 67%.
   - **Actual:** the header pill reads "86% to Stop" and its description "86% of the way from entry to the Stop". On the same open card, the line under "Long Stock · Roth IRA · Fidelity" reads "67% of the way from entry to the Stop". BREN reads "79% to Target" and "58% of the way from entry to the Target". The 86% and 79% are the meter's P&amp;L share, which includes realized P&amp;L. The day card's pills and the finished day repeat 86% and 79%.
   - **Scope:** only Trades with a partial sale differ; DALE reads 61% in both places.

2. **Moderate. "Your last decisions" splits the minus sign from its figure at 320.**
   - **Steps:** save Holds on Mon Nov 16. Move to Tue Nov 17 at a real 320 viewport, save the Marks, and open AXIO's or DALE's card.
   - **Expected:** a figure stays whole (U2; the broken-figure rule behind critic-1's B2). W115's form is "Fri Nov 13 · Hold · −$930.00".
   - **Actual:** "Mon Nov 16 · Hold · −" ends one line and "$1,040.00" starts the next. DALE's entry breaks the same way at "$2,088.00". DOM line boxes confirm it: the "−" sits at top 1330 and "$1,040.00" at top 1353. The loss reads as a gain. At 375 the entry fits on one line. B2 fixed this only in the Now box.

3. **Moderate. A card with an unavailable option Mark does not say so.**
   - **Steps:** standard Review, Tue Nov 17. Enter DALE 53.40, mark "DALE Nov 20 $57.50 Put" "Can't get a price" with "No quote", type the other Marks, and save. Open DALE's card. Seen at 1280 and 375, before and after the Hold.
   - **Expected:**
     - "Acknowledged Unavailable evidence is resolved but disclosed" (`specs/design/daily-review.md`).
     - T95.11 case 5's "No price today".
     - XYZ's card in the same flow says "No price today" and "Mark acknowledged unavailable for XYZ on Mon Oct 12".
   - **Actual:**
     - DALE's header shows only "Past Stop" and "Stop breached", with no P&amp;L.
     - The Now box is headed "At the Mon Nov 16 Marks" and shows "DALE $53.20 −$0.50 · Put $4.42 +$0.21" and "$0.80 past Stop (−$552.00 so far)".
     - Nowhere on the card does it say the Put has no price today, and today's saved DALE Mark of 53.40 does not appear.
     - Trade Detail shows "Acknowledged unavailable: DALE Nov 20 $57.50 Put, Tue Nov 17" and "Stop · Breached · 0.60 past".
     - The day card does name the Put under "Instruments".

4. **Low. At 320, "Plan" is cut off from its ratio.** The Reward to risk row wraps as "2.30 to 1 · Plan" over "0.29 to 1" (DALE, Tue Nov 17, inside the lines).

5. **Low. At 320 the drawing's two labels touch.** AXIO on Mon Nov 16 shows "Stop −$740.00" immediately against "Target +$160.00", with no gap.

## 4. Minor observations

- **Still present, already in tech debt:**
  - The "0 means it closed with no value" hint shows under a stocks-only grid.
  - The "At entry" block ("Risk to stop $268.00 / Reward to target $582.00") shows on a card whose Mark is missing or unavailable.
- **Typing a "Why no price" reason and pressing Enter** neither confirms "No price" nor moves on. Focus stays in the reason box and "No price / Cancel" stay shown.
- **The grid after a reload:** reopening a Review whose Marks are all saved shows the grid open, with "Save Marks (0)", not folded with "Edit".
- **No day total with an unavailable Mark:** "Day so far" and the finished day's "The day" row are left out silently.
- **Old wording still in places:** the day card's hidden reasons and the Open list's rows still say "Stop breached" and "Target reached", while the Review's labels say "Past Stop" and "At Target".
- **Optional Marks that already exist:** on the standard Review, "No Review for Mon Nov 2 … Mon Nov 16. Their Marks are optional." shows although those Marks exist. No "Add them" is offered, which fits.
- **Drawing name:** with an unavailable Mark it reads "Acknowledged unavailable: XYZ, Mon Oct 12 Stop −$270.00, …", with no full stop before "Stop".
- **Plan box:** DALE's Entry reads "short 6 contracts at $0.94", with a lower-case "short".
- **Focus after the last Hold** falls to `body`. Focus after each save is Part C (T95.61), so I did not count it.
- **Not defects:**
  - Before Tuesday's Marks, BREN ("At Target Mon") is listed ahead of AXIO and DALE ("Past Stop Mon"). This fits the spec's within-band order: Last Activity descending, and BREN's sale is the latest.
  - At 1280 the "Now" box sometimes shows the first shorter captions; the box is half the card's width.
- **Not exercised:**
  - "Add them" for skipped sessions whose Marks are missing.
  - A real screen reader; I read the accessibility tree.
