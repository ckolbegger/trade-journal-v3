# D95 critic-1 report

## 1. Header

- **When:** Mon 2026-11-23, about 19:52 to 20:20 EST.
- **Commit:** `336ff344` on branch `claude-opus-5.5`.
- **Versions:** Node v26.12.0, Playwright 1.63.0, Chromium 153.0.8010.12 (headless, real viewports at 1280×900, 375 and 320).
- **Build:** `npm run build:faults &amp;&amp; npm run build:releases`, run under `.claude/scripts/with-browser-lock.sh`. Exit 0.
- **Server:** the suite's own release server (`tools/release-server.ts`) on `localhost:5175`, serving `dist-releases/current`, which is the production build of the checked-out code. It is not `vite preview`. The `test` fixture started it inside the browser lock for each run and stopped it afterwards. Port 5175 had no listener at the end.
- **Edits:** none to any tracked file, and no commits. `git status --porcelain` is empty. My scratch specs, logs and screenshots are under `/Users/ckolbegger/src/trade-journal-v3/worktrees/claude-opus-5.5/test-results/critic-d95-1/` (`flows/`, `obs/*.jsonl`, `obs/shots/`).
- **Helpers:** `e2e/d95/support.ts` exports only `WIDTHS` and `atBothWidths`. It does not re-export `e2e/d1/support.ts` as the brief says, so I imported `e2e/d4`, `e2e/d9ar` and `e2e/d7p` support directly. I used them only to build each starting state and to read stored state. I performed every flow action myself.

## 2. Results

| Flow | Result | Key observations |
|---|---|---|
| C95.1 at 1280 and 375: a routine day by keyboard | PASS | Four Trades with no Marks. The day card reads "4 Trades · 4 Marks and 4 Actions to go", the steps "1 Marks / 2 Trades / 3 The day", and "Incomplete". "Enter the Marks" was reached after 5 or 6 Tabs. Enter moved focus to "XYZ Mark, Mon Oct 12", then to each next input, then to "Save Marks (4)". Enter there saved all four. The grid folded to "Marks for Mon Oct 12 · 4 of 4 saved" with "Edit", and focus went to the first Trade's header ("Review ABC … 50% to Stop −$101.00 · −0.51R"). The day card then read "Next: ABC" and "Day so far: +$127.00" (−101 + 99 + 80 + 49). Four Holds by keyboard (Tab to the radio "Hold", Tab to "Save", Enter): focus went to the next card still owed and the counts went 3, 2, 1. The finished day reads "Complete", "The day +$127.00", "You chose Hold ABC, DEF, XYZ, JKL" and "Next Review Tue Oct 13, after the close.". All four Holds and four Marks were stored. No sideways scroll at either width. In one 375 run that happened to put DEF past its Stop and JKL at its Target, the day also read "Past Stop: DEF · At Target: JKL" and "You held DEF past the Stop. Tomorrow's Review asks again." |
| C95.2 at 1280 and 375: a day of slips | PASS | Run on the Tue Nov 17 Review. AXIO `440` against a last Mark of 44.00 asked "$44.00 or $440.00?" with buttons "$44.00" and "$440.00"; "$44.00" put 44.00 in the input. A `0` for AXIO gave "A share price can't be $0.00."; `4x.1` gave "Not a price. Digits only, like 45.10.". The Call at `0` asked "Worth nothing? Yes, $0.00 / Retype": Retype emptied the input and focused it, and Yes kept 0. DALE `49.00` asked "−7.9% from $53.20. Right?" and Retype returned to the input. BREN `112.00` asked "+7.7% from $104.00. Right?" and "Yes, $112.00" kept it; leaving the cell again asked nothing more. With questions open the hint read "1 Mark to check first." and then "2 Marks to check first.". Pressing "Save Marks (4)" then stored nothing and moved focus to the first questioned input. Enter at an open question stayed in place. After the save, "Edit" showed "Saved in this Review: fix it in place, no reason needed.". AXIO 44 → 43.20 asked for no reason, and the store now holds revision 2 with `intention: "Correction"` and `reason: "Fixed in the same Review"`. Only prices were stored, no slip answers. "Day so far" went from +$650.00 to +$570.00 (−$80 for 100 shares). |
| C95.3 at 1280, 375 and 320: each card against Trade Detail | PASS | **Mon Nov 16, past the lines:** every figure equals Trade Detail's. AXIO (stock, past Stop): card "−$1,040.00 · −1.73R"; captions "$3.00 past Stop (−$300.00 so far)" and "+$12.00 to Target (gain $1,200.00)"; Worst case "$4,400.00 more · 7.33R"; Detail "Risk to stop $300.00 · 0.50R past", "Worst case: $4,400.00 · 7.33R". BREN (long call, at Target): "+$988.00 · +3.05R"; "$0.16 past Target (+$32.00 so far)"; "−$3.36 to Stop (lose −$672.00)"; Worst "$832.00 more · 2.57R"; Detail matches. Its "More figures" reads "no breakeven · max profit: unlimited · no loss: at worst +$156.00", which equals the Payoff tab. DALE (short put, past Stop): "−$2,088.00 · −1.36R"; "$0.80 past Stop (−$552.00 so far)"; Worst "$31,848.00 more · 20.73R"; Max reward "$2,652.00 more"; Expiration "… with DALE at $53.20 then: −$2,016.00", which equals Payoff "If DALE is at 53.20 at expiration: −$2,016.00". Its "More figures" reads "breakeven 56.56 · max profit $564.00 · max loss $33,936.00", which equals Payoff. **Tue Nov 17, inside the lines:** AXIO −$640.00, BREN +$756.00 and DALE −$636.00; the distances, risks, rewards and worst cases all equal Plan and Risk; "Reward to risk" shows only inside the lines ("8.00 to 1 · Plan 2.00 to 1"). **Captions at narrow widths:** one length for both captions; shortest forms at 375 and 320 (for example "$3.00 past (−$300.00)" with "+$12.00 (+$1,200.00)"); the full sentence stays as each note's name and title. A past-line caption is bold (an inner `&lt;b&gt;` at weight 700) except in the shortest form. **Screen reader:** the drawing is named, for example, "P&amp;L −$1,040.00, past the Stop by $300.00. Realized −$440.00. Stop −$740.00, Target +$160.00. Down from −$930.00 on Fri Nov 13.". No sideways scroll at 1280, 375 or 320. See Defect 2 for one line break at 320. |
| C95.4 at 1280 and 375: Complete with Unavailable Marks | PASS, with Defect 1 | **Four stocks, XYZ "Can't get a price":** the fold reads "4 of 4 saved · 1 no price". The finished day reads "Complete with Unavailable Marks", then "Instruments: XYZ", "Trades: XYZ (Long 100 shares @ $50.18)" and "Not calculated: Valuation, Risk, Reward, Condition status". XYZ's line and card say "No price today"; the card shows "Worst case Acknowledged unavailable: XYZ, Mon Oct 12" and "Saved Action: Hold". The other cards show their figures. **Option case (Tue, DALE Put no price):** the day card lists the Put as above; it reads "BREN, DALE expire Fri Nov 20: 3 sessions left." and "Missed Mon Nov 2 … Mon Nov 16". The session counts are right: AXIO 7, DALE 3, BREN 4. But DALE's label, its place in the order and its card contradict the day summary and Trade Detail (Defect 1). |
| The Review page, day card and a Trade card at 320 | PASS, with Defect 2 | No sideways scroll before or after "Add them", nor on the finished day. The grid rows stack; "Add them" added the "Mon Oct 12 · optional" column. The Plan box puts each label above its value. The finished day's two-column list is narrow but readable. |

## 3. Overall: PASS

None of the four flows failed its pass condition. There are 2 moderate and 4 low defects.

### Defects

1. **Moderate. A Trade past its Stop is labelled and ranked as "No price today".**
   - **Steps:** start from the standard Review and move to Tue Nov 17. Enter DALE 53.40 (DALE's Stop is "DALE at or below $54.00"). Mark "DALE Nov 20 $57.50 Put" "Can't get a price" with a reason. Save the Marks.
   - **Expected:** the attention bands put "Stop reached" above "Target reached" and "evidence limited", and "Boundary-reached status stays in its higher band" (`specs/design/daily-review.md`, "Date, eligibility, and ordering"). Plan A302 labels such a Trade "Past Stop".
   - **Actual:** DALE's line and card say "No price today". The order puts it after BREN "At Target" (DALE, AXIO and BREN all past a line), and ahead of two inside-the-lines Trades in another run. The card's Now box shows "At the Mon Nov 16 Marks" with "DALE $53.20" and "$0.80 past"; today's 53.40 appears nowhere on the card. The same day card says "Past Stop: AXIO (7 sessions), DALE (3 sessions)" and "You held AXIO, DALE past the Stop.", yet lists "Not calculated: … Condition status". Trade Detail shows "Stop · Breached · 0.60 past". The page contradicts itself about whether DALE is past its Stop.

2. **Moderate. A minus sign is split from its figure at 320 px.**
   - **Steps:** open DALE's card on the Mon Nov 16 Review at 320 wide.
   - **Expected:** a figure stays whole (U2; the project's broken-figure rule). W90 gives the form "… then: −$2,016.00".
   - **Actual:** the Expiration row breaks as "at $53.20 then: −" and "$2,016.00" on the next line. The sign (U+2212) is left at the end of a line, so the figure reads as a gain.

3. **Low. The zero hint shows on a grid of stocks.**
   - **Steps:** type any price in a grid that holds only stocks (four-Trade fixture), or press "Edit".
   - **Expected:** the grid refuses a zero share price with "A share price can't be $0.00." (W107).
   - **Actual:** "0 means it closed with no value" appears under the grid, inviting the entry the grid then refuses.

4. **Low. An extra "At entry" block repeats near-identical figures.**
   - **Steps:** open a card whose Review Date Mark is missing or acknowledged unavailable.
   - **Expected:** the card holds the Plan box and the Now box only (U3), and a figure appears once (U2).
   - **Actual:** an "At entry" block reads "Risk to stop $268.00 / Reward to target $582.00". It sits beside the Plan box's "Risk $250.00 (1R) / Reward $600.00" and the drawing's "Stop −$270.00 / Target +$580.00".

5. **Low. The Plan ratio breaks across lines at 1280.**
   - **Steps:** at 1280, open a card before its Mark is saved.
   - **Actual:** "Reward to risk Mark missing: XYZ, Mon Oct 12 · Plan 2.40 to" wraps, leaving "1" alone on the next line.

6. **Low. A count is orphaned from its line at 375.**
   - **Steps:** at 375, leave two slip questions open.
   - **Actual:** the line beside the buttons reads "Save Marks (4) Discard 2", with "Marks to check first." on the next line.

## 4. Minor observations

- After the last Hold, focus falls to `body`. T95.61 case 3 ("move focus to 'The day' when nothing is left") is Part C, so this is not counted here.
- The inside-the-lines label is the meter's share, while the order uses the spec's pressure. AXIO shows "86% to Stop" and BREN "79% to Target" (P&amp;L now over P&amp;L at the line), but the pressure used for the order is 67% and 58% (remaining Position only). Each label's hidden reason repeats the same percent as "86% of the way from entry to the Stop". This is a wording point, not a figure on screen that contradicts another.
- With one Mark unavailable, "Day so far" and the finished day's "The day" row are left out without saying they could not be worked out.
- Before the Marks are saved, a day-card link takes focus to that Trade's Mark input instead of opening its card. After the save the link opens the card; a second press on the link leaves it open. The card header does open and close.
- After Save Marks, focus goes to the first header, but the card that was open on load stays open lower down, so a Tab moves into it.
- When Tab leaves a slip cell, the question (an alert) appears after focus has already moved to the next row. Enter does hold at a question.
- After N, typing a reason and pressing Enter neither confirms "No price" nor moves on.
- DALE's Stop distance reads "$0.80" on the card and "0.80" on Trade Detail.
- In the Now box, "Worst case" and "Max reward" are set smaller and greyer than "Realized, open" and "Expiration".
- The hidden reasons on the day card's lines still use "Stop breached" and "Target reached".
- On the standard Review, "No Review for … Their Marks are optional." appears although those Marks already exist (no "Add them" is offered, which fits).
- Not exercised in these flows: T95.19 ("Your last decisions"), T95.22 (the Open list), and the "$440.00" choice on a ten-times slip (only "$44.00" was pressed).