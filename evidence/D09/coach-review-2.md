# Coach review 2: the Daily Review page

Reviewed 2026-11-21 against the running app (built from this checkout, served on port 5175), at 1280 wide and at 375 wide. All screenshots are in `test-results/coach-review-2/`. In the full-page screenshots the side menu (or the phone's bottom menu) appears part-way down the picture; that comes from the capture, not from the page.

## 1. Score: 6 out of 10

The mechanics of the routine are good: a student can enter a day's Marks and record four Actions in about a minute, the figures are right, agree with each other, and are honest about what is missing. But the page is better at collecting the day's entries than at making the student think. It forgets yesterday's decision, never shows the Plan beside the choice, makes "Hold" one click even on a Trade past its Stop (and even with no Mark for the day), and on an expiration it will book a winning option as a total loss without a word.

## 2. What works

- **Following the status card's links.** One click on "Mark missing for AXIO" opens the right card and panel, scrolls to it and puts the cursor in the empty cell (`s2-desktop-04-cell-chosen.png`).
- **Entering Marks is fast.** Type, Enter, type, Enter, Enter: both Marks are saved, the card moves on to its Action, and after the Action the next card opens with the cursor in its first empty cell. The previous session's Mark sits beside the cell. Missed sessions fill in the same way, newest first, and holidays are left out correctly.
- **Honest figures.** Trade P&L in dollars and R, Current Risk at the Stop and at Worst case, Remaining Reward, and "Reward to risk" now against the Plan's. When a Mark is missing nothing stale is passed off as current; an "At the Fri Nov 13 Marks" block is shown instead. The card, the meter's sentence and the replay agree to the dollar on every Trade I checked.
- **Option Trades** get breakeven, max profit, max loss and "If DALE is at 53.20 at expiration: −$2,016.00".
- **Exit, Roll and Adjust need a reason**, and the refusal is clear: the field turns red, says "Say why you are taking this action." and takes the cursor (`s2-desktop-23-bren-exit-refused.png`).
- **Order of work** inside a card (Marks, Reflections, Settlement, Action) is right, and "Done · Action saved" on a finished card is easy to see.
- **The Close Review questions** ("Would you take this Trade again…", "What worked, and what did not?", "What is the key lesson?") are the right ones, and a reflection not yet due is kept apart from one that is due.
- **Unsaved Marks are protected**: they follow you from card to card, the status card shows "2 unsaved Marks" with its own Save, and leaving the page asks "Leave without saving?".
- **Phone width holds together**: nothing runs off the side, and the Marks grid turns so sessions run down the page.

## 3. Suggestions

**1. Yesterday's decision is forgotten. High.**
- Seen: I chose Exit on BREN on Mon Nov 16 with the reason "sell the last 2". On Tue Nov 17 the card says nothing about it, the 2 contracts are still held, and Hold is preselected again (`s2-desktop-31-next-day-after-exit-decision.png`). On the day itself the header only says "Done · Action saved", not which Action (`s2-desktop-24-after-bren-exit.png`), and the card has no link to the Trade or to recording the exit (`s2-desktop-30-done-card-reopened.png`).
- Trades: all (seen on BREN). Review: work to do, and the day after. Width: desktop and phone.
- Change: show the last session's Action and its reason at the top of the card and beside the Action form. When that Action was Exit, Roll or Adjust and the position has not changed, say so ("You chose Exit on Mon Nov 16. Still holding 2.") and ask why. Name the Action in the header ("Done · Exit"). After saving Exit, Roll or Adjust, offer the link to record it.

**2. Hold is one click on a Trade past its Stop, and an Action can be saved with no Mark for the day. High.**
- Seen: AXIO is past its Stop by $300.00 (0.50R) and DALE by $552.00, yet Hold is preselected with its reason "(optional)" (`s1-desktop-02-AXIO-action.png`, `s1-desktop-05-DALE-action.png`). With Monday's Mark still missing I followed "Action missing for AXIO", pressed Save, and Hold was recorded against Friday's price (`s2-desktop-21-axio-hold-no-mark.png`). When I then entered the Mark the card went straight to "Done".
- Trades: AXIO, DALE (any Trade past a line); all for the missing Mark. Review: finished day, work to do. Width: desktop and phone.
- Change: when a Trade is past its Stop or its Target, preselect nothing and require the reason for Hold too. Don't accept an Action until the Review Date's Marks are saved or marked "Can't get a price". The design's rule that Hold is preselected and needs no reason is fine for a Trade inside its lines; on these Trades the rule itself hurts the student.

**3. "Record expiration" books an in-the-money option as worthless without warning. High.**
- Seen: CORV's $80 put with CORV at 73.00 and the put Marked at $7.00. The card says "If CORV is at 73.00 at expiration: +$1,467.00", but the Settlement panel never says the put finished in the money, its only button is "Record expiration" (`s4-desktop-09-corv-settlement.png`), the form asks nothing about it (`s4-desktop-10-corv-expiration-form.png`), and the result is Realized P&L −$633.00, −1.99R (`s4-desktop-11-corv-expiration-recorded.png`). The only hint is "If it was exercised, this release can't record the exercise yet, so this Review stays incomplete until a later release can". Also, an Action (Hold, Exit, Roll or Adjust) is still demanded for a contract that has expired.
- Trades: CORV (in the money), DALE (the same panel with no guard; `s4-desktop-03-settlement-link.png`). Review: expiration. Width: desktop and phone (`s4-phone-02-settlement.png`).
- Change: from the saved Marks, say where it finished: "CORV 73.00, strike $80: $7.00 in the money" or "DALE 62.10, above the $57.50 strike: expired worthless, you keep $564.00". When it is in the money, warn and don't make "Record expiration" the main button. Drop the Action for an expired contract. A limit that hurts: assignment and exercise can't be recorded, so a student who sells puts will have Reviews that can never be completed. Give a way to mark "assigned, to record later" so the day can still be finished.

**4. The choice is made with the numbers off screen, and the Plan is never shown. High.**
- Seen: after "Save Marks" the page jumps to the Action form; the new P&L and risk figures are above the top of the screen (`s2-desktop-10-bren-after-marks.png`, `s2-phone-06-after-save.png`). The card shows the Stop and Target prices only inside "Conditions". It does not show the planned entry, the thesis and invalidation ("Breakout." / "Below 47."), how much of the planned size is still held (AXIO 100 of 200, BREN 2 of 4), realized against open P&L, the change since the session before, or days to the expiration. The Trade Detail shows several of these (`s1-desktop-22-detail-AXIO.png`); the replay has the best sentence of all ("From here: $672.00 at risk back to the Stop … Even at the Stop this Trade would end $316.00 ahead", `s2-desktop-22-bren-replay.png`).
- Trades: all. Review: finished day, work to do. Width: desktop and phone.
- Change: put a short "Plan and now" block directly above the Action choices: the Plan's entry, Stop, Target, thesis and invalidation; then the Mark, Trade P&L with the change since the session before, realized and open, held of planned, days to the expiration, and the replay's "From here" sentence. After saving Marks, scroll so this block is at the top.

**5. A slip in a Mark is saved without question and is slow to fix. High.**
- Seen: 440 typed for 44.00 was saved; AXIO went from "Stop breached" to "+$38,560.00 · +64.27R, Target reached" (`s2-desktop-15-axio-440.png`, `s2-desktop-16-axio-440-saved.png`). Fixing it takes: press the cell, "Correct", retype the price (the field starts empty), type a required reason, "Save correction" (`s2-desktop-18-axio-correcting.png`). "abc" is counted as an unsaved Mark and only refused on Save (`s2-desktop-13-axio-abc.png`).
- Trades: all (seen on AXIO). Review: work to do. Width: desktop and phone.
- Change: show the change from the previous Mark as the student types ("−2.4%"). Ask "44.00 or 440.00?" when a Mark is far from the previous one. Check the entry when the cursor leaves the cell. Let a Mark saved in this same Review be fixed in place with no reason.

**6. Before the Marks are in, the card is a wall of "Mark missing" and the grid is far down. Medium.**
- Seen: "Mark missing: BREN Nov 20 $100 Call, Mon Nov 16" appears nine times in one card, and the Marks grid starts about 1,180 px down on a 900 px screen (`s2-desktop-02-first-full.png`); on the phone it starts about 2,140 px down, more than two screens (`s2-phone-02-first-full.png`). All four cards read "Evidence limited", so the order says nothing about which Trade needs attention: BREN, the winner, opens first while AXIO and DALE were past their Stops on Friday.
- Trades: all. Review: work to do, expiration. Width: desktop and phone.
- Change: while Marks are needed, put the Marks grid first in the card, and replace the repeated lines with one ("Figures wait for today's Marks") above the "At the Fri Nov 13 Marks" block. Better still, offer one grid for every Instrument's Mark for the day, so the student copies prices from the broker in one pass and then walks the Trades in a true attention order. Until then, order the cards by the last session's standing.

**7. The status card lists; it does not sum up, and "Complete" is quiet. Medium.**
- Seen: 11 near-identical lines fill the top of the screen (`s2-desktop-01-first-view.png`) and the whole first screen on the phone (`s2-phone-01-first-view.png`), in a different order from the cards. A finished day shows only the word "Complete" and, below the list, "Every Trade has an Action." (`s2-desktop-28-day-complete.png`, `s1-phone-21-complete.png`). Three skipped Reviews are not mentioned at all (`s2late-desktop-01-first-full.png`).
- Trades: all. Review: work to do, finished day. Width: desktop and phone.
- Change: lead with a count ("4 Trades · 7 Marks and 4 Actions to go"), then one line per Trade in card order. When complete, show the day: P&L change, which Trades are past a Stop or Target, the Actions chosen ("Exit BREN, Hold 3") and what to do tomorrow. Say plainly "No Review for Mon Nov 16, Tue Nov 17, Wed Nov 18".

**8. The closed card shows a system word instead of the state, and no numbers. Medium.**
- Seen: "Boundary reached" in the same grey badge for a Trade past its Stop and one past its Target (`s1-desktop-01-all-closed.png`); "Quantified pressure" (`s6-desktop-03-mid-trade-closed.png`), "Evidence limited", "Blocker" (`s4-desktop-02-first-full.png`). What remains is a bare "Action". No P&L is shown until the card is opened. Inside the card the plain words already exist: "Stop breached", "63% of the way from entry to the Stop".
- Trades: all. Review: all four. Width: desktop and phone.
- Change: use the plain words with colour and a sign: "Past Stop" in red, "At Target" in green, "63% to Stop" in amber, "Marks needed", "Expired: settle". Show Trade P&L, R and the day's change in the header. Write "To do: Action".

**9. The meter can't be read without help. Medium.**
- Seen: about 130 px wide on desktop with up to nine marks (square or round pointer, solid, pale and hatched bars, three ticks, a dot for the session before); the only key is "Stop ◂ ▸ Target" (`s1-desktop-21-meters-zoomed.png`). Its excellent sentence ("P&L −$1,040.00, past the Stop by $300.00. Realized −$440.00. … Down from −$930.00 on Fri Nov 13.") shows only on mouse hover, so never on a phone (`s1-phone-01-all-closed.png`).
- Trades: all. Review: all four. Width: desktop and phone.
- Change: print that sentence in the opened card, add a small key (banked, open, past the line, session before), and let a tap show the sentence on a phone.

**10. The Replay button is in the right place but gives no reason to press it. Medium.**
- Seen: it sits directly above the Action choices, which is where it belongs, and it opens and closes well (Escape returns to the button). But it is a bare word styled like a minor form button (`s1-desktop-02-AXIO-action.png`), it is hidden whenever another panel is open, and it is missing from the "Trades with owed reflections" card, where the Close Review needs it most (`s3-desktop-03-owed-card-open.png`). I expect a student to press it once and then skip it.
- Trades: all; BREN for the owed card. Review: finished day, work to do, owed reflection. Width: desktop and phone.
- Change: pair it with one line taken from the replay ("Past the Stop since Mon Nov 9 · see how it got here"), keep it visible in the open card whatever panel is open, and add it to the owed-reflection card.

**11. Owed reflection: declining is as easy as answering, and the form does not tell the Trade's story. Medium.**
- Seen: "Decline" sits beside "Answer" and ends the reflection in one click with no reason and no question; "Reason for declining (optional)" looks like a fourth question (`s3-desktop-06-reflect-form.png`, `s3-phone-02-reflect-form.png`). The button reads "Reflect on 2026-11-13 10:00" and times are raw ("Position Change at 2026-11-13 10:00") where the rest of the page says "Fri Nov 13". The card uses "Lifecycle" and "Terminal Disposition", and shows only the last sale, not the Plan or the earlier sale (`s3-desktop-03-owed-card-open.png`).
- Trades: BREN (closed). Review: owed reflection. Width: desktop and phone.
- Change: name the button "Write the Close Review". Move Decline away from Answer and show its reason field only after Decline is chosen. Show Plan against result (planned 4 at $1.61, Stop $0.80, Target $4.00; sold 2 at $4.00 and 2 at $4.91; +$1,138.00, +3.51R). Use the page's date style and a trader's words ("How it ended: sold all 4 contracts").

**12. The Review and the Trade Detail describe the same thing differently. Medium.**
- Seen: Review "Stop at or below $47.00: Breached, $300.00 beyond" (P&L dollars) against Detail "Breached · $3.00 past" (price); Review "Target …: Active" against Detail "$12.00 away" (`s1-desktop-03-AXIO-marks.png`, `s1-desktop-22-detail-AXIO.png`). The Underlying's price has no dollar sign on option Trades ("Stop on DALE at or below 54.00", "53.20") but has one for AXIO ("$44.00"). Detail shows "$988.00" with no plus sign where the Review shows "+$988.00" (`s1-desktop-22-detail-BREN.png`). "Reward to risk 7.18 to 1 · about 12% : 88%" does not say what the percentages are (`s6-desktop-02-mid-trade-card.png`).
- Trades: all. Review: finished day. Width: desktop and phone.
- Change: one wording in both places, giving both measures ("$3.00 below the Stop · $300.00 past it"); a dollar sign on every price; a sign on every P&L; label the percentages ("needs to work about 12% of the time to break even").

**13. Keyboard and focus: three rough spots. Medium.**
- Seen: (a) focus falls to the page body after the day's last Action and after saving a Mark on a Trade whose Action is already saved (`s2-desktop-28-day-complete.png`, `s2-desktop-25-axio-after-mark.png`). (b) Tab stops on "Can't get a price" or "Correct" after every cell, so BREN Mark to Call Mark is four Tabs; Enter is the only quick key and nothing says so (`s2-desktop-06-two-marks-typed.png`). (c) With a typed Action note, pressing another card's header does nothing visible: the message "Save or discard what you entered for AXIO … to leave it." appears at the top of the card, off screen, and the Action form has no Discard (`s1-desktop-20-unsaved-action-hold.png`). Leaving by the main menu drops the same note with no question, although unsaved Marks do ask.
- Trades: all. Review: finished day, work to do. Width: desktop.
- Change: after a save, put focus on the next thing to do (the next card's header, or the status card when the day is complete). Keep Tab on the cells and reach the cell's buttons another way. Show the refusal where the student pressed, add Discard to the Action form, and ask before leaving with an unsaved note.

**14. Marks grid: small things. Low.**
- Seen: the cell's box repeats itself ("… · Missing" then "Missing"; "$440.00 · Manual" then "Current price $440.00") and says "0 means it closed with no value" even for a stock, using "closed" about a price (`s2-desktop-04-cell-chosen.png`). "Save Marks (2)" inside AXIO's card saved BREN's two Marks and then moved AXIO on to its Action with its own Mark still missing (`s2-desktop-07-refused-leave.png`, `s2-desktop-08-after-save-marks.png`). With many missed sessions the header says "31 earlier optional", the pager says "Sessions 1 to 20 of 30", 22 are on screen, and desktop needs sideways scrolling as well as "Next page" (`s2far-desktop-01-axio-marks.png`, `s2far-phone-01-axio-marks.png`). Enter from the last Review Date cell goes to an old optional cell before Save (CORV, Tue Nov 10; `s2-desktop-27-corv-marks.png`).
- Trades: all; CORV for the optional cell. Review: work to do. Width: desktop and phone.
- Change: one line per fact in the cell's box, and "0 means it was worth nothing" only for options. After a save, keep the card on Marks while its own Mark is missing. One count of sessions. Enter after the last Review Date cell goes to Save.

**15. Phone layout and form details. Low.**
- Seen: figures break in the middle: "If DALE is at 53.20 at expiration: –" with "$2,016.00" on the next line, and "−$2,088.00 ·" above "−1.36R" (`s1-phone-06-DALE-marks.png`). With two Instruments the grid's heading breaks as "Sessio" / "n" and each date takes three lines (`s2-phone-03-after-link.png`). "Conviction now" offers 1 to 5 with no words for either end. After "Expiration recorded", the main button is "Back to the Trade", not "Back to the Review" (`s4-desktop-07-after-save-expiration.png`).
- Trades: all; DALE and BREN for the breaks. Review: finished day, work to do, expiration. Width: phone (the last two also desktop).
- Change: never break inside a figure; on a phone put the value under its label. Shorten the heading to "Date". Label the scale ("1 low · 5 high"). When the student came from the Review, lead back to the Review.

## 4. What I could not check

- **A real phone.** The 375-wide runs were in a desktop browser; I saw no on-screen keyboard and did not test touch scrolling. The cells do ask for the number keypad.
- **Arrow keys and Escape in the Marks grid.** That step of my script failed after an earlier save; only Tab and Enter were checked.
- **A screen reader.** I checked where focus lands and which messages are announced, not what is spoken.
- **Marks fetched from a price provider**, and the "Complete with Unavailable Marks" state. Every Mark was typed; I opened "Can't get a price" but did not save it.
- **Reflections owed on an open Trade.** The helpers answer the partial-sale reflection when they record the sale, so every open card read "None owed". The only owed reflection I saw was the closed BREN's Close Review.
- **Assignment and exercise**, which the app says it cannot record yet.
- **Whether unsaved Marks survive a reload.** The "Leave without saving?" question stopped the reload in my script.
- **Helpers.** All four Reviews were built. `buildReview` records partial sales only, so it cannot build `BREN_SOLD_OUT`; I used `buildOn` from `e2e/d9/support.ts` for the owed-reflection Review, and for the expiration Review (with no Position Change recorded, so the settlement was still due; I added CORV beside DALE). Beyond the four, I also opened the work-to-do profile at Thu Nov 19, Fri Dec 4 and Thu Dec 31 (missed sessions), the day after a saved Exit (Tue Nov 17), and a Review at Fri Nov 6 with every Trade between its Stop and Target. No helper and no tracked file was changed.
