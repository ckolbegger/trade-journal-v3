# D95 critic-c1 report

## 1. Header

- **When:** 2026-11-26, 18:21 to 18:54 EST
- **Commit:** `40aca6101ac9549f7382a895c4bb70053734e6ef` (plan(D95): T95.67 in progress)
- **Versions:** Node v26.12.0, Playwright 1.63.0, Chromium 153.0.8010.12
- **Build:** `npm run build:all` once, inside `.claude/scripts/with-browser-lock.sh`; it exited 0.
- **Server and driver:** I used a scratch Node driver, not a Playwright config: `/Users/ckolbegger/src/trade-journal-v3/worktrees/claude-opus-5.5/test-results/critic-d95-c1/driver.ts`. It ran under the browser lock and started the suite's release server (`tools/release-server.ts`) on 127.0.0.1:5175.
  - It served `dist-releases/current`, except during C95.8's setup, which served `dist-releases/d9r2`.
  - Every scenario ran on a new profile folder: a fresh one, or a copy of a saved setup built on this build.
  - The mockup was opened from `file://` in a separate Chromium.
- **Shutdown:** every server and browser I started is stopped, and `lsof` shows nothing listening on 5175.
- **Tracked files:** I edited none. `git status --short` shows ` M evidence/D95/structural.md`, but that file was already modified before my first command; I did not open or touch it.
- **Screenshots:** `/Users/ckolbegger/src/trade-journal-v3/worktrees/claude-opus-5.5/test-results/critic-d95-c1/shots/`

## 2. Results

Widths are the ones each flow actually ran. "Touch" means a real 375-wide viewport with touch enabled. "Resized" means a 1280 context made narrower, without touch.

| Flow | Result | Key observations |
|---|---|---|
| **C95.9** Expiration day (1280; out of the money at 375 touch; no Underlying Mark at 1280 and 320 resized; next day at 1280, twice) | PASS, with defects 3, 4, 5, 6, 7 and 8 | **In the money:** "XYZ $57.00, strike $55.00: $2.00 in the money", "Worth $200.00 at expiration: +$98.05 · +0.25R on the Trade."; for MNO, "Worth $400.00 at expiration: −$151.30 · −0.42R". The main button is "Exercised: record later" for the long contract and "Assigned: record later" for the short one. "It expired worthless" reads "This books +$248.70 · +0.69R on a put worth $400.00." and refuses with "Say why." until a reason is given. Saving with a reason recorded the expiration at "2026-11-20 16:00", with "Reflection saved." and "Close Review owed". Saved "record later" line: "Assigned, to record later. Today's Review can finish. The next Review asks again." The finished day reads "Complete, settlement to record", with To record "XYZ: the exercise of 1 contract…" and "MNO: the assignment of 2 contracts…". **Out of the money:** "MNO $46.00, above the $45.00 strike: expired worthless. You keep $248.70.", with "Record expiration" and "Bought it back before the close". **No Underlying Mark:** "No price for XYZ, so the app can't say where it finished. What happened?", with three buttons and no main one. **Next day (Mon Nov 23):** "Expired: settle", no Mark asked, and W144 shown. "record later" again let Monday finish "Complete, settlement to record". The stored Settle Later entries are one per Trade per date (Nov 20 and Nov 23), and the Trade's fact count did not change (AC-SET-005). |
| **C95.10** The Replay (1280; 375 and 320 resized; 375 touch) | PASS | From a Trade past a line, the Replay opens on the first crossing: CORV opens on "Fri Nov 6" (first reached), DALE on "Fri Nov 13". "What you did that day" reads "Action: Hold · "Waiting for 54 to hold."" and "Action: not chosen yet.". The expired card's Replay reads "Expired. You chose Exercised: record later.". The closed card's Replay reads "Sold 100 at $27.60. Action: Exit · no reason given". The Action row is "– … H", with the key "H Hold · E Exit · R Roll · A Adjust · – no Review". Key moments: "1. Entry + Low · Mon Nov 2 … 4. Now · Fri Nov 13", and choosing one moves the slider. Escape returns focus to "Replay". There is no sideways scroll at 375 or 320. On a phone the Key moments drop-down sits under the chart, not above the slider. |
| **C95.11** Close Review walk (Review at 1280 by keyboard; Trade Detail at 375 touch; decline at 1280; walk at 320) | PASS, with defects 1 and 5 | "1 of 2 seen" and "See the 2 key moments first, then answer." with the questions disabled; "All 2 seen. Now write." unlocks them. Saving empty gives "Choose one." and "Write the lesson.". After saving, the card reads "Close Review saved". From Trade Detail, "Reflect now" opens the same walk, and the answer is saved as "Deferred, answered". Decline gives "Decline this Close Review? The Journal will show it as declined.", "Why? (optional)", "Keep it" (focus returns to "Write the Close Review") and then "Close Review declined". No sideways scroll at 320. |
| **C95.12** Keyboard, screen reader, resize (1280; resized to 375, 320, then 1280 mid-form) | PASS, with defect 5 | Tab reaches "Enter the Marks", which puts focus in the first input. Enter moves to the next input and, after the last, to "Save Marks (2)". After Save Marks, focus goes to the first Trade's header; after each Action, to the next header; at the end, to "The day". After Discard, focus goes to the card header. A typed reason, the chosen radio and Conviction "3 [pressed]" survive the resize. axe (`expectAccessible`) found no violations in 8 states: Review open, Action form, finished day, the expiration block, the "worthless" form, the closed card, the Replay dialog and the sale receipt. Save Marks and each save announce nothing in a live region; only focus moves. The known item "focus after the last Hold falls to the page body" is fixed: focus now goes to "The day". |
| **C95.1** Routine day (1280 by keyboard with 2 Trades; 4 Trades by mouse at 1280 and by touch at 375) | PASS, with defect 7 | Four Actions, then "Complete", "The day −$237.00", "Past Stop: DALE · At Target: BREN (2 sessions), CORV (3 sessions)" and "DALE, BREN, CORV expire Fri Nov 20: 5 sessions left.". No sideways scroll at 375. |
| **C95.2** Slips (375 touch only) | PASS | "$54.10 or $541.00?" took the reading pressed. "Worth nothing?" with "Yes, $0.00". "+6.7% from $75.00. Right?" accepted with "Yes, $80.00". "−8.8% from $53.70. Right?" with "Retype" cleared and refocused the input. "1 Mark to check first." held Save. "Edit" showed "Saved in this Review: fix it in place, no reason needed.", and the store holds revision 2 as a Correction with "Fixed in the same Review". |
| **C95.3** Cards against Trade Detail (1280; 375 touch; 320 resized) | PASS | AXIO, BREN, CORV and DALE: P&amp;L, distances, Worst case and Max reward agree with Trade Detail and with arithmetic (for example AXIO 200 × 6.80 = "lose −$1,360.00"; CORV max "$22,410.00 more"). At 375 the captions shorten by step ("−$6.80 (−$1,360.00)", "+$2.20 (gain $440.00)"); at 320, "+$2.20 (+$440.00)". The full sentence stays as each note's accessible name. The drawing's name: "P&amp;L +$620.00, 58% of the way to the Target. Stop −$740.00, Target +$1,060.00. Down from +$680.00 on Thu Nov 12." |
| **C95.4** Day Complete with Unavailable Marks (1280; resized to 375) | PASS (known items only) | The day reads "Complete with Unavailable Marks", with the "Unavailable Marks" group: "Instruments: ABC", "Trades: ABC (Long 100 shares @ $30.00)", "Not calculated: Valuation, Risk, Reward, Condition status". The card shows "No price today: deciding on the Mon Oct 12 figures." and "Nothing is chosen for you here.". The "At the Mon Oct 12 Marks" figures and the missing day total are known tech debt. |
| **C95.5** AC-REV-007 (375 touch only) | PASS, with defect 9 | Hold was preselected only for AXIO ("Inside its lines. The Plan says hold."). For DALE, BREN and CORV ("The Plan says out.") nothing was preselected, Hold with no reason was refused with "Say why.", and Exit with no reason saved. AXIO's Exit with no reason was refused. Trade facts did not change. |
| **C95.6** Sales (1280 only) | PASS, with defect 1 | Following the Plan: "Follows the Plan: all 100 shares, at the Stop. Nothing more to ask." Before a line: "Neither the Stop nor the Target is reached.", plus the carried reason "Your reason, Mon Nov 16: "Earnings risk tomorrow." Nothing more to ask.". After holding past: "The Stop was reached Fri Nov 13. You held 1 session past it."; from Trade Detail, "The Target was reached Wed Nov 11. You held 2 sessions past it.". In part: "The Plan's exit is all 2 contracts. This sells 1." and "Why only part?". "Say why later" gave "Why you left the Plan is owed at the next Review."; the next Review showed "To do: Say why, Action", refused an empty answer, and the answer was saved. |
| **C95.7** Day after an Exit (1280 only) | PASS, with defect 2 | The banner "You chose Exit on Fri Nov 13. Still holding 2." with "I sold: record it", which opened the sale, and "Still holding", which hid the banner and asked the Action as usual. Refusal: "AXIO's note isn't saved." with "Save it" (saved the Exit), "Discard it" and "Back to AXIO" (kept "Half typed"). |
| **C95.8** D9 Workspace with an owed reflection (1280 only) | PASS | After the d9r2 → current update, the owed reflection keeps revision 1 (no "Why did you leave the Plan?"). It was answered on Trade Detail and stored under revision 1. A new Hold was stored under `daily-trade-review` revision 2. |
| **Screen reader pass** | PASS, with defect 5 | Names and roles read correctly: "Expired contract" region, "Key moments" combobox, "Action by session" list ("Fri Nov 13: Hold"), each caption's `note` carries its full sentence, Conviction buttons report [pressed], and refusals mark fields [invalid]. See minor observations 3 and 4. |
| **Phone width (375 touch)** | PASS | No sideways scroll in any flow at 375 or 320. Buttons are 44 px tall. The bottom bar is fixed. |
| **Day Complete with Unavailable Marks** | PASS | As C95.4. |
| **Reflection owed on an open Trade** | PASS | As C95.8, plus the open BREN card's "Say why" in C95.6. Before it is due, the card shows "Mon Oct 12 · Due in the next Review" with "Reflect on 2026-10-12 10:00". |

## 3. Overall: PASS

No flow failed its pass condition and there is no High defect. There are 5 Moderate and 4 Low defects.

**Defects**

1. **Moderate: the closed card says the Stop was "Never reached" for a sale through the Stop.**
   - **Steps:** ABC_DEF at Mon Oct 12. Mark ABC 27.50, save Exit, then "Record the sale" for 100 at $27.60. The form says "Follows the Plan: all 100 shares, at the Stop." Close Reason is Stop Triggered. Open Tue Oct 13's Review.
   - **Expected:** T95.56 case 10 says the cell reads "Reached" with the date. `specs/design/trade-workflows.md:90` measures a condition priced in the traded Instrument at the change's own price.
   - **Actual:** the table row reads "Stop | $28.00 | Never reached", beside "Stop Triggered" and "Sold 100 at $27.60". The same Trade's Replay session card says "Sold 100 at $27.60, $0.40 below the Stop".

2. **Moderate: the label reads "100% to Target" on a Trade past its Target, when an Exit was not carried out.**
   - **Steps:** FOUR_TRADES_FRI. Exit BREN on Fri Nov 13; on Mon Nov 16 mark the Call at $5.30 (Target $4.00).
   - **Expected:** A302 and W102 give "At Target".
   - **Actual:** the day line, the card header and the hidden reason say "100% to Target" / "100% of the way from entry to the Target". On the same card: "$1.30 past Target (+$260.00 so far)", "At your Target … The Plan says out." The finished day says "At Target: BREN (3 sessions)". After the next Marks save (no banner) the label is "At Target" again.

3. **Moderate: "You lose the $101.95 paid." on a partly sold contract.**
   - **Steps:** SETTLEMENT T-1 (1 of 2 calls sold at +$88.70). Fri Nov 20: XYZ 54.00, Call 0.
   - **Expected:** W141 says "You lose the $X paid": the cost of the contract that expires. The receipt shows that lot cost "−$190.65".
   - **Actual:** "XYZ $54.00, below the $55.00 strike: expired worthless. You lose the $101.95 paid." $101.95 is the whole Trade's result, not what was paid.

4. **Moderate: "Sold before the close" fills in the evening's time, after the close.**
   - **Steps:** Expiration-day Review at Fri Nov 20 17:00. In the expiration block press "Sold before the close", fill 1 / 2.50 / 0.65, keep the time.
   - **Expected:** the button's own words, and NOTES ("'Sold before the close' … dated Fri Nov 20").
   - **Actual:** Economic Time is filled with "2026-11-20T17:00", after the 16:00 settlement, and it saves: "position change at 2026-11-20 17:00", "Closed via sale of 2 contracts", "Its Close Review is due in the Review after next." On Mon Nov 23 it fills "2026-11-23T17:00", which is refused ("cannot be after the expiration date, Fri Nov 20").

5. **Moderate (accessibility): focus drops to the page body after these steps.**
   - **Steps:**
     - In the expiration block: "It expired worthless", "Record expiration", "Back to the Review", and "Cancel" on the sale form (by keyboard and by mouse).
     - In the grid: "No price".
     - In the walk: the last "Next moment" (focus leaves the open dialog; the next Tab lands on "Previous session").
     - After "Save the Close Review".
     - After "Decline the Close Review".
   - **Expected:** A327 and T95.61 keep focus in place after each save; WCAG 2.4.3 (focus order).
   - **Actual:** `document.activeElement` is BODY after each of those steps, and no live region announces the result.

6. **Low: W136's second sentence is missing.** "Expired today: nothing left to decide, only how it settled." (approved W136, and in the mockup's Now box) appears nowhere; only the heading "Expired Fri Nov 20 · no Action needed" is shown.

7. **Low: Enter after the last input does not reach Save Marks when an earlier session is Missing.**
   - **Steps:** expiration day; type in the four Fri Nov 20 cells with Enter.
   - **Expected:** T95.15 case 1 says Enter after the last input moves to Save Marks.
   - **Actual:** focus goes to "XYZ Mark, Thu Nov 19" and opens its "Missing / Can't get a price" editor. With no Missing column it does reach "Save Marks (2)".

8. **Low: the next day's settlement card says the choice twice, in two names.** It shows "Fri Nov 20 you chose Settle Later, no reason given." and also W144, "Fri Nov 20 you chose Exercised: record later. It is still to settle, so this Review asks again." This goes against U2 (a figure appears once).

9. **Low: "Tomorrow: Sell BREN, DALE, CORV, then record the sales."** DALE is a short put, so it is bought back; the card's own button reads "Record the buy-back".

## 4. Minor observations

1. **The Now box measures expired contracts on the expiration evening, as the mockup does.** On MNO, which expired worthless, it shows "−$4.00 (−$600.00)" to Stop and "Worst case $9,000.00 more · 25.00R". The expired card's Replay says "From here: $200.00 at risk…". Trade Detail the same evening says "The contract expired, so its conditions are no longer measured." (D08P W6), and Monday's card shows "Settlement Due: …". The agreed mockup draws the same measured figures, so I am not filing this as a defect; it needs a ruling.
2. A sale with the Underlying acknowledged Unavailable still says "Neither the Stop nor the Target is reached."
3. The day card's visually hidden reasons ("Mark acknowledged unavailable… 17% of the way…") are read as one run-on after the Trade list, besides being each link's description.
4. The Now box's key is an unnamed list ("Realized, open, past the line…").
5. After Save Marks, focus lands on ABC's header (now first) while DEF's card stays open; the next Tab goes into DEF.
6. The day card counts "1 Trade · … 1 Close Review to go" with two lines listed, and "0 Trades · 2 Close Reviews and 1 reflection to go" plus "Day so far: $0.00" when no Trade is open.
7. The Settle Later session has no mark in the Replay's Action row; the list ends at the day before.
8. DALE's buy-back is named "Sale" in Key moments.
9. After "Still holding", the card's subline still reads "You chose Exit and it is not recorded".
10. Known items still present:
    - The closed card owing a reason is headed "Close Review due", never "Say why".
    - The banner's bare colon.
    - The banner after a part sale omits "Sold 1 since"; the card has it.
    - "Stop breached" / "Target reached" in hidden text.
    - Backdated settlements are Due at once (T95.46-B6): an expiration recorded on Monday for Friday made its Close Review due that Monday.
11. The grid's previous-session column shows stock Marks without "$" ("DALE 54.60") in one Workspace and with it ("$57.00") in another.