# D09AR critic-2 report

## 1. Header
- **When:** Thu 2026-11-19, about 16:45 to 17:13 EST.
- **Commit:** `a2c87929` on `claude-opus-5.5`.
- **Tools:** Node v26.12.0, Playwright 1.63.0, Chromium 153.0.8010.12 (channel `chromium`, headless).
- **Servers:**
  - `npm run build` then `npx vite preview`, on port 5175 only, inside `.claude/scripts/with-browser-lock.sh`.
  - I stopped it once on purpose for the offline reload, then started a second preview under the lock. I stopped that one too.
  - At the end, `lsof` shows 5175 free.
  - No faults build or releases build was used, so the staged-update banner case (P153, B9AR.7) was not checked.
- **Setup:**
  - Profiles were built with `buildReview`, `build` and `buildPlanned` from `e2e/d9ar/support.ts`. Every helper worked.
  - One of my own setups failed: BREN's Thu 11-12 sale could not be saved with the clock at Wed 11-11. This was my mistake, not an app fault. I rebuilt that profile without the sale.
  - AXIO-U (the Trade with a second lot) was built with `build`, then its second entry (100 at $51.40, Fri 11-06) was recorded through the UI.
  - All scripts and screenshots are in `test-results/critic-d09ar-2/`.
- **Tracked files:** I edited none. `git status --short` at the end shows ` M evidence/D09AR/structural.md`. I did not make that change: its four added lines are the main session's own note about the `gate2` full run and about briefing critic-2. The file was last modified at 16:47, before my first edit in the folder.

## 2. Results

| Flow | Result | Key observations |
|---|---|---|
| C9AR.1 The overlay | PASS | **Covers the page:** BREN, DALE-hold and AXIO each opened a modal dialog named "Replay, BREN" / "Replay, DALE" / "Replay, AXIO". It is 1280×800 at 1280×800, all four corners and the centre lie inside it, and the page behind is inert. **Header:** "BREN · TRADE P&L +$988.00", "DALE · … −$2,088.00", "AXIO · … −$1,040.00", with Close. **Closing:** Close, Escape and Back each closed it and stayed on `/trades/<id>` with no `replay` in the address, focus on the "Replay" button. Opening adds exactly one history entry. Tab and Shift+Tab never left the dialog (45 presses). **Reload:** the overlay reopened, but on Mon Nov 16, not the Thu Nov 12 the slider was on (minor 1). **Links:** Price History, Position and Journal (shown on sessions with an Execution) closed the overlay and selected the drawer. Focus landed on that session's place: the column header "Mon Nov 9" or "Thu Nov 12", the Execution toggle "Sell 100 AXIO @ $45.60…", and the Journal heading "Mon Nov 9". |
| C9AR.2 Wide screen | **FAIL** | **Width:** the P&L chart is 837 px at 1280, 997 at 1440 and 1477 at 1920, with the readout beside it in a 372 px column. **Wrapping:** no figure breaks and no sign parts from its number at any wide width. **Labels:** every line is labelled. The key is under the charts. The axis reads "Mon Nov 2" at the left and "Expires Fri Nov 20" on the options; on AXIO nothing is at the right, and "Mon Nov 16" sits under the cursor. **Entry session:** clear at 1280 and 1920. **At 1440 (and 1536)**, on BREN and CORV, the tag "Remaining Reward $928" / "$834" is printed over the axis figure "$500" (defect 1). |
| C9AR.3 Watching it unfold | PASS | **Trades:** AXIO-U (second lot), BREN (partial sale), AXIO (sale below the Stop) and CORV (no Mark on Tue 11-10), each stepped through all 11 sessions. **Nothing early:** no later session's date or data ever appeared outside the header. At each session there were N price dots and N cards, and the current card was the slider's and on the shown page. **Cards:** "Earlier sessions" paged; pressing an earlier card's heading moved the slider ("Thu Nov 5 · 4 of 11"); moving the slider forward turned the cards back to its page. **Against the Plan:** "Bought 100 at $51.40, $1.40 above the Plan's entry", "Sold 2 at $4.00, at the Target", "Sold 100 at $45.60, $1.40 below the Stop". **First crossings:** "Target first reached Fri Nov 6." on CORV from Fri 11-06 on, Mon 11-09 included, and "Past the Stop since Mon Nov 9." on AXIO. **No Mark (CORV Tue 11-10):** "No Mark for the put on Tue Nov 10." once, at 16 px, with "Add the Mark" (it opens the Review's Marks row for the put). Eleven dashes are each named "No Mark". The P&L chart has a shaded "No Mark" column with no dot and nothing joined across it. **Chart figures:** every chart figure was in the readout and the slider's card, or in the Plan block (Stop, Target, Strike), or on its own session's card (an earlier sale's marker). **Phone exception:** the first-crossing line moves below the charts (defect 2). |
| C9AR.4 Not flattered | PASS | **DALE-hold Wed 11-11:** "11.69 to 1 · about 8% : 92%" with "(Plan 0.29 to 1 · 78% : 22%)", and the same in the "From here" sentence. **Past the Stop:** DALE Mon 11-16 shows one row, "Past the Stop by $552.00 (0.36R) · at Stop −$1,536.00"; AXIO Mon 11-09 shows "Past the Stop by $180.00 (0.30R) · at Stop −$740.00". Neither has an At Stop row, a "$0.00" or a Reward to risk row. **Realized:** AXIO shows "Realized −$440.00". **Weight:** At Worst case and At Max reward are 13.6 px grey (rgb 85,82,75) on AXIO, CORV and BREN, and 16 px full ink on DALE. **Tags:** "Worst case −$33,936 ↓" in red on DALE, "Worst case −$10,000 ↓" in grey on AXIO. **Odds by hand:** AXIO Fri 11-06 is $220 at risk against $1,580 to gain, 7.18 to 1, 220/1,800 = 12% : 88%. Correct. **Checks:** axe found nothing at any of the six states checked. Grid cells are right-aligned in tabular numerals. Each stake row carries its canonical term ("Ongoing Risk to Stop", …). |
| C9AR.5 In the Review | PASS | **Cards:** each card has a "Replay" button 28 px above the Action form and no chart (0 svg). **BREN summary:** "Trade P&L +$988.00 · +3.05R", "Current Risk · At Stop $672.00 · 2.07R", "Current Risk · At Worst case $832.00 · 2.57R", "Remaining Reward = Past the Target by $32.00 (0.10R)". **AXIO summary:** "Current Risk = Past the Stop by $300.00 (0.50R)". **DALE-hold summary:** "Past the Stop by $552.00 (0.36R)". None shows "$0.00 · 0.00R", and none has a Reward to risk row. **Before a crossing** (a Review at Wed 11-11): "Reward to risk = 11.69 to 1 · about 8% : 92% (Plan 0.29 to 1 · 78% : 22%)". **Review Date:** the overlay opens on it ("Mon Nov 16 · 11 of 11"; "Wed Nov 11 · 8 of 8" for that Review). **The trip away:** the started Exit and Intent survived Close. Price History opened the Detail with `session=2026-11-09&from=review`. "Back to the Review" returned to `…panel=Action&replay=open&session=2026-11-09`, with the overlay open on "Mon Nov 9 · 6 of 11" and the draft intact. **Saving:** one Save press stored exactly one Action each time (0→1, 1→2, 2→3). Focus after the Price History link is on `<body>` (defect 3). |
| C9AR.6 Finished Trades | PASS | **Sold out (BREN):** header "BREN · FINAL RESULT +$1,138.00", 10 cards through Fri Nov 13, "Nothing is at risk and nothing is left to gain. +$478.00 of the result was banked before the end.", no grid and no odds, "Sold 2 at $4.91, $0.91 above the Target". **DALE-U, Settlement Due:** "No Mark for the put on Fri Nov 20." with dashes. **DALE-U, after its Expiration:** "DALE · FINAL RESULT +$564.00", "Final result: the put expired Fri Nov 20.", "Expiration, Fri Nov 20 / Expired", 15 cards. **Planned Trade:** the tabs are Plan and Risk, Journal and Payoff, with no Replay button, and `?replay=open` opens nothing. |
| C9AR.7 Phone, touch, keyboard, offline | PASS | **Fills the screen:** at 375 and 320 (height 667, touch), from the Detail and from the Review card, the overlay covers the bottom navigation. **Fits:** the header to the bottom of the P&L chart spans 596–665 px of 667. Page and dialog scroll widths equal the viewport. **Charts:** the P&L chart is 200 px high; the strip reads "Worst case +$156 · Stop +$316 · Banked +$478 · Target +$956 · Risk $672 · $32 past the Target · Target reached · Sold 2"; no chart text overlaps or is cut; the smallest chart text is 10.5 px. **Touch targets:** all at least 44 px high (Close 44, Replay 46, paging 46, card heading 44). **Taps:** a tap on the chart moved the slider and left no hover box (count 0). **Keyboard:** everything is reachable and named, focus never left the overlay, and the slider's Home, arrow keys and End all worked. At the oldest page, focus was handed to "Newer sessions"; Enter on a card heading moved the slider; Escape returned focus to Replay. **Offline:** with the server stopped, reloading the Detail and the Review addresses reopened the overlay; it stepped and closed. **Defects:** the Plan block splits a sign from its number (defect 4), and the first-crossing line is misplaced (defect 2). |

### The coach's 15 points, looked at again

| # | Point | Now |
|---|---|---|
| 1 | Figures break; sign split | Fixed in the readout grid at every width. **The new Plan block splits "−" from "$324.00" at 375 and 320** (defect 4). |
| 2 | Replay 592 px wide | Fixed: 837, 997 and 1477 px at 1280, 1440 and 1920. |
| 3 | No key or dates; unlabelled line | Fixed. The key's swatch for the flags is a black square, though the flag is drawn red or green (minor 4). |
| 4 | The ratio flatters a loser | Fixed: odds shown beside the ratio, with the Plan's own. |
| 5 | Plan versus what happened | Fixed: the Plan block, each fill against the Plan, and the crossings. Misplaced on phones (defect 2). |
| 6 | The rows past a line | Fixed: one row, no "$0.00", no ratio row. |
| 7 | The "since" line shown three times | Fixed: it appears under Trade P&L and the Marks only. |
| 8 | Different names | Fixed: "Realized", a "$" on every price, two decimals, and the Review summary in the replay's words. The card shows "+3.05R" where the replay shows "3.05R" (minor 3). |
| 9 | Phone labels pile up | Fixed: the strip. |
| 10 | The cursor through the entry labels | Fixed at 1280, 1366, 1920 and on phones. **The stake tag covers the axis "$500" at 1440 and 1536** (defect 1). |
| 11 | The table too wide | Fixed: the session cards. |
| 12 | No Mark shouts | Fixed: one line, dashes, a shaded column, nothing bridged. |
| 13 | How far down a Trade can go is hidden | Fixed: the "Worst case … ↓" tag. |
| 14 | The date and the best sentence are quiet; the hover box moves the page | Fixed: the date sits beside the figure; "From here" is in normal ink (rgb 28,27,25); the hover box floats over the chart and the readout's top did not move (249 → 249). |
| 15 | The extremes' weight; the long title | Fixed: grey 13.6 px for remote, full strength for DALE; the title is "Trade P&L". |

Stage A critic-2's carried defects:
- **1a** (cards past a line): fixed.
- **1b** ("Strike $100" in the Plan block): fixed.
- **2** (minus sign wraps): fixed in the grid, but back in the Plan block (defect 4).
- **3** (stock axis end): fixed.
- **4** (Expiration named): fixed.

## 3. Overall: **FAIL** (1 high, 3 moderate)

**Defects**

1. **High: on the entry session at 1440 and 1536 wide, a stake tag is printed over the P&L chart's "$500" axis figure.**
   - **Steps:** Trade Detail, BREN (or CORV), Replay, viewport 1440×800, press Home on the slider (Mon Nov 2).
   - **Expected:** C9AR.2: "On the entry session nothing is drawn through a label". A280 says no label is placed over another.
   - **Actual:** "Remaining Reward $928" (BREN) and "Remaining Reward $834" (CORV) are drawn to the left of the stake bar, on top of the y-axis figure "$500". Both texts are garbled ("Remåining"), and "$500" cannot be read.
   - **Scope:** it does not happen at 1280, 1366 or 1920, or on phones. Screenshots: `f2-1440-BREN-entry.png`, `zoom-bren1440entry.png`.
2. **Moderate: on a phone, the first-crossing line moves from the top of the replay to below the charts and the key.**
   - **Steps:** Trade Detail, AXIO (or BREN, DALE-hold, CORV), Replay, at 375×667 or 320×667.
   - **Expected:** W64 puts it "After the status line" ("Past the Stop since Mon Nov 9.").
   - **Actual:** the paragraph `.replay-crossing` is placed at y≈709–751 (at 1280 it is at y 140). It sits after the strip and the key and just above "How it is going". The top of the screen reads only "Past the Stop by $300.00 (0.50R)." and then "From here…". The line is below the first screen, cut off from its status line, and reads as a stray sentence. Screenshot: `p375d-AXIO.png`.
3. **Moderate (accessibility): after the overlay's "Price History" link from a Review card, focus is on `<body>` and the session's column is not brought into view.**
   - **Steps:** Review, AXIO card, Replay, move the slider to Mon Nov 9, press Price History.
   - **Expected:** the UI contract, line 125, requires "logical focus after navigation". The same link from Trade Detail's overlay focuses the column header "Mon Nov 9".
   - **Actual:** the address is `…?drawer=price-history&session=2026-11-09&from=review`, but focus is on `body`. The Mon Nov 9 column lies at x 1207–1299, outside its scroller's 622–1214, with `scrollLeft` 0, so the session is not visible. Stage A's critic-2 left this for this gate to check again. Screenshot: `f5-1280-AXIO-pricehistory.png`.
4. **Moderate: on a phone, the Plan block lets a minus sign wrap away from its amount.**
   - **Steps:** Trade Detail, BREN, Replay, 375 wide, scroll to "The Plan".
   - **Expected:** "A minus sign never parts from its number" (the breakdown's summary, and coach point 1). Critic-2 defect 2 was carried as "keep a signed amount on one line".
   - **Actual:** the BREN line reads "Stop: call at or below $0.80 · P&L if hit –" on one line and "$324.00" on the next, so the loss reads as a positive amount. The text measurement also flags AXIO's "−$600.00" and CORV's "−$318.00" at 375. At 320 the odds pair splits ("33% :" / "67%", and likewise "25% : 75%", "78% : 22%", "27% : 73%"). Screenshots: `plan-375-BREN.png`, `plan-320-AXIO.png`.

## 4. Minor observations
1. **Reload loses the session.** A reload inside the overlay reopens it on the latest session, not the session the slider was on: the address holds `replay=open` and no `session`. Closing and reopening without a reload does keep the earlier session, so on the Review a reopen does not rest on the Review Date.
2. **The final result has no R.** The headline and the final card show "+$1,138.00" with no R (W36 shows "· 3.05R"). Stage A's critic-2 noted this too.
3. **The R's sign differs.** The Review summary shows "+$988.00 · +3.05R", where the replay shows "3.05R".
4. **The key's flag swatches.** "Target reached" and "Stop breached" are shown as black squares in the key, but the flags are drawn green or red.
5. **Labels on lines away from the entry session.**
   - On AXIO from Mon Nov 9 on, the "Stop breached" flag label sits on the hatched "past" area.
   - On DALE-U, Settlement Due, the dotted Target line runs through "Target +$444". The "Worst case −$33,936 ↓" tag sits on the Stop's dashed line at the bottom edge, so it reads as if it labels that line.
6. **An "up $0.00" line.** The expired put's final session still says "up $0.00 since Thu Nov 19" (noted in stage A).
7. **Many tab stops.** Each revealed session in the chart is its own tab stop, 11 on BREN (noted in stage A).
8. **Card count.** At 375 and 320, the session carousel shows one card per page.
9. **"Add the Mark" focus.** The link lands on the Review's Marks panel with the Tue Nov 10 put row on screen, but focus is on the first "Correct" button, not on that row's Price field.
10. **The Back address after Close.** On the Review, closing the first card's overlay with Close goes back to `/review` without `trade`/`panel`. The card stays open; the other cards keep `trade` and `panel`.
11. **No console errors** in any run.
12. **Not checked:** the shell's banners under the overlay (P153), because it needs the releases build.
