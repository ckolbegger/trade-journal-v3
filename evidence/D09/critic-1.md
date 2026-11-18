# D09 critic-1 report

## 1. Header
- **Date and time:** Wed 2026-11-18, about 10:45 to 11:15 EST.
- **Commit:** the build was made from `8105d35c`. While I worked, the main session committed `85b620da`, which changes only `evidence/D09/structural.md`, so the app code is the same.
- **Versions:** Node v26.12.0; Playwright's Chromium 153.0.8010.12 (headless, `channel: 'chromium'`).
- **Server:** one only, `npm run build && npm run preview -- --port 5175 --strictPort`, run through `.claude/scripts/with-browser-lock.sh`. I stopped it before finishing; port 5175 now has no listener.
- **Files:** no tracked file was edited and nothing was committed (`git status` is clean). Scratch scripts, profiles and screenshots are in `/Users/ckolbegger/src/trade-journal-v3/worktrees/claude-opus-5.5/test-results/critic-d09a-1/`.
- **Setup:** I built six profiles at the close of Mon 11-16 with `build()` and copies of its steps:
  - BREN (R-BREN-U: a partial sale)
  - DALE short put holding R-DALE-D's Marks (a loser)
  - AXIO (R-AXIO-D: a sale below the Stop)
  - CORV (R-CORV-D: no put Mark on Tue 11-10)
  - AXIO-U (R-AXIO-U: a second lot of 100 at $51.40 on Fri 11-06, recorded with Record entry)
  - "review3": BREN, CORV and AXIO-U in one Review
- **Helpers:** none failed. `REPLAY_SESSION_DATES` is imported by `e2e/d9/support.ts` but not re-exported, so I imported it from `reference-trade.ts`.

## 2. Results

| Flow | Result | Key observations |
|---|---|---|
| C9.1 The ten-second read | PASS | At 1280×900 the drawer opens on "Mon Nov 16 · 11 of 11" without touching anything, with both charts on screen.<br>• **BREN:** "+$988.00 · 3.05R" in green, green edge / "Target reached, $32.00 past it." / "From here: $672.00 at risk back to the Stop ($510.00 of it open profit) · no cap above. Even at the Stop this Trade would end $316.00 ahead."<br>• **DALE loser:** "−$2,088.00 · −1.36R" in red / "Past the Stop by $552.00 (0.36R)." / "From here: Worst case $31,848.00 more · $2,532.00 back up to the Target."<br>• **AXIO stock:** "−$1,040.00 · −1.73R" in red / "Past the Stop by $300.00 (0.50R)." / "From here: Worst case $4,400.00 more · $1,200.00 back up to the Target."<br>• **CORV:** "+$1,119.00 · 3.52R" green with Reward to target $0.<br>• **AXIO-U:** "+$900.00 · 1.50R" / "Ahead: 85% of the way to the Target." / "…· 0.1 to 1 (the Plan was 2 to 1)."<br>• Tabs read: Today, Replay, Position, Plan and Risk, Price History, Journal, Payoff. |
| C9.2 Watching it unfold | PASS, with moderate defects 3, 4 and 5 | I stepped from the first session to the last with the Previous and Next buttons on all five Trades.<br>• Table rows always equal the revealed count; no later session label or figure is in the drawer's HTML. The one exception is a stock chart's end-of-axis date "Mon Nov 16" (see minor observations).<br>• **BREN:** the Stop line steps from "Stop −$324" to "Stop +$316" at Thu Nov 12; the Target line stays at +$956; a solid "Banked +$478" band starts Thu Nov 12; "Sold 2 at $4.00" marker shows.<br>• **AXIO-U:** both lines step at Fri Nov 6 (Stop −$300 → −$740, Target +$600 → +$1,060), with the "Bought 100 at $51.40" marker. The table matches plan section 5 (Fri Nov 6: $960.00 / $840.00 / −$740.00 / +$1,060.00).<br>• **AXIO-D:** on Mon Nov 9 "Past the Stop by $180.00 (0.30R).", "Realized −$440", lines −$740 and +$160.<br>• **CORV:** Tue Nov 10 headline is "Mark missing: CORV Nov 20 $80 Put, Tue Nov 10", the put Mark reads "No Mark", and the P&L area is broken (a gap). Wed Nov 11 changes are measured "since Mon Nov 9".<br>• Every figure in the plan section 5 rows I checked matches. |
| C9.3 In the Review | PASS | Review Date Mon Nov 16; three cards: BREN, CORV, AXIO.<br>• Each card's "Replay" section sits above the Action form, rests on "Mon Nov 16 · 11 of 11", and links only "Price History".<br>• Moving back two sessions gave "Thu Nov 12 · 9 of 11" and did not change the address.<br>• From CORV's card, Price History opened `/trades/<id>?drawer=price-history&session=2026-11-12&from=review` with "Back to the Review" shown. Back returned to `/review?trade=<id>&panel=Action&session=2026-11-12`: card open, Action panel open, slider on "Thu Nov 12 · 9 of 11", headline "+$1,086.00 · 3.42R". A reload kept all of this.<br>• Hold + one press of Save saved each Action; the status went to "Complete" and the stored Action entries number 3. |
| C9.4 Narrow, keyboard and offline | **FAIL** | **No sideways scroll** at 375 and 320 on either surface (`scrollWidth` equals the viewport width).<br>**Keyboard:** Tab, then ArrowRight in the tab list, reaches Replay. Then: Previous session, the slider "Session" (Arrow, Home, End and PageUp keys work; `aria-valuetext` "Mon Nov 16 · 11 of 11. +$988.00 · 3.05R"), one button per session named "Mon Nov 2"… (focus shows the session's Marks and P&L; Enter moves the slider), Price History, "Session by session". Each shows a focus ring. axe (WCAG 2.1 A/AA) finds no violations on the Detail or the Review at 1280, 375 or 320.<br>**Offline:** with the server stopped, plain reloads and offline reloads both work. The Detail replay reads "+$988.00 · 3.05R", the slider moves to "+$982.00 · 3.03R" with the band, the Review card replay reads, and the Price History round trip works.<br>**One screen fails at 320 px (defect 1)**, and labels overlap or are clipped on the phone (defects 2 and 6). |

## 3. Overall: **FAIL**

### Defects

**1. At 320 px the Review card's replay does not fit one screen. (High: C9.4's pass condition.)**
- **Steps:**
  1. Open the BREN profile at 320×667.
  2. Open the Review and BREN's card; the Action panel is open.
  3. Scroll the Replay section's headline to the top of the screen.
- **Expected:** "One screen" (C9.4; B9.5 in plan section 7.2 says the headline and both charts fit one screen at 320×667).
- **Actual:**
  - From the headline's top to the P&L chart's bottom is 676 px, against a 667 px screen.
  - The fixed bottom navigation also covers about 70 px, so the screenshot `c94-bren-review-320x667.png` shows only the headline, the stake sentence and the price chart. The P&L chart is entirely below the fold.
  - Why it is tall: the headline wraps to "+$988.00 · / 3.05R", and the Next session button wraps onto its own row.
  - On a 320×568 phone neither surface fits: Detail 595 px (BREN), DALE Review 629 px, BREN Review 676 px.

**2. Chart labels overlap and become unreadable, mostly on a phone. (Moderate.)**
- **Expected:** T9.13 says "leave out a label that has no free spot, and never the result or the stake tags"; A256 says the same.
- **Actual, measured as overlapping text boxes:**
  - **AXIO at 375 and 320, Detail and Review:** "Realized −$440", "Reward $1,200" and "Stop −$740" are drawn on top of each other and can't be read (`zoom2-axio-375.png`).
  - **BREN at 375 and 320:** "Banked +$478" overlaps "Risk $672"; "Target +$956", "Sold 2" and the cursor dot collide; "Worst case +$156" is struck through by the Stop line.
  - **At 1280 as well:**
    - BREN Thu Nov 12: "Banked +$478" overlaps "Risk to stop $666".
    - AXIO Mon Nov 9, Thu Nov 12 and Mon Nov 16: "Realized −$440" or "Stop −$740" overlaps "Reward to target …".
    - DALE, every session: "Max reward +$564" overlaps the P&L chart's title.
    - DALE Mon Nov 2 and Tue Nov 3: the price label overlaps the price chart's title.

**3. The "Worst case" and "Max reward" lines are drawn flat across the whole time axis at the slider session's value. (Moderate.)**
- **Steps:** BREN Detail, slider on Thu Nov 12.
- **Expected:** each session's lines come from that session's own figures and step where the Position changes (A250, A256; the prototype draws the worst case as a per-session rail).
- **Actual:**
  - The element is `path.worst-case M50 122.5H632`: a horizontal line at +$156 from the left edge to Fri Nov 20.
  - It claims a +$156 worst case on Mon Nov 2 to Wed Nov 11, before the sale, when losing all the premium meant −$644.
  - It also runs through the sessions not yet revealed.
  - DALE's `path.max-reward M50 25.6H632` is drawn the same way.

**4. The chart's "Worst case" and "Max reward" figures are not in the readout or the table, and the readout uses the same names for different figures. (Moderate.)**
- **Expected:** C9.2 says every figure in the charts is in the readout and the table; P137 says no figure leaves the page.
- **Actual:**
  - BREN's chart labels "Worst case +$156" while the readout's "Worst case" row reads "$832.00 · 2.57R".
  - DALE's chart labels "Max reward +$564" while the readout reads "Max reward $2,652.00 · 1.73R".
  - The table has neither column.
  - So a trader sees two different numbers under one name, and the charted result can't be found anywhere else on the page.
- **Why not high:** this follows the prototype and the W43 and W45 row lists, so it is a design gap; it does still fail the pass condition's wording.

**5. On a session with no Mark, the result at the Stop and at the Target are hidden although they don't need a Mark. (Moderate.)**
- **Steps:** CORV Detail, slider on Tue Nov 10.
- **Expected:**
  - Plan section 5's R-CORV-D row for Tue 11-10 shows the result at the Stop −$318 and at the Target +$867.
  - A248: "None of the four reads a Mark, so they hold on a session whose Mark is missing."
- **Actual:**
  - The table's "Result at the Stop" and "Result at the Target" cells read "No Mark".
  - The readout drops the whole "At stake from here" group, so those two rows go too.
  - Yet the chart still draws and labels "Stop −$318" and "Target +$867" for that session.
  - The figures show only through the Plan column, whose values happen to be the same here.
- **Note:** `e2e/d9/gaps.spec.ts` asserts "No Mark" in those two cells, so the suite has this behavior built in.

**6. Phone layout: a negative axis tick and a price label are clipped. (Moderate.)**
- **Steps:** AXIO Detail at 375 px (and at 320).
- **Actual:**
  - The P&L chart's lower tick "−$1,000" starts 8 px left of the chart and its minus sign is hidden, so the axis shows "$1,000" at both the top and the bottom (`zoom2-axio-375.png`).
  - The same happens to DALE's "−$2,000" and "−$1,000" ticks.
  - The price chart's "$44.00" runs past the right edge and is cut ("$44.0").
- **Expected:** the UI contract says a figure must be readable; A256 says a label with no free spot is left out.

**7. Keyboard focus lands under the fixed bottom navigation on the Review card at 375 px. (Moderate, accessibility.)**
- **Steps:**
  1. At 375×667, open the Review and BREN's card.
  2. Focus the Action panel header, then press Tab.
- **Actual:** "Previous session" (y 590–634) and the slider (y 591–635) receive focus while covered by the navigation links "Review" and "New Plan". The control and its value can't be seen.
- **More evidence:** a mouse click aimed at the slider after `scrollIntoViewIfNeeded` landed on "New Plan" and left the page.
- **Expected:** every control reachable and visible (C9.4; AC-UI-002).

**8. The Review card's chart text is 9.0 to 9.4 px at 320 px. (Low.)**
- **Actual:** the smallest chart text on the Review card measures 9.0 px (price chart) and 9.4 px (P&L chart). The Detail measures 10.0 px.
- **Expected:** the suite's own phone check (`responsive-a11y.spec.ts`) requires at least 10 px.

## 4. Minor observations
- **Ratio format:** decimals vary: "0.1 to 1", "2 to 1", "4 to 1", "5.4 to 1", "0.5 to 1", against W38's "2.64 to 1 (the Plan was 2.95 to 1)".
- **Stock axis date:** a stock Trade's axis ends at the last session, so "Mon Nov 16" is labelled from the first session on. It is A256's design, but it names a later session early.
- **No key, no gap label:** I saw no key (W44) on either surface. A session without a Mark is an unlabelled empty gap in the P&L area, with no "No Mark" shading or label there.
- **Focus after the Review link:** Price History opened from the Review leaves focus on `<body>`. The Detail's own Price History button puts focus on the session's column ("Wed Nov 4" `th`), as T9.16 says.
- **Stale address:** after returning to the Review and saving CORV's Action, the address still reads `?trade=<CORV>&panel=Action&session=2026-11-12` while AXIO's card is open. A reload there would reopen CORV's card.
- **Wording:**
  - DALE on Thu Nov 12 (Stop not crossed but past its planned amount) reads "Reward to risk — Not triggered", which is confusing.
  - That session's readout row is named "Past Stop's amount" (a shortened, unapproved name), not W43's "Stop Overrun".
- **"$" signs:** the Underlying Mark has "$" on stock ("$49.70") but not on options ("97.20"). The table's Stop column reads "54.00" while the chart reads "Stop $54.00".
- **Half a session past the cursor:** the banked band, the overrun hatch and the result lines run half a session width past the slider's session (to x 413.8 when the cursor is at 395.6). This is drawing only; no figure moves.
- **Worst case note:** the readout's "Worst case" row has no explanation like the prototype's "if the call expires worthless".
- **Mouse use:** clicking the slider track and dragging the thumb both work at 1280. Tapping a session button moves the slider and shows that session's Marks, Sale and P&L. The Position and Journal audit buttons focus the Execution row ("Sell to close 2 BREN Nov 20 $100 Call @ $4.00 …") and the "Mon Nov 2" Journal card. A plain Detail shows no "Back to the Review".
- **Console:** no page errors or console errors in any run.
