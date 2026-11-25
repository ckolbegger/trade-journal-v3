# D95 Part B critic-2 report

## 1. Header

- **Date and time:** 2026-11-24, 20:03 to 20:25 EST.
- **Commit:** `504d6536249911ca3a39dc4e9988af3fcc03c6f1`, branch `claude-opus-5.5`.
- **Versions:** Node v26.12.0, Playwright 1.63.0, Chromium 153.0.8010.12 (read from `browser.version()` in my own run), headless.
- **Builds:** I ran `npm run build:faults && npm run build:releases` myself inside `.claude/scripts/with-browser-lock.sh`, and it succeeded (exit 0, 20:04). `current` was rebuilt and `d9r2` was reused from its cache.
- **Servers:** only the suite's release server (`tools/release-server.ts`) on port 5175, started and stopped by the Playwright fixture. Every run was wrapped in the browser lock. It served `dist-releases/current`; for C95.8 it served `dist-releases/d9r2` first, then updated to `current`. Afterwards nothing listens on 5175.
- **Tracked files:** none edited. `git status --short` is empty.
- **One side effect to disclose:** my first Playwright call resolved to the root config, which emptied `test-results/`. That deleted the git-ignored artifact folders from earlier suite runs. No tracked file was touched.
- **Where my files are:** scratch specs and logs are in `/Users/ckolbegger/src/trade-journal-v3/worktrees/claude-opus-5.5/test-results/critic-d95-b2/`, with logs and PNGs in `obs/`.
- **Setup:** I used the suite helpers only to reach starting states: onboarding, creating Trades, Monday's Marks and Actions, the Mark entries, the D9 Workspace and the update. I performed every action a flow names myself, by role and label, and judged each screen from its text and screenshots. Each flow ran in a context launched at 1280 and in one launched at 375 wide. No helper failed.

## 2. Results

| Flow | Result | Key observations |
|---|---|---|
| C95.5 | PASS | Marks: XYZ $47.00 (past its Stop), ABC $36.50 (at its Target), DEF $41.00 (inside), JKL none.<br>**XYZ:** "Past your Stop (XYZ at or below $47.50). The Plan says out." and "Nothing is chosen for you here.", with no radio checked. Save with nothing chosen gives "Choose an Action." and stores nothing. Choosing Hold clears "Choose an Action." and shows "Holding leaves the Plan. Have a new Stop? Choose Adjust." and "Why? (required)". Save Hold with no reason gives "Say why." and stores nothing. Choosing Exit clears "Say why." (B1 fix 1 confirmed) and shows "The Plan's exit: sell all 100 shares at the Stop. No reason needed. Record the sale once it is done." It saves with no reason as "Mon Oct 12: Exit", "Not done until it is recorded. Tomorrow's Review will ask.", with Change and Record the sale.<br>**ABC:** the same, with "At your Target (ABC at or above $36.00)…" and "Have a new Target?".<br>**DEF:** Hold is checked, with "Keep it as it is." and "Save Hold". Exit gives "Exiting now leaves the Plan." and "Why? (required)"; with no reason it gives "Say why.". Going back to Hold clears it.<br>**JKL:** "No Action until today's Mark is in. Enter it". After the Mark is acknowledged unavailable, nothing is chosen; Exit with no reason is refused and Hold with no reason saves.<br>**Leaving the Plan through Change:** Hold with no reason is refused on XYZ and ABC, then saves as "Mon Oct 12: Hold · “Bounce expected off support.”". Exit with no reason is refused on DEF and JKL, then saves with a reason.<br>**Stored:** 4 Action entries; each change is version 2 of the same entry. The Trades store is identical before and after. There is no Deviation store.<br>**The day:** "Complete with Unavailable Marks", with "You held XYZ past the Stop. Tomorrow's Review asks again." The same text at 375, with no sideways scroll. |
| C95.6 | PASS (sales typed at Tue 14:00; Defect 2 concerns the form's default time) | Tuesday, with Exits saved, from the Review and then from Trade Detail.<br>**Following the Plan (ABC, 100 at $27.60):** "Follows the Plan: all 100 shares, at the Stop. Nothing more to ask." No question and no Close Review choice. Saving without a Close Reason gives "Choose a Close Reason." and writes nothing. Receipt: "Recorded. ABC is closed. Its Close Review is due in the next Review." Only a Close Review Debt is left. The card header becomes "ABC Long 100 shares @ $30.00 Done · Exit", with no P&L, day change, badge or Now box (B1 fix 2 confirmed on this route).<br>**Before a line, Exit reason saved (DEF):** "Neither the Stop nor the Target is reached." and "Your reason, Tue Oct 13: "Earnings tomorrow." Nothing more to ask."<br>**Before a line, no Exit (DEF, Trade Detail):** asks "Why did you leave the Plan?" with "Say why later". Empty, the save gives "Say why you left the Plan, or choose “Say why later”." and writes nothing.<br>**Held past (XYZ):** "The Stop was reached Mon Oct 12. You held 1 session past it." I pressed "Say why later". The receipt adds "Why you left the Plan is owed at the next Review." The Debt requires `["PlanDepartureReason"]`.<br>**Part sales:** 40 JKL inside its lines asks "Why did you leave the Plan?" once. The header refreshes to "Long 60 shares", with "Realized, open +$58.60 · +$89.40". 40 ABC at the Stop shows only "The Plan's exit is all 100 shares. This sells 40." and asks "Why only part?".<br>**Owed group:** closed Trades are under "Trades with owed reflections" as "Close Review · next Review".<br>**Wednesday:** XYZ's line reads "To do: Say why, Close Review". The owed form has "Why did you leave the Plan?" with aria-required true. Answer with it empty gives "Answer “Why did you leave the Plan?”." and the reflection stays owed. With text, the Debt is Settled and the card shows "Why did you leave the Plan? Hoped for the bounce.".<br>Trade Detail gives the same outcomes. The forms are one column at 375; the Lot Matches table scrolls inside its own box. |
| C95.7 | PASS (Defects 1 and 3) | Monday's Exit on ABC with "Taking the gain.".<br>**Day card:** "Mon Oct 12 you chose Exit on ABC: “Taking the gain.” Still holding 100." **Card:** "You chose Exit on Mon Oct 12. Still holding 100." Each has both buttons; no other Trade has a banner.<br>**Still holding** (card, then day card): both banners go and nothing is stored. After a reload both are back.<br>**I sold: record it on the card (40):** the card then reads "Sold 40 since. Still holding 60.".<br>**I sold: record it on the day card (last 60):** "The Plan's exit: all 60 shares…" and "Your reason, Mon Oct 12: "Taking the gain." Nothing more to ask."<br>**Refusal (DEF Roll with a reason and Conviction 4, XYZ pressed):** "DEF's note isn't saved." with Save it, Discard it and Back to DEF; Save it has focus and XYZ stays shut.<br>- Back to DEF keeps Roll, the reason and the Conviction.<br>- Discard it opens XYZ, resets DEF to Hold with an empty reason, and stores nothing.<br>- Save it on Adjust with no reason shows the form's own "Say why.", keeps XYZ shut and moves focus to the reason field.<br>- Save it with a reason stores one Roll and opens XYZ.<br>A half-typed sale is refused the same way ("JKL's note isn't saved."). Discard it opens XYZ and keeps JKL's saved Exit. |
| C95.8 | PASS | D9 Workspace: one Position Change Reflection owed, on revision 1. After the update, the content revision goes from 5 to 6, revision 2 of Close Review, Daily Trade Review and Position Change Reflection is added, and the Debt still names revision 1.<br>On the Review card the owed form has no "Why did you leave the Plan?" and no expiration prompt. Answer with nothing filled gives "Answer “Decision mode”." and the two others like it. Filled, it saves under revision 1 and the card shows "None owed".<br>Mark $52.00 gives "Inside its lines. The Plan says hold." with Hold checked. Save Hold is stored under Daily Trade Review revision 2. The day reaches "Complete". Same at 375. |

No Part A regression met.

## 3. Overall: PASS

Every Part B flow meets its pass condition at both widths. There are two moderate defects and one low.

### Defects

**1. Moderate: after a closing sale recorded through the Exit banner, the card and the day card still say the Trade is held and offer to record another sale.**
- **Steps:** C95.7, Tuesday. On ABC's card press "I sold: record it" and sell 40. Then press the day card's "I sold: record it", sell the last 60 with a Close Reason, and Save exit. Seen at 1280 and 375, with and without Tuesday's Marks entered.
- **Expected:**
  - T95.40 item 3: show the receipt in the card and refresh the card's figures.
  - T95.41 item 1 (W129): the banner says what is still held.
  - This is the same class of problem as critic B1's defect 2, whose fix only covers the "Record the sale" route.
- **Actual:** beside "Recorded. ABC is closed. Its Close Review is due in the next Review." the screen still shows:
  - the card header "ABC Long 60 shares @ $30.00 To do: Action" (or "To do: Mark, Action" with no Marks);
  - the banner "You chose Exit on Mon Oct 12. Sold 40 since. Still holding 60." with "I sold: record it" and "Still holding";
  - "You chose Exit and it is not recorded" and "Action Hold, Exit, Roll or Adjust · Needed";
  - on the day card, "4 Trades · 4 Actions to go" with ABC "To do: Action" and "…Still holding 60. I sold: record it Still holding".

  Pressing either button again writes nothing (all stores are byte-identical). Everything clears after "Back to the Review" ("3 Trades · 3 Actions to go"). Screenshots: `obs/c95x-banner-375-nomarks-01-closed-receipt.png` and `obs/c957-banner-375-06-after-60.png`.

**2. Moderate: the receipt promises the reason "at the next Review" when the sale's default time puts it two Reviews away.**
- **Steps:** C95.6 at Tuesday 17:00. On XYZ, save an Exit, press "Record the sale", and leave Economic Time at its default "2026-10-13T17:00" (after the close). Sell 100 at $46.50 with a Close Reason and press "Say why later". Then open Wednesday's and Thursday's Reviews.
- **Expected:** the receipt states when the reason is owed (T95.40 item 4, W155). The glossary's "Due Classification" (`specs/glossary.md:110`) puts a Debt anchored after Tuesday's close in "the Review after next".
- **Actual:**
  - Tuesday's receipt says "Why you left the Plan is owed at the next Review." and "Its Close Review is due in the next Review."
  - On Wednesday XYZ is not in the day's lines, and its card says "2 owed, 0 due now · Not due · Tue Oct 13 · Due in the next Review".
  - The reason is first asked on Thursday ("To do: Say why, Close Review").
  - Tuesday and Wednesday were seen at both widths; Thursday at 1280 only.

  The sale form opened from the Review defaults to now, which is after the close, so this is the usual evening path. With a typed 14:00 time the promise holds.

**3. Low: when the Exit was saved with no reason, the day card's note ends in a bare colon.**
- **Steps:** Save an Exit with no reason on ABC (the Plan says out), sell part, and open the next day's Review.
- **Expected:** the note reads cleanly (W129).
- **Actual:** "Tue Oct 13 you chose Exit on ABC: Still holding 60." The colon introduces nothing.

## 4. Minor observations

- With the default 17:00 time, a sale from Trade Detail leaves the Trade on that evening's Review as "Closed after this session's close · Closed". It still shows "To do: Action", an Action form and 100-share figures. A part sale at 17:00 leaves the card on "Long 100 shares" until the next day. This is consistent with the Marks being taken at the close, and the wording appears to predate D9.5.
- When the Exit and the part sale happen on the same day, the next day's banner says "You chose Exit on Tue Oct 13. Still holding 60." with no "Sold 40 since". It is accurate, but it differs from the case where the Exit came the day before.
- A closed Trade's card header keeps "Long 100 shares @ $30.00" beside "Done · Exit" after the receipt (route covered by B1 fix 2). Its body still shows "Stop breached".
- Defect 1 also covers the after-close case: "Still holding" on the day card after the close writes nothing.
- Already in `tech-debt.md` and not worse: the day card note without "Sold 40 since", and the two identical "Reflect on 2026-10-13 14:00" buttons.
- Not covered:
  - T95.40-D1 items 2 and 3 (the moved-to-owed notice, and an open Trade owing only a reflection under the owed heading). No flow led there: an open Trade owing a reason stayed in the main list with "To do: Mark, Say why, Action".
  - "Save it" and "Back to JKL" on a half-typed sale (only "Discard it" was run).
  - A short Position's "Record the buy-back".
