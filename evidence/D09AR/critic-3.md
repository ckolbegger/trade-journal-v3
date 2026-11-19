# D09AR critic-3 report

## 1. Header
- **Date and time:** Thu 2026-11-19, 18:35 to 18:54 EST
- **Commit:** `7a776e7e21fe0e84453ad8cb612a944eea157287`, "evidence(D09AR): full run before gate critic-3, all green"
- **Versions:** Node v26.12.0. Playwright 1.63.0 with its bundled Chromium (`channel: 'chromium'`, build 1248), headless.
- **Servers:** two, both on port 5175 only, both wrapped in `.claude/scripts/with-browser-lock.sh`, and both stopped by me.
  1. `npm run build`, then `npx vite preview --port 5175 --strictPort`. Every flow ran on this one. I stopped it on purpose for the offline check.
  2. `npm run build:faults`, then `vite preview --mode faults --outDir dist-faults --port 5175`. Used for the P153 banner check.
- **Port at the end:** `lsof` shows 5175 free, and no `vite preview` process is running.
- **Setup:** profiles were built with `e2e/d9ar/support.ts`'s `build`, `buildPlanned` and `buildReview`. Every builder succeeded. The AXIO second lot (R-AXIO-U) is `build`, then `recordEntry` of 100 at $51.40 on Fri Nov 6. Everything else was driven by role and label in Chromium. Touch is emulated (`hasTouch`), with the viewport at 375×667 and 320×667.
- **Scratch files:** scripts and screenshots are in `test-results/critic-d09ar-3/` (git-ignored).
- **Tracked files:** I edited none. `git status --short` at the end is empty. At the start it listed ` M evidence/D09AR/structural.md`, which I never touched; it was no longer listed at the end. No commits, no stash.
- **Console:** no browser console errors on any run.

## 2. Results

| Flow | Result | Key observations |
|---|---|---|
| **C9AR.1 The overlay** | PASS | Checked on BREN (winning option), DALE-hold (losing option) and AXIO (stock).<br>- The dialog box is 1280×900, exactly the viewport. All four corners and the sidebar point hit the dialog. The dialog is named "Replay, BREN".<br>- Header: "BREN · Trade P&L +$988.00", "AXIO · Trade P&L −$1,040.00", "DALE · Trade P&L −$2,088.00" (shown in uppercase by CSS).<br>- Opening adds one history entry and `?replay=open`.<br>- Close, Escape and Back each return to `/trades/<id>` with focus on the "Replay" button. Back never left the Trade.<br>- Reload keeps the overlay open. It reopens on the latest session (see minor observations). Close, Escape and Back after a reload all return focus to "Replay".<br>- Links, on BREN's Thu Nov 12 sale session:<br>&nbsp;&nbsp;- Price History: the drawer opens with focus on `th "Thu Nov 12"`.<br>&nbsp;&nbsp;- Position: focus on "Sell to close 2 BREN Nov 20 $100 Call @ $4.00…".<br>&nbsp;&nbsp;- Journal: focus on `h3 "Thu Nov 12"`.<br>&nbsp;&nbsp;- The same on AXIO's Mon Nov 9 and DALE's Mon Nov 2. |
| **C9AR.2 The ten-second read, wide** | PASS | Checked on four Trades at 1280, 1366, 1440, 1536 and 1920.<br>- P&L chart width: 837, 923, 997, 1093 and 1477 px. The readout (372 px wide) sits beside the charts.<br>- No horizontal scroll, and the smallest chart text is 10 px.<br>- A range-rect scan of every $, R, % and "to 1" figure found no figure broken across lines and no stranded sign, at every width and on the entry session.<br>- The key is there, e.g. "Mark · Open profit · Break-even · At Stop · At Target · At Worst case · Strike · …". The axis reads "Mon Nov 2" … cursor date … "Expires Fri Nov 20"; the stock has nothing at the right end.<br>- Every line is labelled on the open Trades: "Max reward +$564" on DALE, and an off-scale tag "Worst case −$33,936 ↓".<br>- Entry session (Home key): level labels sit right of the cursor's column ("Target +$956", "Stop −$324", "Strike $100" at the right end). Nothing is drawn through a label; the only stroke hits were gridlines behind the cursor's own value. |
| **C9AR.3 Watching it unfold, with the cards** | PASS | Stepped through all 11 sessions of R-AXIO-U (second lot), BREN (partial sale), AXIO (sale below the Stop) and CORV (missing Mark).<br>- **Reveal and sync:** no later session's date appears anywhere in the dialog. Card count = slider index + 1, and the slider's card carries `aria-current` and is visible.<br>- **Paging:** "Earlier sessions" pages show 4 cards at 1280 and 1 at 375. Choosing card "Tue Nov 3" moves the slider to Tue Nov 3, leaving 2 cards. "Previous session", pressed after paging away, brings the cards back to Fri Nov 13.<br>- **Figures:** every chart dollar figure is in the readout or a session card. The exceptions are axis ticks and the Stop, Target and Strike prices, which sit in "The Plan" block ("Strike $100", "Stop: call at or below $0.80 · P&L if hit −$324.00").<br>- **Fills against the Plan:** "Bought 4 at $1.61, at the Plan's entry"; "Bought 100 at $51.40, $1.40 above the Plan's entry"; "Sold 100 at $45.60, $1.40 below the Stop"; "Sold 2 at $4.91, $0.91 above the Target".<br>- **First crossings:** "Target first reached Fri Nov 6." from CORV's Fri Nov 6 on, including Mon Nov 9 ("Ahead: 74% of the way to the Target"). "Past the Stop since Mon Nov 9." on AXIO. Card Events read "…; Stop first breached".<br>- **Gap (CORV Tue Nov 10):** "No Mark for the put on Tue Nov 10. Add the Mark" appears once, at normal size. Rows show "—". The chart shades a "No Mark" column with no bridge, and nothing is carried across it.<br>- Arithmetic spot checks (AXIO-U Fri Nov 6: P&L +$220.00, 0.88 to 1, 53% : 47%; DALE; CORV) all correct. |
| **C9AR.4 A losing Trade is not flattered** | PASS | **DALE-hold**<br>- Wed Nov 11: "11.69 to 1 · about 8% : 92% (the Plan was 0.29 to 1 · 78% : 22%)". The readout has "Odds: Target first : Stop first, estimated with no edge and no time limit."<br>- Thu Nov 12: "Past the Stop's amount by $18.00 (0.01R) · at Stop −$1,536.00".<br>- Mon Nov 16: one row, "Past the Stop by $552.00 (0.36R) · at Stop −$1,536.00", set above the headings. There is no At Stop row, no Reward to risk row and no "$0.00".<br>- At Worst case "$31,848.00 20.73R −$33,936.00" is at 16 px, full strength.<br>**AXIO**<br>- Fri Nov 6: "7.18 to 1 · about 12% : 88% (the Plan was 2.00 to 1 · 33% : 67%)". At Worst case is at 13.6 px and grey.<br>- Mon Nov 9: "Realized −$440.00"; "Past the Stop by $180.00 (0.30R) · at Stop −$740.00".<br>**Chart tags:** "Worst case −$33,936 ↓" and "Worst case −$5,440 ↓". |
| **C9AR.5 In the Review** | PASS | Review dated Mon Nov 16 holding AXIO, DALE-hold and BREN.<br>- Each card has a "Replay" button directly above the Action form and no SVG.<br>- Summaries use the replay's words: "Trade P&L −$1,040.00 · −1.73R", "Current Risk · At Worst case $4,400.00 · 7.33R", "Remaining Reward · At Target $1,200.00 · 2.00R". Hover titles carry the canonical terms. See Defect 1 for the label on the past-a-line row.<br>- The overlay rests on "Mon Nov 16 · 11 of 11".<br>- Slider to Thu Nov 12, then the "Price History" link (`?drawer=price-history&session=2026-11-12&from=review`) gives focus on `th "Thu Nov 12"`. "Back to the Review" returns to `…&panel=Action&replay=open&session=2026-11-12` with the overlay on Thu Nov 12. Close puts focus on "Replay".<br>- Hold and the typed Intent survived the round trip. One Save gives "Done · Action saved". The stored data holds exactly one Daily Trade Review entry per Trade, version 1, with Hold and the typed Intent. |
| **C9AR.6 Finished Trades** | PASS | **Sold out (K-sale)**<br>- Header "BREN · Final result +$1,138.00". Text: "Final result: sold out Fri Nov 13." and "Nothing is at risk and nothing is left to gain. +$478.00 of the result was banked before the end."<br>- The readout's "Final result" group has no stake rows and no odds. Cards run Fri Nov 13 … Mon Nov 2.<br>**Expired put, before the Expiration is recorded** (clock Mon Nov 23)<br>- Header "DALE" alone; "No Mark for the put on Fri Nov 20."<br>**After it is recorded** (recorded through the UI)<br>- "DALE · Final result +$564.00"; "Final result: the put expired Fri Nov 20."; "Nothing is at risk and nothing is left to gain."<br>- 15 cards, the last with Events "Expired".<br>**Planned:** no Replay button; the tabs are Plan and Risk, Journal, Payoff.<br>On both finished Trades the Stop and Target lines are drawn with no labels (Defect 2). |
| **C9AR.7 Phone, touch, keyboard, offline** | PASS | Checked at 375 and 320 by 667, touch, from Trade Detail (BREN, DALE, AXIO, CORV) and from Review cards (BREN, AXIO, DALE).<br>- The dialog fills the viewport.<br>- Header, headline and both charts end at most 665 px down, inside 667. No horizontal scroll (scrollWidth equals the width) and no element outside the viewport.<br>- On a phone the P&L drawing keeps the title, axis figures and slider value. The labels are in the strip, e.g. "Worst case +$156 · Stop +$316 · Banked +$478 · Target +$956 · Risk $672 · $32 past the Target · Target reached · Sold 2". No chart text is cut.<br>- Tapping "Thu Nov 12" moves the slider, and so does tapping the slider track. No hover box is left behind.<br>- 60 Tab presses visited only named controls, and focus never left the dialog; Shift+Tab also stays inside. End, then Escape, returns focus to "Replay"; Enter on "Replay" opens the overlay.<br>- A live resize from 1280 to 375 with the overlay open kept the session. After Close, the page has bottom navigation and the unsaved Action is intact.<br>- **Offline:** with the server stopped, a reload reopens the overlay, a tap moves the slider, and a Review card's replay opens.<br>- **P153:** the "Storage not protected" icon (dist build) and the "An update is ready" notice (faults build) stay in place, inert, under the overlay, and are on top again after Close. |

**The coach's 15 points, checked again**

| # | Point | Now |
|---|---|---|
| 1 | Figures broken; sign apart from number | Fixed. Grid with one figure per cell; no breaks found at 320 to 1920. |
| 2 | 592-px replay | Fixed. Full-page overlay; chart 837 to 1477 px wide. |
| 3 | No key, no dates, unlabelled line | Fixed on open Trades. The key, "Mon Nov 2", "Expires Fri Nov 20" and "Max reward +$564" are present. Finished Trades still draw unlabelled lines (Defect 2). |
| 4 | Ratio flatters a loser | Addressed by decision 4: "11.69 to 1 · about 8% : 92%". |
| 5 | Plan versus what happened | Fixed. Plan block, fills against the Plan, first crossings ("Target first reached Fri Nov 6" on CORV's Mon Nov 9). |
| 6 | Rows past a line confusing | Fixed in the replay: one plain row, no "$0.00", no status in the ratio row. The card summary still files it under "Current Risk" or "Remaining Reward" (Defect 1). |
| 7 | Change shown three times | Fixed. The "since" line appears only under Trade P&L and the Marks. |
| 8 | Different names | Fixed in the replay and card: "Realized −$440.00", "$104.00", two-decimal ratios, "Stop: DALE at or below $54.00" and "Target: put at or below $0.20". One small mismatch remains: the card shows "+3.05R" where the replay shows "3.05R" (minor observations). |
| 9 | Phone labels pile on the drawing | Fixed for the P&L chart (strip). The price chart's "Strike" label is still crossed at 320 (Defect 3). |
| 10 | Cursor through labels on entry | Fixed. Labels sit at the right end, clear of the cursor's column. |
| 11 | Table too wide | Fixed. Session cards. |
| 12 | No-Mark session shouts | Fixed. One normal line, dashes, no bridge (P146). |
| 13 | Chart hides the downside | Fixed. "Worst case −$33,936 ↓". |
| 14 | Date and sentence quiet; hover moves page | Fixed. The date sits beside the headline, the sentence is in normal ink, and the hover box floats with the readout staying where it is. |
| 15 | Extremes weighted like Stop and Target | Fixed. Grey at 13.6 px for stock and long options; full strength for DALE. "Trade P&L" title. |

**Critic-2 carry-overs:** 1a, 1b, 2, 3 and 4 are fixed ("Expiration, Fri Nov 20 · Expired"). Of its minor notes, these still stand: the final headline has no R, and "up $0.00 since Thu Nov 19" appears on the expired put. Fixed: focus after the Review's Price History round trip, and each session being its own tab stop (the hits now give one tab stop).

## 3. Overall: PASS (1 moderate, 2 low)

**Defect 1. Moderate. The Review card summary files the past-a-line row under "Current Risk" or "Remaining Reward".**
- **Steps:** open the Review dated Mon Nov 16 and expand the AXIO, DALE and BREN cards, at 1280 and at 375.
- **Expected:** W56 sets the past row "above the two headings". Decision 7 says that past a line the card "uses the replay's wording". Coach point 6: "An overrun is neither a risk nor a reward."
- **Actual:**
  - AXIO: label "Current Risk", value "Past the Stop by $300.00 (0.50R)".
  - DALE: label "Current Risk", value "Past the Stop by $552.00 (0.36R)".
  - BREN: label "Remaining Reward", value "Past the Target by $32.00 (0.10R)".
- **Why it matters:** the words are the replay's, but the label calls a passed Target the "Remaining Reward". The replay itself puts this row outside both headings.

**Defect 2. Low. Finished Trades draw the Stop and Target lines with no label.**
- **Steps:** open the replay on BREN sold out (Fri Nov 13), or on DALE after its Expiration is recorded (Fri Nov 20), at 1280.
- **Expected:** A280: "A line is drawn with its label or not at all, break-even excepted." C9AR.2: "Every drawn line has a label."
- **Actual:** the stepped red dashed At Stop line and the green dotted At Target line are drawn across the history with no text. The P&L chart's text is only "Banked +$478 / Banked +$1,138 / Target reached / Sold 2 at $4.00 / Break-even". The key names the line styles, and the values are in the Plan block.

**Defect 3. Low. Some labels are drawn over, on sessions other than the entry.**
- **Steps and actual:** in each case a line, cursor or dot is drawn through a label.
  - BREN, Thu Nov 12 onward, at 1280: "Sold 2 at $4.00" is crossed by the dotted Target line and its hatching.
  - AXIO, Mon Nov 9 onward: "Realized −$440" is crossed by the sale marker line and the flag pole, and "Stop breached" sits on the hatching.
  - CORV Tue Nov 10 and DALE (expired) Fri Nov 20: the vertical "No Mark" column label lies under the blue cursor.
  - At 320, DALE and CORV: "Strike $57.50" and "Strike $80" are crossed by the price line and its dots.
  - At 320, DALE Mon Nov 16: a Mark dot sits on the minus sign of the slider value "−$2,088". The red headline "−$2,088.00" above it is clear.
- **Expected:** the coach's points 9 and 10, and A280's intent that labels stay legible. The pass condition requires this only for the entry session, which passes, so this defect is Low.

## 4. Minor observations
- **Reload resets the session.** A reload with the overlay open always lands on the latest session, even after stepping to Thu Nov 12; the address carries no `session` (A274 allows this). Separately, after closing an overlay opened from a link with `&session=2026-11-09`, the address keeps `?session=2026-11-09`.
- **Final headline has no R.** A final session's headline is "+$1,138.00" or "+$564.00", with no R (carried from critic-2). The expired put's final session also shows "up $0.00 since Thu Nov 19".
- **"+3.05R" versus "3.05R".** The Review card summary writes "+$988.00 · +3.05R"; the replay writes "+$988.00 · 3.05R". At 375 the card breaks that pair after the "·".
- **Key swatches.** The key shows "Stop breached" and "Target reached" as black squares, while the flags on the chart are red and green.
- **Hover box.** It floats at the top right of the charts and can cover the cursor's own value ("$104.00").
- **Cursor date at 320.** The phone axis at 320 drops the cursor's date (W67); the date is still shown beside the slider ("Mon Nov 16 · 11 of 11").
- **Focus timing.** After a reload, focus reaches "Replay" a moment after Close or Escape; read at once it was still on `<body>`. At rest it is correct.
- **Banners checked.** For P153 I triggered only the storage warning and the update notice. The read-only and "another tab" banners were not triggered (`__tjFaults` was not exposed on the page I loaded).
