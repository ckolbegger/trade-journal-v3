# D09 critic-2 report

## 1. Header
- **When:** Wed 2026-11-18, about 22:00 to 22:50 EST.
- **Commit:** HEAD `2b9497c7` on `claude-opus-5.5`. Built with `npm run build`.
- **Versions:** Node v26.12.0, Playwright 1.63.0, Chromium 153.0.8010.12 (new headless, persistent profiles).
- **Server:** `npx vite preview --port 5175 --strictPort`, started and stopped by my own wrapper (`test-results/critic-d09a-2/run.sh`). Every run was inside `./.claude/scripts/with-browser-lock.sh`. Nothing is listening on 5175 now.
- **Profiles:** fresh ones under `test-results/critic-d09a-2/profiles/`. Trades were built with `build()` from `e2e/d9/support.ts`: BREN (R-BREN-U to Mon 11-16), DALE with the R-DALE-D series and a buy-back of 3 at $2.59 on Tue 11-10 (to Fri 11-13), AXIO with R-AXIO-D (to Mon 11-16), CORV (R-CORV-D to Wed 11-11), K-sale, DALE-U with its Expiration recorded, and DALE held to Fri 11-20. AXIO with R-AXIO-U was built with a first lot of 100, and I recorded the second lot (100 at $51.40, Fri 11-06) through the Record entry form. For C9.3, one profile holds BREN, CORV and AXIO, planned and entered with no Marks; I entered every Mark myself in the Review. Every helper worked; none failed.
- **No tracked file was edited** (`git status --porcelain` is empty) and nothing was committed. Scripts, screenshots and dumps are in `test-results/critic-d09a-2/`.

## 2. Results

| Flow | Result | Key observations |
|---|---|---|
| C9.1 The ten-second read | PASS | **Winning option, BREN at Mon 11-16:** "+$988.00 · 3.05R", green (rgb 29,107,52), with a green card edge. "Target reached, $32.00 past it." "From here: $672.00 at risk back to the Stop ($510.00 of it open profit) · no cap above. Even at the Stop this Trade would end $316.00 ahead." **Losing option, DALE (R-DALE-D) at Fri 11-13:** "−$1,476.00 · −0.96R", red (rgb 163,38,27). "Past the Stop by $213.00 (0.14R)." "From here: Worst case $15,987.00 more · $1,203.00 back up to the Target." **Stock, AXIO-D at Mon 11-16:** "−$1,040.00 · −1.73R", red, "Past the Stop by $300.00 (0.50R)." **Stock, AXIO-U:** "+$1,120.00 · 1.87R", green. Colour follows the result at every session: BREN Tue 11-03 at −$48.00 is red even with "$1,004.00 more to the Target". At 1280×800 in the Detail drawer, the headline starts at y=141 and the P&L chart ends at y=628, so price and P&L are on screen together. |
| C9.2 Watching it unfold | **FAIL** | I stepped from Home to End with the arrow keys on BREN (partial sale), AXIO-U (second lot), CORV (missing put Mark), DALE-D, AXIO-D and K-sale. **No later Trade P&L figure or later session date leaked into the DOM for the option Trades.** For stock, the axis end label is the last session's date (Defect 3). **Lines step:** on BREN the Stop line goes from "Stop −$324" to "Stop +$316" on Thu 11-12 while the Target stays "+$956". On AXIO-U the lines go from −$300/+$600 to "Stop −$740"/"Target +$1,060" on Fri 11-06, with the marker "Bought 100 at $51.40". On DALE-D they go from −$1,536/+$444 to "Stop −$1,263"/"Target −$273", with the marker "Bought 3 at $2.59" and the label "Realized −$495". **Banked:** a solid dark-green band "Banked +$478" from Thu 11-12. **Gap:** on CORV Tue 11-10 the area breaks, the headline reads "Mark missing: CORV Nov 20 $80 Put, Tue Nov 10" with "No Mark.", the card edge turns neutral, and the table cells say "No Mark". **Failure:** the charts' overrun labels ("$180 past the Stop", "$32 past the Target" and so on) and the "Strike $100" line are not in the table, and the strike is not in the readout either (Defect 1). |
| C9.3 In the Review | PASS | Three cards in this order: BREN, AXIO, CORV. On each I saved the Marks (Save Marks (10), (5), (9); CORV's Thu 11-05 put Mark left empty), and the card moved to Action. The replay's "Replay" section sits above the Action form and rests on the Review Date: "Fri Nov 6 · 5 of 5". BREN shows "−$156.00 · −0.48R", AXIO "−$380.00 · −0.63R", CORV "+$927.00 · 2.92R, Target reached, $60.00 past it." I moved each slider back one session by keyboard. On AXIO at "Thu Nov 5 · 4 of 5", I followed Price History to `/trades/<id>?drawer=price-history&session=2026-11-05&from=review` (the Price History tab selected). "Back to the Review" led to `/review?trade=<id>&panel=Action&session=2026-11-05`, with the card open, the Action panel open, and the slider on "Thu Nov 5 · 4 of 5". A single press of Save (Hold) saved each Action: the form went away and the status reached "Complete". |
| C9.4 Narrow, keyboard and offline | PASS | At 375 and 320 px the page never scrolls sideways (scrollWidth equals clientWidth) in the Detail drawer or in the Review card. From the top of the headline to the bottom of the P&L chart is 502 to 571 px, which fits in 667. Phone labels are in use ("BREN price", "Trade P&L", "Risk $1,221", "Sold 2"). **Keyboard only:** Tab reaches the tablist ("Today"), ArrowRight moves to "Replay", and Enter opens it. Inside the drawer the tab stops are the tabpanel, "Previous session", the slider "Session", 11 session buttons ("Mon Nov 2" …), "Price History" and the summary "Session by session" (whose open table is a focusable region named "Session by session"). Every stop has a name. Left, Right, Home and End move the slider, and its aria-valuetext is "Fri Nov 13 · 10 of 11. +$1,138.00 · 3.51R". Focusing a session button shows its hover box, and Enter on it moves the slider. Price History from the drawer focuses the session's column header ("Thu Nov 12"). Position focuses that Execution's row, and Journal focuses the "Thu Nov 12" heading. A resize keeps the session. axe found no violations in the drawer or the Review card at either width. **Offline:** with the server killed and the context offline, the reload showed "+$988.00 · 3.05R | Mon Nov 16 · 11 of 11", the slider still worked, and the Review card's replay also read offline. |

Also checked: a crossed Stop changes the headline in both directions (AXIO-D: "Past the Stop by $180.00 (0.30R)." on Mon 11-09, "Behind: 63% of the way to the Stop." on Fri 11-06, and back again). Closed Trades: K-sale reads "Final result: sold out Fri Nov 13." and "Nothing is at risk and nothing is left to gain. +$478.00 of the result was banked before the end." DALE-U reads "Final result: the put expired Fri Nov 20." with the marker "Expired". A Detail opened directly shows no "Back to the Review".

## 3. Overall: **FAIL**

**Defects**

1. **Some chart figures are missing from the session table, and the strike from the readout too (C9.2). Severity: High.**
   - **Steps:** Open AXIO-D (R-AXIO-D to Mon 11-16), move to Mon 11-09, and open "Session by session". Do the same on BREN at Mon 11-16.
   - **Expected:** C9.2's pass condition says "every figure in the charts is in the readout and the table". The plan's T9.11 calls the table the charts' text equivalent.
   - **Actual:**
     - The P&L chart labels "$180 past the Stop" (AXIO-D, Mon 11-09), "$32 past the Target" (BREN, Mon 11-16), "$213 past the Stop" (DALE-D) and "$60 past the Target" (CORV, Fri 11-06).
     - The readout shows these as "Stop Overrun $180.00 · 0.30R" and "Target Overrun $32.00 · 0.10R". The table has no overrun anywhere: its "Current Risk at Stop" cell reads "$0.00" (AXIO-D Mon 11-09 to Mon 11-16) and "Remaining Reward at Target" reads "$0.00" (BREN Thu 11-12 to Mon 11-16). A text search of AXIO-D's table finds no "180" and no "300.00".
     - The price chart's "Strike $100" / "Strike $57.50" / "Strike $80" line is in neither the readout nor the table.
   - **Impact:** someone reading only the table cannot see, for any earlier session, how far past a line the Trade was.

2. **The minus sign wraps away from its amount in the readout's stake rows. Severity: Moderate.**
   - **Steps:** Open DALE-D's Replay at 1280×800, or BREN at Mon 11-02, or AXIO-U at Tue 11-17.
   - **Expected:** a signed figure reads as one unit (the UI contract's number formatting; W43).
   - **Actual:** "At Worst case $15,987.00 · 10.41R · P&L –" ends one line and "$17,463.00" starts the next. The same happens with "P&L –" / "$644.00" (BREN), "P&L –" / "$740.00" and "P&L –" / "$10,140.00" (AXIO-U), and "No Mark · P&L –" / "$318.00" (CORV, Tue 11-10).
   - **Impact:** a loss can be read as the positive amount "$17,463.00". It happens at desktop width, not only on phones.

3. **For stock Trades, the time axis shows the last session's date before that session is revealed. Severity: Low.**
   - **Steps:** Open AXIO-U's Replay and press Home ("Mon Nov 2 · 1 of 12").
   - **Expected:** T9.10 says "no figure, date or point of a session after the slider's".
   - **Actual:** the P&L chart's axis end label reads "Tue Nov 17" (AXIO-D shows "Mon Nov 16") at every earlier session. Option Trades show the contract's expiration ("Fri Nov 20") there, which is not a session. No later figure shows.

4. **An Expiration is labelled as an Execution. Severity: Low.**
   - **Steps:** Open DALE-U's Replay (Expiration recorded) on Fri 11-20.
   - **Expected:** in the glossary, an Expiration is a Position Change and not an Execution.
   - **Actual:** the readout's Position group reads "Execution, Fri Nov 20" with "Expired" underneath. The next word makes the meaning clear, but the term is wrong.

## 4. Minor observations
- **"$" signs:** an option Trade's Underlying price has no "$" in the readout, the table and the hover box ("BREN Mark 104.00", "down 0.60 since Fri Nov 13", Stop column "54.00"). The chart says "$104.00", and a stock Trade says "$50.40". The Conditions card also leaves the "$" out, so this may be the app's existing convention.
- **Reward-to-risk decimals vary:** "5.4 to 1", "0.7 to 1", "4 to 1", "2 to 1" sit beside "2.64 to 1".
- **Final sessions drop the R:** the headline is "+$1,138.00" or "+$564.00", where W36 shows "· 3.05R".
- **"up $0.00 since Thu Nov 19"** appears on DALE-U's final session.
- **Crowded labels at 320 px:** "Worst case +$156" is struck through by its own dashed line and overlaps "Break-even". "Target +$956" touches "Sold 2". On K-sale's final session, "Sold 2 at $4.00" sits on the edge of the "Banked +$1,138" band, and the closing marker's label "Sold 2 at $4.91" is dropped (it is still in the readout).
- **Return from Price History:** at 1280 the page lands at the top of the card, and the replay's charts start around y=620, below the fold. Focus after following the Review card's Price History link is on `<body>`. The Detail's own Price History button focuses the session's column.
- **Narrow Detail:** the Replay drawer starts at y≈450 to 500, below the rail, so the trader scrolls once to reach it. After that, the headline and both charts fit one screen.
- **Phone table:** it is 2,174 px wide inside a 259 to 314 px scroll region (16 columns). This is usable but heavy, and D9A-R's session cards will replace it.
- **Keyboard path:** each revealed session is a tab stop (11 stops on BREN) between the slider and Price History.
- **A leftover hover box:** a resting pointer over the chart leaves a session's hover box ("Trade P&L: −$80.00 · −0.25R") showing below the chart while the slider is on another session.
