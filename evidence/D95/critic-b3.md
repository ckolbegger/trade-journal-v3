# D95 Part B critic-3 report

## 1. Header

- **Date and time:** 2026-11-24, 20:56 to 21:20 EST.
- **Commit:** `38a378eefb7b132cac03dedc2966815a6abc5bb9`, branch `claude-opus-5.5`.
- **Versions:** Node v26.12.0, Playwright 1.63.0, Chromium 153.0.8010.12 (from `browser.version()`), headless.
- **Builds:**
  - I ran `npm run build:all` myself inside `.claude/scripts/with-browser-lock.sh`, and it ended with "build:releases OK".
  - `dist-releases/current`, `dist-releases/d9r2` and `dist-faults` are all dated 20:56. `d9r2` was reused from its cache.
  - `git diff --name-only 7e082c10 HEAD -- src` is empty. The last commit touching `src/` is `1a774a68`.
- **Servers:**
  - Only the suite's release server (`tools/release-server.ts`) on port 5175, started and stopped by the Playwright fixture.
  - Every run was inside the browser lock, through my own config at `test-results/critic-d95-b3/playwright.config.ts`. That config's own output folder is `pw-out/`, so the rest of `test-results/` was not emptied.
  - The server served `dist-releases/current`. For C95.8 it served `dist-releases/d9r2` first, then updated to `current`.
  - Nothing listens on 5175 now.
- **Tracked files:** none edited. `git status --short` is empty.
- **My files:** scratch specs, logs and screenshots are in `/Users/ckolbegger/src/trade-journal-v3/worktrees/claude-opus-5.5/test-results/critic-d95-b3/`, with logs and PNGs in `obs/`.
- **Setup:**
  - The suite helpers did only onboarding, creating Trades, Mark entry, the earlier day's Actions, and the D9 Workspace with its update.
  - I performed every action each flow names myself, by role and label, and judged from the page text and screenshots.
  - Each flow ran in a context launched at 1280 and in one launched at 375 wide; the logs record viewport `{"width":375,"height":900}`.
  - No helper failed. Two runs failed on my own script errors and were re-run: a Close Reason name that doesn't exist, and a sale with its question unanswered. A third failed because my script typed DEF's Mark a second time after it had already been saved with XYZ's; it was re-run too.

## 2. Results

| Flow | Result | Key observations |
|---|---|---|
| C95.5 | PASS | Monday Marks: XYZ $47.00 (past its Stop), ABC $36.50 (at its Target), DEF $41.00 (inside), JKL Missing.<br>**XYZ:** "Past your Stop (XYZ at or below $47.50). The Plan says out." and "Nothing is chosen for you here.", with no radio checked.<br>- Save with nothing chosen gives "Choose an Action." and stores nothing.<br>- Choosing Hold clears that refusal and shows "Holding leaves the Plan. Have a new Stop? Choose Adjust." and "Why? (required)". Save Hold with no reason gives "Say why." and stores nothing.<br>- Choosing Exit clears "Say why." (B1 fix 1 confirmed) and shows "The Plan's exit: sell all 100 shares at the Stop. No reason needed. Record the sale once it is done." It saves with no reason as "Mon Oct 12: Exit · Not done until it is recorded. Tomorrow's Review will ask." with Change and Record the sale.<br>**ABC:** the same, with "At your Target (ABC at or above $36.00)…" and "Have a new Target?".<br>**DEF:** Hold is checked, with "Keep it as it is." and "Save Hold". Exit shows "Exiting now leaves the Plan." and "Why? (required)"; with no reason it gives "Say why.".<br>**JKL:** "No Action until today's Mark is in. Enter it". After "Can't get a price", nothing is chosen. Exit with no reason is refused; Hold with no reason saves.<br>**Leaving the Plan through Change:** Hold with no reason is refused on XYZ and ABC, then saves as "Mon Oct 12: Hold · “Bounce expected off support.”". Exit with no reason is refused on DEF and JKL, then saves with a reason.<br>**Stored:** 4 Action entries, each at version 2. The Trades store is identical before and after. There is no Deviation store.<br>**The day:** "Complete with Unavailable Marks", with "You held XYZ past the Stop. Tomorrow's Review asks again." and "You held ABC past the Target, with no new line."<br>**375:** the same text, apart from the approved shorter captions ("$0.50 past (−$50.00)"). No sideways scroll. |
| C95.6 | PASS | Tuesday, with Exits saved by me, run once from the Review and once from Trade Detail at each width.<br>**ABC, all 100 at $27.60, following the Plan:** "Follows the Plan: all 100 shares, at the Stop. Nothing more to ask." No question is asked.<br>- Saving with no Close Reason gives "Choose a Close Reason." and writes nothing.<br>- Receipt: "Recorded. ABC is closed. Its Close Review is due in the next Review." There is no Now box beside it (B1 fix 2 confirmed).<br>**DEF, before a line, Exit reason saved:** "Leaves the Plan: Neither the Stop nor the Target is reached." and "Your reason, Tue Oct 13: "Earnings tomorrow." Nothing more to ask."<br>- Sold at the default 17:00: "Its Close Review is due in the Review after next." (B2 fix 2 confirmed).<br>- Sold at 14:00: "…in the next Review."<br>**Before a line, no Exit (MNO, from Detail):** asks "Why did you leave the Plan?" with "Say why later". Empty, it gives "Say why you left the Plan, or choose “Say why later”." and writes nothing.<br>**Before a line, Exit saved with no reason (XYZ, from the banner and from Detail):** the same question and refusal. With a reason it saves, leaving only the Close Review Debt. Through "Say why later" it saves with the receipt "Why you left the Plan is owed at the next Review."<br>**XYZ, held past:** "The Stop was reached Mon Oct 12. You held 1 session past it."<br>- "Say why later" at 14:00 gives "…due in the next Review. Why you left the Plan is owed at the next Review." The Debt requires `["PlanDepartureReason"]`.<br>- At the default 17:00 (Detail) both lines say "the Review after next". XYZ is absent on Wednesday and shows "To do: Say why, Close Review" on Thursday.<br>**JKL, part sale of 40:** "Neither the Stop nor the Target is reached." and "The Plan's exit is all 100 shares. This sells 40." It asks "Why did you leave the Plan?" once. Empty is refused; answered, it saves.<br>**Owed group:** closed Trades are under "Trades with owed reflections" as "Close Review · next Review".<br>**Answering:** the owed form has "Why did you leave the Plan?" with aria-required true. Answer with it empty gives "Answer “Why did you leave the Plan?”." and writes nothing. With text, the Debt is Settled and "To do: Say why" leaves the line.<br>**375:** identical text, no sideways scroll. |
| C95.7 | PASS (Defects 1, 2) | Monday: ABC Exit "Taking the gain.".<br>**Banners:** the day card says "Mon Oct 12 you chose Exit on ABC: “Taking the gain.” Still holding 100."; the card says "You chose Exit on Mon Oct 12. Still holding 100.". Each has both buttons, and no other Trade has one.<br>**Still holding** (on the card, and on the day card): both banners go, nothing is written, and the card shows its usual form or "No Action until today's Mark is in. Enter it". After a reload both banners are back.<br>**I sold: record it on the card, 40 shares:** the card then says "You chose Exit on Mon Oct 12. Sold 40 since. Still holding 60.".<br>**The last 60 from the day card:** "Your reason, Mon Oct 12: "Taking the gain." Nothing more to ask."<br>**After a closing sale through either banner** (whole 100 or 40 then 60; with and without Marks; at 14:00, 15:00 or 17:00): beside the receipt there is no banner on the card or day card, and no "You chose Exit and it is not recorded", "Needed" or "Still holding" on the card (B2 fix 1 confirmed for the card). The day card's line is Defect 2.<br>**Refusal** (DEF: Roll, reason, Conviction 4; XYZ pressed): "DEF's note isn't saved." with Save it, Discard it and Back to DEF. Save it has focus and XYZ stays shut.<br>- Back to DEF keeps Roll, the reason and Conviction 4 (focus lands on the Hold radio: known item).<br>- Discard it opens XYZ, resets DEF to Hold, and stores nothing.<br>- Save it on Adjust with no reason shows "Say why.", keeps XYZ shut and focuses the reason. With a reason, Save it stores "Tue Oct 13: Adjust · “Moving the Stop up.”" and opens XYZ.<br>**Half-typed sale (JKL):** refused with "JKL's note isn't saved.".<br>- Back to JKL keeps 40 and focuses Quantity.<br>- Save it shows the form's "Say why you left the Plan, or choose “Say why later”." and writes nothing.<br>- Discard it opens XYZ and keeps JKL's saved Exit.<br>**A typed, unsaved Mark only:** pressing another card opens it, with no refusal (T95.34 item 7). |
| C95.8 | PASS | **D9 Workspace:** one Position Change Reflection owed, on revision 1.<br>**After the update:** the content revision goes from 5 to 6, and revision 2 of Close Review, Daily Trade Review and Position Change Reflection is added. The Debt still names revision 1.<br>**Answering:** done on the Review card and on Trade Detail at each width. The form has no "Why did you leave the Plan?" and no expiration prompt. Answer with nothing filled gives "Answer “Decision mode”.", "Answer “Primary emotion”." and "Answer “Decision confidence”.", and writes nothing. Filled, the answer is saved under revision 1 and the Debt is Settled.<br>**New Action:** Mark $52.00 gives "Inside its lines. The Plan says hold." with Hold checked. Save Hold is stored under Daily Trade Review revision 2, and the day reads "Complete". |

**Also reached, beyond what critics B1 and B2 covered:**
- **"Record the buy-back"** on a short put (MNO):
  - The Exit line reads "The Plan's exit: buy back all 2 contracts at the Stop. No reason needed. Record the buy-back once it is done."
  - The form shows "Buy to close" and "Follows the Plan: all 2 contracts, at the Stop. Nothing more to ask."
  - The receipt reads "Recorded. MNO is closed. Its Close Review is due in the next Review."
  - Same at both widths.
- **T95.40-D1 item 3:** an open Trade owing only a put-off entry reflection (XYZ, entry 16:30 Monday) is listed under "Trades with owed reflections" as "1 not yet due · Open", with no Close Review label.
- **T95.40-D1 item 2** (the moved-to-owed notice) was not reached.

No Part A regression met.

## 3. Overall: PASS

Every Part B flow meets its pass condition at both widths. I found two low defects and no high or moderate ones.

### Defects

**1. Low: a closed Trade's card, beside its receipt, still says "Figures wait for today's Marks. Below: at the Mon Oct 12 Marks.", and nothing follows below.**
- **Steps:** Tuesday 17:00, with no Tuesday Marks entered. On the day card press "I sold: record it" for ABC. Sell 100 at $29.60 (14:00) with Close Reason "Thesis Invalidated", then press Save exit. Seen at 1280 and 375.
- **Expected:** after a closing sale, no open-position figures beside the receipt (T95.40 item 3; B1 fix 2). W94's line is for an open card waiting for its Marks.
- **Actual:** the card shows "Mon Oct 12 you chose Exit: “Taking the gain.”" and then "Figures wait for today's Marks. Below: at the Mon Oct 12 Marks." Below that are only the Plan box and the receipt ("Recorded. ABC is closed…"), with no figures. Screenshot: `obs/c957-day-375-receipt.png`.

**2. Low: beside a closing sale's receipt, the day card still lists the closed Trade as owing an Action and can name it as Next (B2 fix 1 is only partly confirmed).**
- **Steps:** C95.7. Sell ABC's last 60 from the day card's "I sold: record it" after 40 were sold from the card's banner, or sell all 100 from the day card. Seen at 1280 and 375.
- **Expected:** after a closing sale through the Exit banner, no "To do: Action" beside the receipt (the B2 fix as briefed; only the day's counts are left to update on "Back to the Review").
- **Actual:**
  - With Marks entered, the day card beside the receipt reads "Next: ABC", "4 Trades · 4 Actions to go" and "ABC · 30% to Stop · To do: Action".
  - With no Marks entered, it reads "ABC · Marks needed · To do: Mark, Action". The ABC row also stays in the Marks grid.
  - All of it clears after "Back to the Review" (for a sale before the close).
  - When "Next" named another Trade (XYZ), pressing it opened XYZ. I did not press "Next: ABC".

## 4. Minor observations

- **"Day so far" drops a Trade sold before the close.** It moved from −$20.00 to +$100.00 when ABC was sold at a loss at 14:00, once the Review reloaded. This agrees with `specs/design/daily-review.md:19` (only Trades still open at the session's close are part of that day's Review) and with the plan's "over the eligible Trades". Even so, recording a loss makes the day total rise.
- **A sale after the close keeps the Trade in that evening's Review.** A closing sale at the default 17:00, made through the card's banner, leaves Tuesday's Review at "3 Trades · 3 Actions to go" with "Next: ABC · To do: Action". This is the known "Closed after this session's close" item, now also reached from the banner. It matches the same spec line (ABC was still open at Tuesday's close). The banner did not come back on ABC.
- **"Back to the Review" drops a half-typed sale without asking.** The refusal covers pressing another Trade, as T95.40 item 7 asks, but not this button.
- **The Trade-switch refusal stays up after a failed "Save it".** It remains on screen beside the form's own refusal; the Trade pressed stays shut, as specified.
- **Already in `tech-debt.md`, not worse:**
  - Two "Reflect on 2026-10-13 14:00" buttons on a closed Trade.
  - The bare colon in "Mon Oct 12 you chose Exit on XYZ: Still holding 100.".
  - The day card's note with no "Sold 40 since".
  - The closed card header keeping "Long 100 shares @ $30.00" (or "Long 60 shares") and "Stop breached".
  - A part sale at 17:00 leaving "Long 100 shares".
  - "Back to DEF" focusing Hold rather than Roll.
