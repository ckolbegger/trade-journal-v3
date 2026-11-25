# D95 Part B critic-1 report

## 1. Header

- **Date and time:** 2026-11-24, 19:05 to 19:36 EST.
- **Commit:** `c5bd278231d811fa743128e3450738b4a037b523`, branch `claude-opus-5.5`.
- **Versions:** Node v26.12.0, Playwright 1.63.0, Chromium "Google Chrome for Testing" 153.0.8010.12 (chromium-1243), headless.
- **Builds: I did not build.** My `npm run build:faults && npm run build:releases` was denied by the permission classifier. I ran on the existing `dist-releases/current`, `dist-releases/d9r2` and `dist-faults`, all built at 18:57. The last commit touching `src/` is `ce52daf6` at 18:41. `git diff --name-only ce52daf6 HEAD` lists only `evidence/D95/` and `plan/`.
- **Servers:** the suite's release server (`tools/release-server.ts`) on port 5175, started and stopped by the Playwright fixture. Every run was wrapped in `.claude/scripts/with-browser-lock.sh`. It served `dist-releases/current`; for C95.8 it served `dist-releases/d9r2` first, then updated to `current`. After the last run nothing listens on 5175 and no browser is left running.
- **No tracked file was edited:** `git status --short` is empty. Scratch specs, logs and screenshots are in `/Users/ckolbegger/src/trade-journal-v3/worktrees/claude-opus-5.5/test-results/critic-d95-b1/` (logs and PNGs in `obs/`).
- **Setup:** I used the suite helpers only to reach each starting state: onboarding, creating Trades, Monday's Marks and Actions, the D9 Workspace and the update. Every action a flow names I performed myself by role and label, and I judged the screen myself. Every flow ran on a context launched at 1280 and on one launched at 375 wide. No helper failed.

## 2. Results

| Flow | Result | Key observations |
|---|---|---|
| C95.5 | PASS (Defect 1) | Monday Marks: XYZ $47.00 (past its Stop), ABC $36.50 (at its Target), DEF $41.00 (inside), JKL none.<br>**Past the Stop:** "Past your Stop (XYZ at or below $47.50). The Plan says out." and "Nothing is chosen for you here.", with no choice made. Save with nothing chosen: "Choose an Action.", nothing stored. Hold: "Holding leaves the Plan. Have a new Stop? Choose Adjust.", "Why? (required)"; saved with no reason it gives "Say why.", nothing stored. Exit: "The Plan's exit: sell all 100 shares at the Stop. No reason needed. Record the sale once it is done." It saves with no reason, showing "Mon Oct 12: Exit", "Not done until it is recorded. Tomorrow's Review will ask.", Change and Record the sale.<br>**At the Target:** the same, with "At your Target (ABC at or above $36.00)…" and "Have a new Target?".<br>**Inside:** "Inside its lines. The Plan says hold.", Hold chosen, "Keep it as it is.", "Save Hold". Exit gives "Exiting now leaves the Plan.", "Why? (required)"; with no reason it gives "Say why.".<br>**No Mark (JKL):** "No Action until today's Mark is in. Enter it". After "Can't get a price": nothing chosen; Exit with no reason is refused; Hold with no reason saves.<br>**Leaving the Plan:** through Change, Hold with no reason is refused on XYZ and ABC and saves with a reason ("Mon Oct 12: Hold · “Bounce expected off support.”"). DEF's Exit is refused, then saves with a reason.<br>**Stored:** four Action entries; a change is version 2 of the same entry. The Trades store is byte-identical before and after. There is no Deviation store. The day ends "Complete with Unavailable Marks". No sideways scroll; at 375 the four choices sit on two rows. |
| C95.6 | PASS (Defect 2) | Tuesday, from the Review and again from Trade Detail:<br>**Following the Plan:** ABC, all 100 at $27.60 past the Stop: "Follows the Plan: all 100 shares, at the Stop. Nothing more to ask." No question is asked and no Close Reason is chosen; saving without one gives "Choose a Close Reason.". Receipt: "Recorded. ABC is closed. Its Close Review is due in the next Review." Only a Close Review Debt is left.<br>**Before a line, Exit reason saved:** DEF: "Neither the Stop nor the Target is reached." and "Your reason, Tue Oct 13: "Earnings tomorrow." Nothing more to ask." No question is asked. Seen from both entry points.<br>**Before a line, no Exit (Trade Detail):** asks "Why did you leave the Plan?" with "Say why later"; empty, the save is refused with "Say why you left the Plan, or choose “Say why later”.".<br>**After holding past:** XYZ: "The Stop was reached Mon Oct 12. You held 1 session past it." "Say why later" with no Close Reason does not save ("Choose a Close Reason."); with one it does. Receipt adds "Why you left the Plan is owed at the next Review." The Debt has `requires: ["PlanDepartureReason"]`.<br>**Part sale:** 40 ABC at the Stop asks "Why only part?". 40 JKL inside leaves on two counts and asks "Why did you leave the Plan?" once. JKL's card refreshes to "Long 60 shares" and "Realized, open −$21.40 · −$30.60".<br>**Owed group:** closed Trades appear under "Trades with owed reflections", headed "Close Review · next Review".<br>**Wednesday:** XYZ's line reads "To do: Say why, Close Review" (JKL's: "To do: Mark, Say why, Action"). The owed form shows "Why did you leave the Plan?" with aria-required true. Answer with it empty gives "Answer “Why did you leave the Plan?”." and the reflection stays owed. With text it is answered and the card shows the reason. Decline on Trade Detail turns into "Decline anyway", so declining takes more steps than answering.<br>The sale form is one column at 375, with no sideways scroll. |
| C95.7 | PASS (Defect 3) | Monday's Exit on ABC with "Taking the gain.".<br>**Day card:** "Mon Oct 12 you chose Exit on ABC: “Taking the gain.” Still holding 100." **Card:** "You chose Exit on Mon Oct 12. Still holding 100." Each has "I sold: record it" and "Still holding". No banner on the other Trades.<br>**Still holding:** both disappear and nothing is stored; the form shows as usual ("No Action until today's Mark is in"). After a reload both are back.<br>**I sold: record it on the card:** opens the sale form; a 40-share part sale is recorded. The card then says "You chose Exit on Mon Oct 12. Sold 40 since. Still holding 60.".<br>**I sold: record it on the day card:** the last 60 give "The Plan's exit: all 60 shares…" and "Your reason, Mon Oct 12: "Taking the gain." Nothing more to ask.".<br>**Half-typed Action (DEF Roll with a reason), XYZ pressed:** "DEF's note isn't saved." with "Save it" focused; XYZ stays shut.<br>- "Back to DEF": Roll and its reason are kept.<br>- "Discard it": XYZ opens; DEF is back to Hold with an empty reason; nothing stored.<br>- "Save it": the Roll is saved with its reason and XYZ opens.<br>- "Save it" when the form can't save (Adjust, no reason): the form's own "Say why." shows and XYZ stays shut.<br>A half-typed sale is refused the same way.<br>**No price today:** with an earlier Mark, "No price today: deciding on the Mon Oct 12 figures." |
| C95.8 | PASS | D9 Workspace with one Position Change Reflection owed, on form revision 1. After the update: content revision 5 to 6; revision 2 of Close Review, Daily Trade Review and Position Change Reflection added; the owed Debt still names revision 1. On the Review card the owed form has no "Why did you leave the Plan?" and no expiration prompt. Answer with nothing filled asks for its three required answers; filled, it saves under revision 1 and the card reads "None owed". Mark $52.00: "Inside its lines. The Plan says hold.", Hold chosen. The saved Action is stored under Daily Trade Review revision 2. The day reaches "Complete". Same at 375, with no sideways scroll. |

No Part A regression met.

## 3. Overall: PASS

Every Part B flow meets its pass condition at both widths. There are two moderate defects and one low.

### Defects

**1. Moderate: a stale refusal stays on the Action form after the Action is changed.**
- **Steps:** C95.5, XYZ past its Stop (or JKL with its Mark unavailable). Choose Hold and press Save Hold: "Say why." appears. Then choose Exit (for JKL, go from Exit to Hold).
- **Expected:** the form marks "Why?" required only as the rule says for the Action chosen (T95.33 item 4). Exit here is "No reason needed" (W122).
- **Actual:** under "Why? (optional)" the field keeps its red border and the red "Say why." stays, right below "No reason needed" (screenshots `obs/c955-375-06-XYZ-exit-chosen.png` and `obs/c955-375-31-JKL-hold-chosen.png`). Likewise, "Choose an Action." stays at the top after Hold is chosen (`obs/c955-375-05`). Saving works, but the screen says a reason is both optional and missing.

**2. Moderate: after a closing sale from the Review, the card keeps the open-position figures beside the receipt.**
- **Steps:** C95.6, ABC: Exit, Record the sale, sell all 100 at $27.60, choose Stop Triggered, Save exit.
- **Expected:** the receipt shows in the card and the card's figures refresh (T95.40 item 3).
- **Actual:** above the receipt (Closed, Realized P&L −$242.00, −1.21R), the card still shows:
  - header "Done · Exit · Past Stop −$251.00 · −1.26R −$150.00 today"
  - Now box "Worst case $2,750.00 more · 13.75R"
  - XYZ the same way: "−$340.00 · −1.36R", "Worst case $4,680.00 more · 18.72R"

  This lasts until "Back to the Review". A part sale (JKL) does refresh to "Long 60 shares".

**3. Low: after a part sale, the day card's note leaves out what was sold.**
- **Steps:** C95.7, record 40 of ABC's 100 through "I sold: record it".
- **Expected:** the note says how much was sold since, on the day card as well (T95.41 items 2 and 3).
- **Actual:** the card reads "…Sold 40 since. Still holding 60." but the day card reads "Mon Oct 12 you chose Exit on ABC: “Taking the gain.” Still holding 60.". Nothing it says is wrong.

## 4. Minor observations

- On a closed Trade owing both a Close Review and a Position Change Reflection, both buttons are named "Reflect on 2026-10-13 15:00", so a screen reader moving by buttons can't tell them apart. The two items swapped order between otherwise identical runs. This may predate D9.5.
- With the Plan Call `Unknown` and no earlier Mark (JKL acknowledged unavailable on its first Review Date), the form says only "Nothing is chosen for you here.". Nothing names the call, because W120 and W121 cover neither case.
- At 375, the Conviction button "5" wraps to a second row.
- A closed Trade that owes a reason is headed "Close Review · next Review" on Tuesday and "2 reflections due" on Wednesday, never "Say why", although its day line says "To do: Say why, Close Review". The closed card is Part C (T95.58).
- After a part sale recorded on a day with no Marks, Wednesday's card header says "Long 60 shares" while the figures "At the Mon Oct 12 Marks" are for 100 shares ("−$2.00 to Stop (lose −$200.00)", "Worst case $2,100.00 more · 21.00R"). This fits T95.20's "the session before's" figures, but it may read oddly.
- The receipt wording "Recorded. ABC is closed. …" (W135 shortened) and the "Tomorrow" line "Sell JKL, then record the sale." (W119 shortened) match `words-changed.md`, so they are not defects.
- Not covered: a short Position's "Record the buy-back" (T95.40 item 1); no Part B flow names it.
- The "Page crashed" line in my first C95.5 log came from my own abort of a hung script, not from the app.
