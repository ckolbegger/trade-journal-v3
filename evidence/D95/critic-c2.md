# D95 critic-c2 report

## 1. Header

- **When:** Thu Nov 26 2026, about 20:30 EST.
- **Commit:** 2db53f1e07cd675bdcf83ebe9faf6a5418586db6 (branch claude-opus-5.5).
- **Versions:** Node v26.12.0, Playwright 1.63.0, Chromium 153.0.8010.12.
- **Builds and servers:**
  - The checked-out release `dist-releases/current`, served by the d4 fixture's `startReleaseServer` on port 5175 under `.claude/scripts/with-browser-lock.sh`.
  - For C95.8 only, `dist-releases/d9r2` was served first, then the update to `current`.
  - Every test started from a fresh copy of a saved browser profile.
- **Clean state at the end:**
  - `git status --short` printed nothing.
  - `lsof -iTCP:5175 -sTCP:LISTEN` found no listener.
- **Scratch work:** only in /Users/ckolbegger/src/trade-journal-v3/worktrees/claude-opus-5.5/test-results/critic-d95-c2/. Logs are in `obs/`, screenshots in `obs/*.png`, and Playwright's output is in `out/`.

## 2. Results

Every flow ran at 1280 and at 375 with touch. The 320 checks are listed where they were done.

| Flow | Result | Notes |
|---|---|---|
| C95.1 | PASS | Done with the keyboard alone. After Save Marks (4), focus moves to the first header. Each Hold moves focus to the next header, and the last one to "The day". The day reads "Complete · The day +$127.00 · You chose Hold ABC, XYZ, DEF, JKL · Next Review Tue Oct 13, after the close." |
| C95.2 | PASS | The slip questions work ("$29.50 or $295.00?", "+8.6% from $40.50. Right?", "Worth nothing?" with "Yes, $0.00"), and "A share price can't be $0.00." "4 Marks to check first" refuses the save and focuses the first problem. Retype empties the field. Editing in place needs no reason. |
| C95.3 | PASS | The card figures match Trade Detail for T-1 and T-3: Stop "Breached · 1.00 past", Target "9.00 away", Worst case $8,160.00 · 22.67R, Max reward $840.00, Expiration −$551.30, Risk to Stop $300.00 · 0.75R and Reward to Target $200.00. T-2 (the stock) was checked on the card only. |
| C95.4 | PASS | XYZ shows "No Action until today's Mark is in." After the acknowledgment nothing is preselected. Hold saves with no reason; Exit asks "Say why." |
| C95.5 | PASS | "Choose an Action." and "Say why." DEF at Target: "The Plan says out." with nothing preselected. Holding past a line is reported the next day. |
| C95.6 | PASS | From the Review and from Trade Detail, all four results show: Follows, Leaves the Plan before a line, In part with "Say why later", and After holding past. Each receipt takes focus. The owed reason is answered the next day; after "Answer", focus moves to the Action header. |
| C95.7 | PASS | "I sold: record it" and "Still holding" both work. The unsaved-note refusal offers "Save it", "Discard it" and "Back to JKL", with focus on "Save it". All three choices work. |
| C95.8 | PASS | The update from d9r2 installs. The owed reflection is answered, and the preselected Hold saves. Stored: Action `daily-trade-review#2`, plus the older `plan-reflection#1` and `position-change-reflection#1` entries. |
| C95.9 | PASS | The expiration block, the in-the-money and out-of-the-money texts, "Exercised: record later" and "Assigned: record later", and "Complete, settlement to record" all show. axe found nothing. Buttons are 46px tall at 375. At 320 the block wraps with no sideways scroll. |
| C95.10 | FAIL | See defect 1. The key moments, the Action row (H, E, –), the first-crossing start and the DEF Replay from the Review and from Trade Detail all observed fine. |
| C95.11 | PASS | The walk locks until "All 2 seen. Now write." An empty save gives "Choose one." and "Write the lesson." Escape with typed text asks to confirm. After the save, focus goes to the header. Decline asks to confirm, and "Keep it" works. The walk reads fine at 320. |
| C95.12 | PASS, with defect 1 | axe found nothing on the start, the open card, the finished Review or the Replay. Four resizes (375, 320, 1280, 375) kept the typed reason and the chosen Roll, with no sideways scroll. |
| Screen reader pass | PASS, with defect 1 | The accessibility tree reads well: named regions, the Plan table, `group "Unavailable Marks"`, and a Replay dialog whose Tab order stays inside it. |
| Phone width (375, and 320 for Part C) | PASS | The expiration block, the Replay and the Close Review walk all fit at 320. Low observations 6 and 7 apply. |
| Complete with Unavailable Marks | PASS | Shows "Complete with Unavailable Marks" with its disclosure. Combined with a settlement, see defect 2. |
| Reflection owed on an open Trade | PASS | The card shows "To do: Say why, Action". "Answer" saves, and the card then reads "None owed". |

**The five C1 fixes:** all five are confirmed.

1. The closed card's Stop cell reads "Reached Tue Oct 13".
2. The card says "At Target", never "100% to Target". No log contains "100% to".
3. "You lose the $190.65 paid." The figure equals the open lot's net cost, so it is correct.
4. "Sold before the close" and the buy-back both prefill 15:59 on Fri Nov 20.
5. Focus no longer falls to the page body:
   - after Save Marks, an Action or a settlement it goes to the next header, or to "The day";
   - in the Marks grid it goes to the input after Undo and to the first input after Edit.

   The exceptions are defect 1 and Low observations 3 and 4.

## 3. Overall: FAIL

**Defect 1. Moderate. In the Replay, the step buttons drop focus to the page body, and Escape then does nothing.**

- **Steps:**
  1. Use the ABC_WALK setup on Wed Oct 14 and open the Review.
  2. Open ABC's card and Tab to its Replay button. Press Enter.
  3. Tab to "Previous session" and press Enter. The Replay steps to Mon Oct 12 (1 of 2), and the button becomes disabled.
  4. Press Escape.
- **Also on Trade Detail:** pressing Enter on "Next session" to reach the newest session does the same thing.
- **Expected:** focus stays inside the dialog, and Escape closes the Replay and returns focus to the Replay button. A327 says: "Escape or 'Back to the Review' closes the Replay and returns focus to the button that opened it." This is not on the known list. I did not check whether it predates D9.5.
- **Actual:**
  - Focus moves to BODY.
  - Escape leaves the dialog open (dialog count is still 1).
  - The next Tab lands on the Session slider; only then does Escape close it.
  - Same at 1280 and 375, by mouse and by keyboard.
- **Evidence:** /Users/ckolbegger/src/trade-journal-v3/worktrees/claude-opus-5.5/test-results/critic-d95-c2/obs/r13-1280.txt and /Users/ckolbegger/src/trade-journal-v3/worktrees/claude-opus-5.5/test-results/critic-d95-c2/obs/r13-375.txt.

**Defect 2. Low. With a settlement to record and Unavailable Marks on the same day, nothing on screen names the Unavailable Marks.**

- **Steps:**
  1. Use SETTLEMENT on Fri Nov 20. Enter XYZ and its call.
  2. Mark MNO and the MNO put "Can't get a price" with a reason, then Save Marks.
  3. Choose "Assigned: record later" on MNO and "Exercised: record later" on XYZ's call, and Hold the XYZ stock.
- **Expected:** the finished day "carries the Unavailable disclosure as well when both apply" (A316; T95.49 case 7; specs/design/daily-review.md, the completion section).
- **Actual:**
  - The status reads only "Complete, settlement to record".
  - Below the Trade lines, three unheaded lines follow: "Instruments: MNO, MNO Nov 20 $45 Put / Trades: … / Not calculated: …".
  - Screen readers do get the label `group "Unavailable Marks"`, but sighted users see no words saying these Marks are unavailable.
  - MNO's line reads "Expired: settle Done · Settle Later".
- **Severity:** Low, because the disclosure is present and labelled for assistive technology.

## 4. Minor observations (not filed)

1. The Replay headline says "+$98.05 · 0.25R" with no "+" on the R. The card shows "+$98.05 · +0.25R".
2. On the closed option card, the Plan column reads "XYZ at or below 48.00" with no "$", while stock cards show "$28.00".
3. In the Marks grid, after "Can't get a price" and then Cancel, focus falls to BODY. Focus also stays on "Undo" after "No price" instead of moving to the next input.
4. Saving the Close Review from Trade Detail left focus on a DIV.
5. On the Review, nothing is announced to a screen reader after Save Marks or an Action; focus moving is the only cue. Enter in "Why no price" does not confirm (already known).
6. At 320, the Replay's Action row for a 30-session Trade is a thin line with no readable letters. The Key moments select cuts off ("3. Low + High + Now · Fri Nov").
7. The "Missed" list runs to 29 dates. The next-day Now box shows "Settlement Due: XYZ Nov 20 $55 Call" as row values.

**Coverage gaps:**

- The T-3 buy-back form was opened and its prefill read, but my helper could not leave the form, so that sale was not saved.
- The stock T-2 was not compared against Trade Detail.

The known tech debt items and out-of-scope deliverables were not refiled. These include the meter's "50% of the way" against "35% to Target", the bare colon after "chose Exit on ABC", the missing W136 second sentence, the duplicate "Settle Later, no reason given", and the grid showing open after a reload.