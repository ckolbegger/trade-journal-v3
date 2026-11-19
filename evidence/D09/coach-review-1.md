# D09 Trade replay: coach review 1

2026-11-18. Reviewed as a trading coach choosing tooling for students. The real app, built fresh and served on port 5175 under the browser lock, on fresh profiles. No code was changed and nothing was committed.

Screenshots, scripts and text dumps are in `test-results/coach-review-1/`. File names below are in that folder. Naming: `d-` is the Trade Detail at 1280 wide (`s00` is Mon Nov 2, `s10` is Mon Nov 16), `p-` is the Trade Detail at 375 wide, `r-` is the Review card, `w-` is other widths.

**One thing to know first.** While looking at the recent history I read the last commit's note in `evidence/D09/DECISIONS-PENDING.md`, which lists the user's four layout concerns. This review was meant not to see them. Everything below comes from my own screenshots of the fresh build, but where I agree with those four points (suggestions 1, 2, 7 and 9) it is not an independent confirmation. One of the four I did not see: on the fresh build "Risk" is not drawn on top of "Banked" at 1280 wide (`d-bren-s10.png`).

## 1. Score: 6 out of 10

The thinking is right and I have not seen it in other journals: every session says what is at risk from here, what is left to gain, and how that compares with the Plan, and every figure I recomputed by hand was correct. The presentation on the Trade Detail holds it back: a 553-pixel chart with 9-pixel labels and no key, and a readout that breaks figures across three lines and splits a minus sign from its number. I would put the Review card's replay in front of students at desktop width today; I would not put the Trade Detail's or the phone's in front of them yet.

## 2. What works

- **The "From here" sentence.** "From here: $844.00 at risk to the Stop · $436.00 more to the Target · 0.52 to 1 (the Plan was 2.95 to 1)" (BREN, Wed Nov 11) is exactly the question I want a student to ask when a Trade is working.
- **Open profit counted as risk.** "$1,437.00 at risk back to the Stop ($1,119.00 of it open profit)" (CORV) teaches that unbanked profit is money at risk.
- **The Stop line that steps up after a sale.** On BREN the Stop's result moves from −$324 to +$316 when half is sold at the Target, with "Even at the Stop this Trade would end $316.00 ahead." That is the best lesson on partial profit-taking I have seen drawn.
- **Past the Stop is said plainly.** "Past the Stop by $300.00 (0.50R)" in red, with a hatched area (AXIO, DALE). The cash-secured put's careful case is handled too: "Past the Stop's planned amount by $18.00, though DALE is still above $54.00."
- **The cash-secured put's real downside is on the page**: Worst case $31,848.00 more, P&L −$33,936.00 (DALE).
- **The figures agree.** Chart, readout and table gave the same numbers in every session I compared, for all four Trades. I recomputed BREN (Mon Nov 2, Thu Nov 12), AXIO (Mon Nov 9), CORV (the Plan) and DALE (Mon Nov 2, Thu Nov 12) by hand; all correct.
- **The Review card at desktop width** gives the chart 855 pixels and 13 to 14-pixel labels; it reads well (`r-1280-BREN-viewport.png`).
- A later session is never shown ahead of the slider, and stepping is quick. No errors in the browser console on any run.

## 3. Suggestions, most important first

**1. The readout breaks figures across lines and splits the minus sign from its number. High.**
- Trades: all. Width: desktop Trade Detail worst; phone and Review card too.
- Seen: each stake figure is three figures joined by dots in a cell about 130 pixels wide, so it wraps unevenly: "$1,437.00 · / 4.52R · P&L – / $318.00" (`d-corv-s10.png`), "P&L – / $644.00" (`d-bren-s00.png`), "P&L – / $5,440.00" (`d-axio-s05.png`), "P&L – / $33,936.00" (`p-daleloss-s05.png`). A student can read "$33,936.00" as a gain. Labels sit left and values right, so "At Stop" and "At Worst case" look like one row with two unrelated heights. Meanwhile the "How it is going" column has a large empty area under it.
- Change: set the stake figures as a small grid, one row per condition and one column per figure, with the user's headings kept as the row groups:

  | | From here | R | Trade ends at |
  |---|---|---|---|
  | **Current Risk** · At Stop | $672.00 | 2.07R | +$316.00 |
  | At Worst case | $832.00 | 2.57R | +$156.00 |
  | **Remaining Reward** · At Target | $436.00 | 1.35R | +$956.00 |
  | At Max reward | No cap above | | |

  Never let a sign or a currency figure break across lines. Let this group take the full width of the readout.

**2. On the Trade Detail the replay is 592 pixels wide on any screen. High.**
- Trades: all. Width: desktop.
- Seen: at 1280, 1440 and 1920 wide the replay is 592 pixels and the P&L chart 553 by 181, with labels of 8.6 and 9.1 pixels (`d-bren-01-replay-first-view.png`, `w-bren-1920-first-view.png`, which has about 390 empty pixels each side). A 768-wide tablet gets a bigger chart (697) than a 1920 monitor. The Review card gives the same replay 894 pixels (`r-1280-BREN-viewport.png`). Once the page is scrolled, the Trade's rail has gone and its column is an empty band beside the readout (`d-bren-table-viewport.png`).
- Change: while Replay is open, give it the whole content area (fold the Trade's rail to one line: symbol, P&L, Stop and Target status), and let the page use a wide screen. The charts then match the Review card's.

**3. The chart has no key and no dates. High.**
- Trades: all. Width: all.
- Seen: the P&L chart draws a profit area, a loss area, a dark banked band, a hatched "past" area, a dashed Stop line, a dotted Target line, a Worst case line, a Max reward line, a thick bar for the stake from here, a sale marker and the cursor, with no key anywhere on the page (`d-bren-s10.png`). The approved words include a key (W44); it is not on screen. The time axis has no dates; the only one is at the right-hand end, "Fri Nov 20" on an option and "Mon Nov 16" on the stock, with nothing saying the first is the expiration (`d-bren-s10.png`, `d-axio-s10.png`). On DALE at desktop width a grey dotted line runs across the top with no label; on the phone the same line is labelled "Max reward +$564" (`d-daleloss-s05.png`, `p-daleloss-s05.png`).
- Change: a one-line key under the chart; the first session's date at the left, "Expires Fri Nov 20" at the right on an option; every drawn line labelled or not drawn.

**4. The from-here ratio flatters a losing Trade. High.**
- Trades: BREN, AXIO, DALE (any Trade that is behind). Width: all.
- Seen: DALE on Wed Nov 11, 90% of the way to the Stop: "$156.00 at risk to the Stop · $1,824.00 more to the Target · 11.69 to 1 (the Plan was 0.29 to 1)" (`d-daleloss-s07.png`). AXIO on Fri Nov 6: "7.18 to 1 (the Plan was 2 to 1)" (`d-axio-s04.png`). BREN on Fri Nov 6: "6.62 to 1 (the Plan was 2.95 to 1)". The arithmetic is right, but a student reads "better than my Plan" on the day the Trade is closest to failing. That is how people talk themselves into holding, or adding to, a loser.
- Change: when the Trade is behind, drop the ratio and the comparison and say what matters: "Only $156.00 left before the Stop." Keep the ratio when the Trade is ahead, where it teaches the right thing ("0.52 to 1").
- This is a limit of the approved words (W38), not a build fault. It hurts the student and I would change the words.

**5. The Plan versus what happened is thin. High.**
- Trades: all; AXIO and CORV most.
- Seen: "The Plan" shows two dollar results and nothing else (`d-axio-s05.png`). The planned entry, quantity, Stop and Target prices are only in the table's last columns. The lesson of each Trade is never stated:
  - AXIO: "Sold 100 at $45.60" was $1.40 below the $47.00 Stop, and the other 100 shares are still held, past the Stop on all six sessions from Mon Nov 9 to Mon Nov 16. The replay shows the sale and the Stop line but never puts them together.
  - CORV: the Target was reached on Fri Nov 6 and not taken. On Mon Nov 9 the replay reads "Ahead: 74% of the way to the Target", as if it had never been there (`d-corv-s05.png`).
  - BREN: half was sold at $4.00, exactly the Target. That deserves saying.
- Change: put the Plan's prices in "The Plan" (4 at $1.61, Stop $0.80, Target $4.00). Add to each Execution how it stood against the Plan ("at the Target"; "$1.40 below the Stop"). Keep a condition's first crossing on the chart and in the table's Events ("Target first reached Fri Nov 6"; "Past the Stop since Mon Nov 9"). The figures would have to come from the domain, since the screen calculates nothing.

**6. The rows for a Trade past its Stop or Target are confusing. Medium.**
- Trades: AXIO, DALE (Stop); BREN, CORV (Target). Width: all.
- Seen: under "Current Risk": "Stop Overrun $552.00 · 0.36R · P&L −$1,536.00" while the headline says −$2,088.00 (`d-daleloss-s10.png`). Under "Remaining Reward": "Target Overrun $32.00 · 0.10R · P&L +$956.00" while the Trade is at +$988.00 (`d-bren-s10.png`). An overrun is neither a risk nor a reward, and the "P&L" beside it is a level the Trade has already passed. The "Reward to risk" row holds a status instead of a ratio: "Stop breached", "Target reached", and on DALE Thu Nov 12 "Not triggered" (`d-daleloss-s08.png`). The table shows "Current Risk at Stop $0.00" for a Trade $300.00 past its Stop, which reads as no risk.
- Change: one plain row, "Past the Stop by $552.00 (0.36R); the Plan's loss was −$1,536.00", outside the two headings. Drop the "Reward to risk" row when there is no ratio. In the table show "past by $300.00", not "$0.00".

**7. The same change is shown three times, and it is unclear which figure it belongs to. Medium.**
- Trades: all. Width: all.
- Seen: BREN, Wed Nov 11: "up $336.00 since Tue Nov 10" under Trade P&L, the same under At Stop, and "down $336.00 since Tue Nov 10" under At Target (`d-bren-s07.png`). They are one fact: the P&L moved. Under "At Stop $844.00 · 2.60R · P&L −$324.00" the line could belong to any of the three figures. "Risk down $150.00" on BREN's last session sounds like good news; it means $150.00 of profit was given back.
- Change: keep the "since" line on Trade P&L and on the Marks only.

**8. The same thing has different names in different places. Medium.**
- Seen, with the Trades:
  - AXIO: the chart says "Realized −$440"; the readout and table say "Banked −$440.00". Nobody banks a loss (`d-axio-s05.png`).
  - BREN, CORV, DALE: the Underlying's Mark is "$104.00" on the chart and "104.00" in the readout and table; the option's Mark has its dollar sign everywhere (`d-bren-s10.png`).
  - DALE: the table's "Stop" is 54.00 (the stock) and its "Target" is $0.20 (the option), with nothing saying they are prices of different things.
  - Review card, BREN: the summary above the replay calls the same figures "Ongoing Risk to Stop", "Worst-Case Ongoing Risk", "Incremental Reward to Target $0.00 · 0.00R" and "Reward : risk now 0", where the replay just below says "Current Risk, At Stop", "At Worst case", "Target Overrun $32.00" and "Target reached" (`r-1280-BREN-card.png`).
  - All: ratios read "0.1 to 1", "5.4 to 1", "4 to 1" and "11.69 to 1"; pick one number of decimals.
- Change: one name per figure across chart, readout, table and the Review card's summary; "Realized" for a loss; a dollar sign on every price; "Stop (DALE)" and "Target (put)" in the table.

**9. On a phone the P&L chart's labels pile onto the drawing. Medium.**
- Trades: BREN worst, AXIO. Width: phone, and the Review card on a phone (the chart is 280 pixels there).
- Seen: BREN's last session: "Target +$956" sits on the dotted line and the hatching, "Sold 2" touches "Banked +$478", "Worst case +$156" sits under "Stop +$316" across two dashed lines, and "Break-even" is struck through (`r-375-BREN-viewport.png`, `p-bren-s10.png`, `p-bren-s08.png`). No two labels overlap each other by measurement, but most sit on a line, a dot or a filled area.
- Change: on a phone take the figures off the drawing and put them in a short strip under it ("Stop +$316 · Banked +$478 · Target +$956"), keep only the cursor's value on the chart, and make the chart taller than 170 pixels.

**10. On the entry session the cursor runs through the labels. Medium.**
- Trades: all. Width: all.
- Seen: on Mon Nov 2 the blue cursor is at the left edge, where the level labels are: it strikes through "Strike $100" and "$97.20" (`d-bren-s00.png`), "Target $56.00" and "Stop $47.00" (`d-axio-s00.png`), "Strike $57.50" and "Stop $54.00" (`d-daleloss-s00.png`). In every session the first Mark's dot sits on the end of "Break-even". The entry is the session a student most needs to read.
- Change: put the level labels at the right-hand end of their lines, or left of the plot area, clear of the first session.

**11. The "Session by session" table is too wide to use. Medium.**
- Trades: all. Width: all.
- Seen: 15 or 16 columns, about 2,200 pixels wide, in a box of 553 (desktop) or 314 (phone); four columns show at desktop and three on a phone (`d-bren-table-viewport.png`, `p-bren-table.png`). Six columns never change in a Trade that is simply held (the four "P&L at" columns, Stop and Target). "Events", where the sale is, is last, four screens to the right, and the date does not stay in view while scrolling sideways. There is no R and no reward-to-risk column, which is the column a coach would read down.
- Change: show Session, the Marks, Trade P&L with its R, Current Risk at Stop, Remaining Reward at Target, Reward to risk and Events; put the rest behind "More columns"; keep the Session column in view.

**12. A session with no Mark shouts the gap and repeats it. Medium.**
- Trades: CORV (Tue Nov 10). Width: all.
- Seen: the headline, in the largest type on the page, is "Mark missing: CORV Nov 20 $80 Put, Tue Nov 10" on two lines, then "No Mark.", then the same sentence again as the Trade P&L across four italic lines, then "No Mark" five more times (`d-corv-s06.png`). In later sessions the gap is a white hole in the profit area whose edges look like the P&L fell to nothing and came back (`d-corv-s10.png`).
- Change: a normal-size line "No Mark for the put on Tue Nov 10" with a button to add it; a dash in the rows that need it; a dashed bridge across the hole.

**13. The chart hides how far down a Trade can go. Medium.**
- Trades: DALE most; AXIO, CORV, and BREN before its sale.
- Seen: the Worst case line is drawn on BREN only after the sale, when it happens to be on the scale. On DALE the scale ends just under the Stop at −$1,536, so the picture of a cash-secured put shows a floor that is not there; −$33,936.00 is only in the readout (`d-daleloss-s10.png`).
- Change: when the Worst case is off the scale, a tag at the bottom edge: "Worst case −$33,936 ↓".

**14. The session's date and the best sentence are the quietest things at the top. Low.**
- Trades: all. Width: all.
- Seen: the date is small grey text at the far end of the slider, and the "From here" sentence is grey under the black status line (`d-bren-s10.png`). Hovering a session puts a box between the chart and the readout and pushes the readout down about 115 pixels, so the page jumps as the pointer crosses the chart (`d-bren-hover.png`).
- Change: the date beside the headline figure; the "From here" sentence in normal ink; the hover box in a reserved space or floating over the chart.

**15. The extremes get the same weight as the Stop and Target. Low.**
- Trades: AXIO, CORV, DALE.
- Seen: "At Worst case $9,620.00 · 16.03R" for a stock going to zero (`d-axio-s04.png`) and "At Max reward $22,248.00 · 69.96R" for a put (`d-corv-s10.png`) are set exactly like the Stop and Target rows. DALE's Worst case is the exception: there it is the main risk and should stay prominent.
- Change: dim these rows for a stock and for a long option; keep them strong for a short option. Shorten the chart title "Trade P&L · dollars for the whole Position, between the result at the Stop and at the Target" at desktop width as the phone already does.

## 4. What I could not check

- **A finished Trade.** All four test Trades are still open, so the "Final result" state (sold out, or expired) was not seen.
- **A real touch screen.** The phone runs used a 375-wide window with a mouse. The grey session band and hover box in some `p-` screenshots (for example `p-bren-02-replay-top.png`) come from the mouse pointer and would not show on a phone. A tap on the chart did move the slider to the tapped session.
- **The Review card for the losing Trades.** The three-card Review profile holds BREN, CORV and a winning, two-lot version of AXIO. I did not see DALE's or the losing AXIO's card in the Review.
- **Sessions after Mon Nov 16**, expiration week included, and a Trade with more sessions than these eleven.
- **A screen reader, dark mode, and widths under 375.**
- **The prototype side by side.** I read the approved words and the two wording rules but did not open `prototypes/replay/round-2.html` in a browser to compare the drawing.
- **Stage B and stage C** (implied volatility, the share equivalent, the meter) are not built, so they are not judged.
