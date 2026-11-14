# D08P checkpoint critic 2 (T8P.23): C8P.1 to C8P.4, plus the narrow layout

## 1. Header

- **Run:** Fri 2026-11-13, about 23:00 to 23:45 EST.
- **Commit:** `b11aa7ab` on `claude-opus-5.5`, in this worktree only.
- **Tools:** Node v26.12.0, Playwright 1.63.0, Chromium 156.0.8078.4 (revision 1248), headless, America/New_York.
- **Server:** `npm run build`, then `vite preview --port 5175 --strictPort`. Each run started and stopped it inside `.claude/scripts/with-browser-lock.sh`. Ports 5175, 9341 and 9342 were free before the session and are free now. No server of mine is still running.
- **Clock:** the support helpers' Playwright clock (`launchAt` and `setClock`).
- **Files:** no tracked file was edited and nothing was committed (`git status` is clean). I did not read `evidence/`, other worktrees or other branches.
- **Scratch files:** scripts, profiles, dumps and screenshots are in `/Users/ckolbegger/src/trade-journal-v3/worktrees/claude-opus-5.5/test-results/critic-d08p-2/`, with screenshots in `shots/`.
- **Fixtures:** all built through the UI with the helpers:
  - **O-C3-like Trade:** O-C2's Plan (all four conditions). Buy 2 @ 2.00, Mon 10-12 10:00, fee 1.30. Sell 1 @ 3.00, Wed 10-14 11:00, fee 0.65, with Reflect later. Marks Mon 56.00/2.10, Wed 57.40/2.90 and Thu 57.90/3.20, with Tue left as a gap. A Hold for Thu. Viewed at Thu 10-15 18:00.
  - **Planned:** O-C2 confirmed at Mon 09:00.
  - **Settlement Due and Closed by expiration:** D7's Settlement fixture, viewed Fri 11-20 17:00 and Mon 11-23 17:00. I recorded T-3's expiration from the "Record expiration" link in its Needs you card.
  - **Closed by sale:** a stock Trade, 100 @ 50.00 on Mon. Mon Mark 51.00. Sold 100 @ 52.00 Tue 10:00 with the Close Review deferred.
  - **Stock with several lots:** T-A, 60 @ 50.10 and 40 @ 50.30. Marks Mon 51.00 and Tue 51.50, with Wed missing, then Wed 52.30.
  - **Incoherent:** ABC with `writeIntegrityFixture` `UnknownPlannedLeg`.
- **Helpers:** every helper used ran without failing.

## 2. Results

| Flow | Result | Key observations |
|---|---|---|
| **C8P.1 State of play** | PASS (with defect 4) | The rail answers all four questions with no drawer open, in the section "State of play". **What I hold:** "XYZ", "Long Call, Open", "Strike 55", "Expires Fri 18 Dec 2026 (64 days)" (Thu Oct 15 to Dec 18 is 64 days), "Fidelity — Roth IRA", Record entry, Record exit. **How it is doing:** "$218.05", "+$30.00 since Wed Oct 14", "1 of 2 contracts open". **What's near:** "Stop −$320.00 XYZ at or below 48.00 … (−1.60R)"; "Stop nearest −$220.00 Option at or below $1.00 … if the option's Mark is $1.00 (−1.10R)"; "Target +$180.00 … (+0.90R)"; "Target nearest +$80.00 … (+0.40R)"; "Worst case: $320.00 · 1.60R if the call expires worthless"; "Max reward: Unbounded above". I checked every figure by hand and all are right. **What needs me:** "Position Change Reflection / Reflection owed / Due / Reflect now". Reflect now selects Journal and opens the form, but out of view (defect 4). |
| **C8P.2 Drawers** | **FAIL** (defect 1) | The tabs read "Today, Position, Plan and Risk, Price History 1, Journal 1 owed, Payoff", which is W1's order with W1's counts. Each tab opens by mouse. By keyboard, ArrowRight cycles through all six and wraps to Today; Home goes to Today, End to Payoff, ArrowLeft goes back one. Focus stays on the selected tab, and Tab then moves into its panel. **The duplicates:** several figures show twice beyond the four accepted exceptions (defect 1). |
| **C8P.3 History** | PASS (with defects 3 and 5) | **Price History:** columns "Thu Oct 15, Wed Oct 14, Tue Oct 13, Mon Oct 12", newest on the left. The Tue gap shows "—" in all three rows, each with the accessible name "No Mark". Below: "1 session without Marks. Enter Marks in the Review", and the link goes to /review. Tab "Price History 1". Figures: 57.90/$3.20/$218.05, 57.40/$2.90/$188.05, then Mon 56.00/$2.10/$18.70. **Journal:** "Fri Oct 16 / Session not ended yet / Its Marks are due once this session ends." Then "Today, Thu Oct 15" ($218.05, +$30.00 since Wed Oct 14, Marks, the Hold). Then "Yesterday, Wed Oct 14" ($188.05, +$169.35 since Mon Oct 12, the owed reflection with Reflect now and Decline). That is page 1. › moves to page 2: "Tue Oct 13 without Marks"; "Mon Oct 12 $18.70 First Mark" with the entry reflection; then the Plan card "Planned Mon Oct 12, 9:00 am". ‹ is disabled on the first page and › on the last. Each page holds 3 cards at both 1280 and 375 px. **Gaps that aren't gaps:** after a Trade closed or a contract expired, the history shows false gaps (defects 3 and 5). |
| **C8P.4 States** | PASS (with defects 2, 3, 5 and 6) | **Planned:** right after Confirm, before any reload, the identity card reads "Long Call, Planned / Strike 55 / Expires Fri 18 Dec 2026 (67 days)". The drawers are Plan and Risk (selected), Journal (the Plan card) and Payoff ("Now: Not applicable: no open position"). The P&L card reads "— / Trade P&L once the entry is recorded and marked / 0 of 2 contracts open", and the Conditions card "Distances to each condition arrive with the first Marks after entry." **Settlement Due (Mon Nov 23):** "Settlement Due: XYZ 20 Nov 2026 55 Call / Trade P&L once the expiration is recorded". There is no Expires line, the Settlement Due panel and Record expiration are in Needs you, and the card reads "The contract expired, so its conditions are no longer measured." The drawers are Position, Plan and Risk, Price History, Journal and Payoff, and Position's Open P&L reads "Settlement Due". **On the expiration day itself (Fri Nov 20 17:00),** the P&L card is wrong (defect 2). **Closed by expiration:** "Cash-Secured Put, Closed / Strike 45 / Expired Fri 20 Nov 2026", then "$248.70 / +0.69R realized, final", Terminal Disposition and Option Disposition Timing. The conditions show rows 1 and 2 only, and Needs you shows the Close Review owed. **Closed by sale:** "Long Stock, Closed", "$198.00 / +0.79R realized, final", Terminal Disposition and Close Reason. Payoff reads "Expiration Payoff: Not applicable: no option expiration". **Incoherent:** the "Facts can't be replayed" banner spans both columns above the rail. The P&L card reads "Not available / Trade P&L", and there are no Record links and no footer. The drawers are Position, Plan and Risk and Journal, where Journal reads "Every entry, newest first / Without a replay there are no sessions, so the entries are one list." **Stock with several lots:** two Open Lots rows (60 @ $50.10, 40 @ $50.30), "100 of 100 shares open". After the Wed Mark: "Stop nearest −$480.00 XYZ at or below $47.50 / Change in Trade P&L from the Wed Oct 14 Mark if XYZ's Mark is $47.50 (−1.92R)." and "Worst case: $5,230.00 · 20.92R if XYZ goes to zero". With the Wed Mark missing, Needs you shows the "Mark missing for XYZ on Wed Oct 14" link to /review, and the condition rows read "Mark missing" (W5). |
| **Narrow layout (375 and 320 px)** | PASS (with defect 4) | O-C3 was checked with every drawer open in turn at both widths. The rail becomes the top of the page, with the tabs below it (rail bottom = tab list top). `scrollWidth` equals `clientWidth` (375 and 320) in every drawer, and no element extends past the viewport outside a scroll container. Each condition's row 2 is one line, 23 px tall. The Marks comparison table and the payoff chart scroll inside their own containers. |

## 3. Overall: **FAIL**

C8P.2 fails its pass condition (defect 1). C8P.1, C8P.3, C8P.4 and the narrow layout pass, with the defects below.

### Defects

**1. Figures shown twice beyond the four accepted exceptions (C8P.2). Severity: high (C8P.2's pass condition fails).**
- **Steps:** On O-C3 at Thu 10-15 18:00, open each drawer by mouse. On the stock Trades, open Today and Plan and Risk.
- **Expected:** "Each figure appears once, apart from the accepted exceptions" (breakdown section 8, C8P.2; section 1.5 dissolves the Summary card for "one figure in one place"; T8P.31).
- **Actual:**
  - **(a) Position drawer, Opening fees:** "Opening fees $1.30" in the figure list, and "Opening fees incurred $1.30" in the Fee reconciliation.
  - **(b) Position drawer, Incurred fees:** "Incurred fees $1.95" is shown both under Open P&L and inside the Fee reconciliation. The prototype's Several-lots state repeats this one too, as "Fees paid" and "Incurred fees".
  - **(c) Plan and Risk, reward to risk:** Plan Baseline shows "Reward : risk 2", and Entry Quality shows "Reward : risk 1.98 / planned 2". Every state has the same pattern, for example "1.5 / planned 1.5" and "2.4 / planned 2.4".
  - **(d) Today drawer, stock Trade before any Mark (T-2, Fri Nov 20):** the At entry block shows "Average entry $50.00" and "Quantity 100 shares". Plan and Risk also shows "Average entry $50.00", and Position shows "100 shares of XYZ".
  - **(e) Today drawer, stock with Wed's Mark missing:** Tue's Mark "$51.50" appears three times in one drawer: "Stale context: $51.50 from Tue Oct 13 close …", the comparison table's "Tue Oct 13" cell, and "At the Tue Oct 13 Marks / Mark $51.50". The same dated block repeats "Incurred fees $2.00" and "Realized to date $0.00", which the Position drawer also shows.

**2. On a contract's expiration day, the Settlement Due P&L card names a missing Mark, not the contract. Severity: moderate.**
- **Steps:** Settlement fixture, clock Fri 2026-11-20 17:00. Open T-1 (XYZ 20 Nov 2026 55 Call) or T-3 (MNO Put).
- **Expected:** The Settlement Due P&L card reads "Settlement Due: XYZ 20 Nov 2026 55 Call", then "Trade P&L once the expiration is recorded" (W4; A224, "The P&L card names the contract").
- **Actual:**
  - The P&L card reads "Mark missing: XYZ 20 Nov 2026 55 Call, Fri Nov 20 / Trade P&L once the expiration is recorded". The figure and its line contradict each other.
  - Needs you shows the Settlement Due panel, and Position's Open P&L reads "Settlement Due".
  - Plan and Risk shows "Risk to stop: Mark missing: …" while the rail says "its conditions are no longer measured".
  - The same Trade at Mon Nov 23 shows the words W4 expects, so only the expiration day is wrong.

**3. Price History and Journal treat sessions after expiration as missing Marks. Severity: moderate.**
- **Steps:**
  1. Settlement fixture at Fri Nov 20 17:00, then Mon Nov 23 17:00. Open T-1 or T-3, then open Price History and Journal.
  2. For comparison, open the Review at Mon Nov 23.
- **Expected:**
  - Gaps are real gaps (C8P.3).
  - The prototype's Settlement Due state ends history "Fri Dec 18, the last session the contract traded". No Marks fall due for an expired contract.
- **Actual:**
  - At Mon Nov 23, Price History adds a "Mon Nov 23" column of "—" and counts "31 sessions without Marks. Enter Marks in the Review". The Journal reads "Mon Oct 12 to Mon Nov 23 without Marks", then "Tue Nov 24 / Session not ended yet / Its Marks are due once this session ends."
  - At Fri Nov 20 it already shows "Mon Nov 23 / Session not ended yet / Its Marks are due …".
  - The Review on Mon Nov 23 says "No Marks for Mon Nov 23" for the expired call, so no such Mark exists to enter. The history tells the trader that Marks are due that will never be needed.

**4. Reflect now in Needs you opens the form out of view and leaves focus on the rail. Severity: moderate (accessibility, and hidden state).**
- **Steps:** O-C3 at Thu 18:00. Press "Reflect now" in Needs you, at 1280 and at 375 px.
- **Expected:** Reflect now "selects the Journal drawer and opens that Debt's form on its card" (A217). The trader should be able to see and reach what opened.
- **Actual:**
  - The Journal tab is selected and the form opens.
  - Focus stays on the rail's "Reflect now" button.
  - Nothing scrolls. At 1280 px the form starts at y=1020 against a 900 px viewport. At 375 px it starts at y=2092 while the page sits at scrollY=779, so it is out of view at both widths.
  - A keyboard or screen-reader user, or a phone user, gets no sign that a form opened.

**5. A Closed Trade's final session reads as a session "without Marks" and loses its final-session card. Severity: moderate.**
- **Steps:** Closed-by-sale stock Trade (sold Tue 10-13 10:00), clock Wed 17:00. Open Price History, then Journal.
- **Expected:**
  - The final session's card reads "Tue Oct 13, final session" with its Trade P&L (W10).
  - Gaps are gaps (C8P.3).
- **Actual:**
  - Price History's Tue column shows XYZ Mark "—" but Trade P&L "$198.00", and counts "1 session without Marks. Enter Marks in the Review" (tab "Price History 1").
  - The Journal's last card reads "Tue Oct 13 without Marks", with no "final session" heading and no $198.00.
  - The Review on Wed asks for no XYZ Mark: the position was flat at Tue's close, so no Mark was ever due.

**6. A stock Mark loses its "$" in Price History only. Severity: low.**
- **Steps:** Open a stock Trade's Price History (T-A or the closed-by-sale Trade), then its Today and Journal drawers.
- **Expected:**
  - One wording per concept (C1).
  - A stock price has a "$": W5's "XYZ at or below $47.50" and W10's "XYZ Mark $52.30". The prototype's stock grid shows "$52.30".
- **Actual:**
  - Price History reads "XYZ MARK — 51.50 51.00".
  - The same Marks read "$51.50" in Today's comparison and "XYZ Mark $51.50" on the Journal cards.

**7. One more moved text still calls a Mark a "close". Severity: low.**
- **Steps:** Stock Trade with Wed's Mark missing, Today drawer.
- **Expected:** P102: a session's closing price is a "Mark", on Detail.
- **Actual:**
  - The drawer reads "Stale context: $51.50 from Tue Oct 13 close (stale, not used in any current figure)".
  - P102 changed only the two texts it listed, so this one was missed.

## 4. Minor observations

1. **Payoff legend clipped.** At 1280 px the SVG is 640 px wide inside a 592 px scroller, so the legend's "Now" (x 1218–1245) sits past the scroller's right edge (1214). Without scrolling, the legend reads "- - - Planned ——" with no label for the solid line. The same happens at 1024 and 900 px. W14 asks for the legend "Planned" and "Now". The tables do name both lines.
2. **"Due" twice on Journal cards.** An owed reflection on a Journal card reads "Due  Due": the term and its value, from `OwedDebtItem`'s existing `<dt>Due</dt>`. These are existing words, but they read as a stutter.
3. **Needs you doesn't say which reflection is owed.** It reads "Position Change Reflection / Reflection owed / Due", without the Position Change's date. With two owed reflections the rail alone couldn't tell them apart; the Journal card shows "Position Change at 2026-10-14 11:00".
4. **The entry reflection shows twice.** Its answers appear in the Position drawer's Execution "details" disclosure and on Mon's Journal card. This is content rather than a figure, so it falls outside C8P.2's rule.
5. **Settlement Due Payoff drawer.** It draws the Current line with its full table ("Current Expiration Payoff … Breakeven 43.76") and, for T-3, "Value at expiration at MNO's latest Mark / Mark missing: MNO, Fri Nov 20". The prototype's Settlement Due state shows "Current: Settlement Due: <contract>" instead. No W row covers this state, so I have not raised it as a defect.
6. **Duplicate dates and descriptions.** Today opens with "Expected Mark Date Thu Oct 15" directly above the heading "Marks: Thu Oct 15 against Wed Oct 14". On Position, the Trade Summary "Long 1 Dec 18 $55 Call" sits directly above "Position: Long 1 contract of XYZ 18 Dec 2026 55 Call". Both are the same fact in two wordings.
7. **Rail landmark role.** The rail is a `<section aria-label="State of play">`, so its role is region, not complementary. It is still a named landmark (W1).
8. **Past gaps can't be filled yet.** The "Enter Marks in the Review" link leads to a Review that can enter only the current Review Date's Marks. Entering past gaps is the future Review Price History grid, so this is not a defect.
