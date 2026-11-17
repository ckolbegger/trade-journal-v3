# D08R critic-3 report

## 1. Header
- **When:** Tue 2026-11-17, about 15:30 to 16:45 EST.
- **Commit:** `2fc04bdd` on `claude-opus-5.5`. Built once with `npm run build` at the start, and that build was judged.
- **Versions:** Node v26.12.0, Playwright 1.63.0, Chromium 153.0.8010.12 (headless, America/New_York, clock pinned the way the suite pins it).
- **Server:** one `vite preview --port 5175 --strictPort`, run inside `.claude/scripts/with-browser-lock.sh` with the lock held for the whole session. I stopped it by its own PID afterwards; the port now returns nothing and none of my browser processes remain.
- **Files:** no tracked file was edited and nothing was committed (`git status` is clean). Scratch scripts, profiles and screenshots are in `/Users/ckolbegger/src/trade-journal-v3/worktrees/claude-opus-5.5/test-results/critic-d08r-3/`.

**How the starting states were built**
- **Suite helpers:** `buildOc3` (with the Thursday Hold), `buildOc3Plus`, `buildOc3BeforeMarks`, `buildOs2x` (twice), `addK1` and `openBreachedStockTrade` all worked.
- **Nearby states, entered through the Review UI on copies of those profiles:**
  - Fri Oct 16 with XYZ 58.30 and the call's Mark missing;
  - the same day with the call acknowledged unavailable;
  - Fri Oct 16 with the call at 3.50 and the XYZ Mark missing;
  - MNO Fri Nov 20 at 46.10 and the put at 0.05, with and without the put's Mark;
  - O-S2X's expiration recorded on Sat Nov 21.
- **Helper failures (observations):**
  - Entering MNO's Mark for Mon Nov 23 against O-S2X timed out. The Review offers no Underlying Mark row for a Settlement Due Trade (revision 98).
  - Entering NVDA's Fri Nov 13 Mark against K1 failed: that Review says "No Trades were open at this session's close".
  - So both Underlying Marks came in through an extra stock Trade on MNO, and one on NVDA, held across those sessions.

## 2. Results

| Flow | Result | Key observations |
|---|---|---|
| **C8R.1** One place for each figure | **PASS** | **O-C3 at Thu 18:00:**<br>• Rail: "$218.05", "+$30.00 since Wed Oct 14", "1 of 2 contracts open", "Stop · $2.20 away", "Target · 2.10 away".<br>• Today: "Today, Thu Oct 15" 57.90 / $3.20; "Yesterday, Wed Oct 14" 57.40 / $2.90; "Change" +0.50 / +$0.30.<br>• Position: Net cost $200.65, Open P&L +$119.35, Realized to date +$98.70, Incurred fees $1.95, and an Instrument column on Open Lots and Lot Matches.<br>• Plan and Risk: "Risk to stop $220.00 · 1.10R", "Reward to target $180.00 · 0.90R", "$5.00", "Worst case: $320.00 · 1.60R if the call expires worthless".<br>**O-C3+ at Fri 12:00:** "Since the last Marks" reads New lots 1 contract, $3.30, "$230.00 · 1.15R", "$170.00 · 0.85R". Deviations is the last group.<br>**Checked across the whole page, hidden drawers included:** no "Expected Mark Date", no footer, no "Deviation active", no "nearest", no "Opening fees" row (only the Fee reconciliation's "Opening fees incurred"), no "At entry", no "Change in Trade P&L". Every other repeat is on the accepted list, apart from minor observation 1. |
| **C8R.2** Today on every state | **PASS** (defect 1 is a layout issue) | **Open:**<br>• Thu 18:00 as above.<br>• Fri 12:00: "Today, Fri Oct 16" all "—", "Yesterday, Thu Oct 15" 57.90 / $3.20, Change "—".<br>• Sat 10:00: "Next session, Mon Oct 19", "Yesterday, Fri Oct 16".<br>• Before the first Marks (Mon 12:00): "Today, Mon Oct 12", "Yesterday, Fri Oct 9", all dashes, beside the No Marks yet note.<br>• Call missing on Fri at 18:00: XYZ 58.30 / 57.90 / +0.40, Call — / $3.20 / —, with the Stale context line under the table.<br>• Call acknowledged: the same, plus "Mark acknowledged unavailable for XYZ Dec 18 $55 Call on Fri Oct 16: your acknowledgment, not a price".<br>• XYZ missing: XYZ — / 57.90 / —, Call $3.50 / $3.20 / +$0.30.<br>• Stock at Mon 18:00: "$47.00", Yesterday "Fri Oct 9" "—".<br>**Settlement Due (O-S2X):**<br>• Fri Nov 20 at 18:00 (the expiration evening): MNO 46.10 and Put $0.05; with the put's Mark missing, Put "—".<br>• Sat: "Next session, Mon Nov 23", Put "Expired".<br>• Mon 12:00: MNO "—", Put "Expired".<br>• Mon 18:00: MNO 46.80 / 46.10 / +0.70, Put "Expired" / $0.05 / —.<br>• Wed Nov 25: Put "Expired" in both columns.<br>• The screen-reader name is "Expired Fri Nov 20". No tracks.<br>**Closed by sale (K1):**<br>• "Exit Fri Nov 13", Call $12.40.<br>• NVDA reads "—" at Fri 12:00 and when no Fri Mark exists; it reads 162.40 once the Fri Nov 13 Marks exist (P1 holds).<br>• The Today column is empty, Change "—", and the "Closed" stamp is a paragraph in the accessibility tree.<br>**Closed by expiration:** "Expired Fri Nov 20", MNO 46.10, Put "Expired".<br>**Overall:** no cell ever carried a value forward. |
| **C8R.3** Rail and Plan and Risk | **PASS** | **Underlying Target:** "Target · 2.10 away", with no $.<br>**Stock, Stop breached:**<br>• Rail "Breached · $0.50 past"; Plan and Risk "Risk to stop $50.00 · 0.20R past", "Worst case: $4,700.00 · 18.80R if XYZ goes to zero".<br>• Tue at 18:00 with no Mark: "−$320.00 at the Mon Oct 12 Mark" and "… · Mon Oct 12 Mark", singular for stock.<br>**Option missing the call's Mark (Fri 18:00):**<br>• Rail: "+$218.05 at the Thu Oct 15 Marks", "Stop · $2.20 away · Thu Oct 15 Marks", and "Target · 1.70 away" undated, read from the current XYZ 58.30.<br>• Plan and Risk: "1.70 away" next to "Reward to target $180.00 · 0.90R · Thu Oct 15 Marks". This matches the Mark-availability decision.<br>**Before the first Marks, and with today's session not yet ended:** "Awaiting the Mon Oct 12 close" and "Awaiting the Fri Oct 16 close" (W34).<br>**Rail content:** no Worst case, Max reward or nearest on the rail. |
| **C8R.4** Journal and Deviations | **PASS** | **The line:** "1 active Deviation." followed by a button "See Plan and Risk". I reached Journal with the arrow keys and pressed Enter on the button: Plan and Risk is selected and focus is on the H2 "Deviations", inside the viewport.<br>**Dated lines on entries:**<br>• "Daily Review · Thu Oct 15, 4:00 pm";<br>• "Daily Review · Tue Oct 13, 4:00 pm · written Wed Oct 14";<br>• after I answered the deferred reflection on Fri: "Trade Detail · Wed Oct 14, 11:00 am · written Fri Oct 16" with "Deferred, answered".<br>**Gone:** no Anchor, Authored, Review Date or "Not answered".<br>**Paging:** focus moves to "Newer sessions" when "Earlier sessions" becomes disabled. |

**Layout** (every drawer, at 1280, 1100, 1024, 960, 375 and 320 px):
- **States checked:** O-C3+ (Fri 12:00), Settlement Due (Mon Nov 23 18:00), K1 Closed by sale, and O-S2X Closed by expiration.
- **Sideways scroll:** none on the page at any width.
- **Scroll boxes:** every one (Marks, Open Lots, Matched lots, Conditions table, Price History, payoff chart and tables) has `tabindex=0` and a name.
- **axe:** clean on every drawer at every width.
- **Problem:** the clipped Today heading in defect 1.

## 3. Overall: **PASS**, with one Moderate defect and two Low ones

**Defect 1 (Moderate): the Today column's heading is hidden when the drawer opens at 1100, 1024 and 960 px.**
- **Steps:** open O-C3 at Thu Oct 15 18:00 (or O-C3+ at Fri 12:00) at 1024 px; Today opens.
- **Expected:** W29's heading "Today, Thu Oct 15" readable. The section 8 brief says to check for clipped headings.
- **Actual:**
  - The Marks scroll box opens scrolled to its right end: `scrollLeft` is 82 at 1024 px, 146 at 960 and 6 at 1100.
  - The sticky row-header column then covers the start of the Today column. At 1024 the heading reads ", THU OCT 15"; at 960 it reads "T 16".
  - The trader cannot see which column is Today without scrolling back.
- **Cause:** the scroll box `ScrollsToEnd` in `src/ui/cockpit/drawers/today.tsx` still keeps the box at its right end. Its comment says the current date shows first that way, but in the new column order (Today, Yesterday, Change) the current date is the left column.
- **Also affects:** Closed and Settlement Due Today tables at 1024 and 960.
- **Not affected:** 1280, 375 and 320, where the table fits.
- **Screenshots:** `/Users/ckolbegger/src/trade-journal-v3/worktrees/claude-opus-5.5/test-results/critic-d08r-3/shots/marks-oc3-1024.png` and `/Users/ckolbegger/src/trade-journal-v3/worktrees/claude-opus-5.5/test-results/critic-d08r-3/shots/marks-oc3plus-960.png`.

**Defect 2 (Low): an owed reflection in the Journal keeps the old layout.**
- **Steps:** O-C3 at Thu 18:00 → Journal → the Wed Oct 14 card.
- **Expected:** W27's one dated line in the app's format, as every other item has ("Position Change · Wed Oct 14, 11:00 am"), per A239.
- **Actual:** "Position Change at 2026-10-14 11:00", followed by a term/definition pair "Due" / "Due".

**Defect 3 (Low): the Deviation line has no final full stop.**
- **Expected:** W24, "1 active Deviation. See Plan and Risk."
- **Actual:** "1 active Deviation. See Plan and Risk", with nothing after the button.

## 4. Minor observations (no defect raised)
1. **Payoff repeats Realized to date.** Its caption reads "including +$98.70 realized to date", which is also Position's Realized to date figure. It is not on C8R.1's list of accepted repeats, but the audit left Payoff unchanged.
2. **When only the XYZ Mark is missing, the Target loses its distance.** The rail shows "Target · Mark missing" and Plan and Risk shows "Mark missing: XYZ, Fri Oct 16", instead of a dated "2.10 away · Thu Oct 15 Marks". This follows A231 (no dated line while the Trade P&L is available), but it is the reverse of the call-missing case. Nothing in Today notes the missing XYZ Mark.
3. **The Stale context line doesn't say which Mark it is.** It reads "$3.20 from Thu Oct 15 close" without naming the call. With both Marks missing (Sat, no Friday Marks) only the call's line appears.
4. **Undated figures:**
   - The price track calls Thursday's $3.20 "now" at Fri 12:00 ("Option price: Stop $1.00, now $3.20"), as the audit's mockup does.
   - Payoff's "If XYZ is at 57.90 at expiration: +$147.40" is undated at Fri 12:00.
   - The track's accessible name leaves out "Entry, the open lots' average, $2.65", which the audit's mockup gives. The dot does sit at $2.65, and the lot ticks are named "$2.00 · Mon Oct 12" and "$3.30 · Fri Oct 16".
5. **"Max reward: Unbounded above · Thu Oct 15 Marks"** puts a date on a value that needs no Mark.
6. **Settlement Due P&L card changes form within one day.** It shows "$238.70 / 2 of 2 contracts open" at Sat, and at Mon Nov 23 12:00, then "Settlement Due: MNO Nov 20 $45 Put / Trade P&L once the expiration is recorded" at Mon 18:00.
7. **Narrow-screen headings:** at 320 px they run together ("EXIT FRI" against "CHANGE", "THU OCT 15" against "CHANGE").
8. **Accessibility tree:**
   - The Marks region contains a second region also named "Marks".
   - Journal entry headings are h3 inside session cards whose headings are also h3.
9. **Price History doesn't show an acknowledgment.** The acknowledged-unavailable call cell reads "No Mark", the same as an ordinary gap.
10. **No UI path to these Underlying Marks.** There is no way to enter a Settlement Due Trade's Underlying Mark after expiration, or a Closed-by-sale Trade's Underlying Mark at its exit session, except through another Trade open on that symbol. The breakdown already records this as revision 98's consequence.
