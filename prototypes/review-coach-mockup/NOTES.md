# Review coach mockup: notes

A clickable picture of a Daily Review page that teaches, built from `evidence/D09/coach-review-2.md` (score 6 of 10, 15 suggestions). Open `index.html` in a browser. It is one file with made-up data: no app code, no server, no network. Desktop only (about 1280 wide).

The dark bar at the top is not part of the design. It switches between seven made-up days, and "Coach numbers" turns the small blue numbers on and off. Each number marks where that suggestion lands on the page.

| Day in the bar | Review Date | What it shows |
|---|---|---|
| Work to do | Mon Nov 16 | Nothing entered. AXIO and DALE past their Stops, BREN and CORV at their Targets. |
| Day after an Exit | Tue Nov 17 | Monday's Exit on BREN was never carried out. |
| Expiration day | Fri Nov 20 | CORV's put finishes in the money; DALE's put expires worthless. Two Reviews were skipped. |
| Owed Close Review | Mon Nov 16 | BREN was sold out on Friday; its Close Review is due. |
| Finished day | Mon Nov 16 | Every Action saved: the day's summary. |
| Quiet day | Thu Nov 5 | Every Trade between its Stop and Target. |
| Stop hit today | Thu Nov 5 | The same day, but AXIO's Mark falls under its Stop for the first time: an exit that follows the Plan. |

## The shape of the page

The day is three steps, shown as "1 Marks", "2 Trades", "3 The day" on the top card.

1. **Marks.** One grid for every Instrument, so the student copies prices from the broker in one pass.
2. **Trades.** One card per Trade, most pressing first. Each open card reads top to bottom as: what you decided last session, the Plan, where it stands now, the meter with its sentence, the Replay strip, then the Action with your last decisions beside it.
3. **The day.** When the last Action is saved, the top card turns into the day's summary.

A minimal **Settings** page, reached from the app's menu, holds the one setting the Review needs: how far a Mark must move before it is questioned.

## (a) The 15 suggestions

**1. Yesterday's decision is forgotten.** The first line of every open card is the last session's Action and its reason ("Fri Nov 13 you chose Hold: 'Up today. One more day.'"). Beside the Action form, "Your last decisions" lists the last four with the Trade P&L on each day, and counts a streak ("Held past the Stop 5 sessions running."). When the last Action was Exit, Roll or Adjust and the position has not changed, the top card and the Trade's card both say "You chose Exit on Mon Nov 16. Still holding 2." and offer "I sold: record it" or "Still holding"; "Still holding" then asks why, with nothing preselected. Selling part of it does not end the question: after selling 1 of 2 the card says "You chose Exit on Mon Nov 16. Sold 1 since. Still holding 1." and keeps asking until nothing is held. A finished card's header names the Action ("Done · Exit"). After saving Exit, the card offers "Record the sale" and says "Not done until it is recorded. Tomorrow's Review will ask."

**2. Hold is one click past the Stop; an Action with no Mark.** Past the Stop or the Target, nothing is preselected ("Nothing is chosen for you here."), the card says "The Plan says out.", and Hold must answer "Why leave the Plan?". An Exit there is the Plan's own exit and needs no reason, unless the Trade was already held past the line in an earlier Review; then it asks "Why did you leave the Plan?". Inside the lines the card says "The Plan says hold." and an Exit must answer "Why leave the Plan?". Inside the lines Hold stays preselected with an optional reason, so a quiet day is still one click a Trade. Until the Review Date's Marks are saved, or marked "Can't get a price", the card shows "No Action until today's Marks are in" in place of the form.

**3. Expiration books an in-the-money option as worthless.** An expired contract has no Action; its card says "Expired Fri Nov 20 · no Action needed" and then where it finished, from the saved Marks: "CORV $73.00, strike $80.00: $7.00 in the money" with what that is worth, or "DALE $62.10, above the $57.50 strike: expired worthless. You keep $564.00." In the money, the main button is "Exercised: record later" (or "Assigned: record later" for a sold option), next is "Sold before the close", and "It expired worthless" is a quiet link that asks for a reason. "Record later" only lets this one Review finish: the card says "Today's Review can finish. The next Review asks again.", the header reads "Settle later", and the day's summary lists the expiration under "Tomorrow" as still to settle. The next Review shows the Trade exactly as if the button had never been pressed. To see the assigned path: Expiration day, type 52.00 for DALE and 5.50 for its put (the helper button "DALE finishes at $52.00 (assigned)" does it).

**4. The numbers are off screen and the Plan is never shown.** "Plan" (entry, Stop, Target, thesis, "No longer valid if", risk and reward) and "Now" (Marks with their change, Trade P&L with the change since the session before, realized and open, held of planned, distance to each line, sessions to the expiration and what it would be worth then) sit side by side above the Action. Under them the meter, its sentence, and the "From here" sentence. After "Save Marks" the page scrolls so the first Trade's header is at the top and the Save button is still on a 900-tall screen.

**5. A slip in a Mark.** The change from the previous Mark shows as the student types ("−$1.10 (−2.4%)"). On leaving the cell the entry is checked: "abc" says "Not a price"; a price far from the last one is questioned ("$44.00 or $440.00?" with a button for each; for other far prices "+8.6% from $45.10. Right?"). How far is "far" is the trader's own setting, kept on the Settings page in the app's menu. Under the grid one line states the current limits ("Asks before saving a Mark that moved more than 5% (stock), or 100% up or 50% down (option), since the last Mark") with a link to Settings. In the mockup the setting is kept across all seven days. A Mark saved in this same Review is fixed in place from "Edit", with no reason.

**6. A wall of "Mark missing"; the grid far down.** The grid is the first thing on the page and holds every Instrument once. Before the Marks are in, a card says one line, "Figures wait for today's Marks. Below: at the Fri Nov 13 Marks." The Trades are in attention order from the last session's standing, and are sorted again once when the Marks are saved: a decision not carried out, an expired contract, past the Stop (deepest in R first), at the Target, then inside the lines by how far along.

**7. The status card lists but does not sum up.** The top card leads with a count ("4 Trades · 7 Marks and 4 Actions to go"), one button for the next thing to do, and one line per Trade in card order. When the day is complete it shows the day: P&L change, which Trades are past a line and for how many sessions, the Actions chosen ("Exit AXIO · Hold CORV"), what to do tomorrow, and the next Review Date. Skipped Reviews are stated: "No Review for Wed Nov 18, Thu Nov 19."

**8. System words on the closed card, and no numbers.** Header chips use plain words and colour: "Past Stop" red, "At Target" green, "63% to Stop" amber from half way, "Marks needed", "Expired: settle", "No price today". The header shows Trade P&L, R and the day's change, a small meter, and "To do: Mark, Action".

**9. The meter can't be read.** In the open card the meter is wide, has its Stop and Target labelled in dollars, a key (banked, open, past the line, session before, now, Stop, Target), and its sentence is printed under it. Nothing depends on hover.

**10. Replay gives no reason to press it.** See part (c). In short: its own strip in every open card with a small picture of the Trade's path and one line from the Replay ("Past the Stop since Mon Nov 9 · 6 sessions. See how it got here."); always visible; and on the closed Trade's card, where the Close Review is written inside it.

**11. Owed reflection.** The closed card says "How it ended: sold all 4 contracts", shows Plan against what happened (planned 4 at $1.61, Stop $0.80, Target $4.00; sold 2 at $4.00 and 2 at $4.91; +$1,138.00, +3.51R), and its button is "Write the Close Review". The Close Review has three fields: "Would you take this Trade again under similar conditions?" (required), "What worked, and what did not?" (optional) and "What is the key lesson?" (required). "Decline…" is a small link at the far side; its reason field shows only after pressing it. Dates use the page's style ("Fri Nov 13").

**12. Review and Trade Detail differ.** Every line gives both measures in one wording: "AXIO $3.00 below the Stop · $300.00 past it". Every price has a dollar sign, every P&L a sign, and the percentage is labelled ("It needs to work about 18% of the time to break even"). The figures the current card has that the new blocks do not (worst case, reward to risk now against the Plan's, breakeven, max profit and loss) are kept behind "More figures". The Trade Detail is not in the mockup; it would take the same wording.

**13. Keyboard and focus.** After every save, focus goes to the next thing to do: the next card's header, or the top card when the day is complete. Tab moves between Mark cells only; a cell's "Can't get a price" is reached with the N key (or the mouse), arrows move up and down, and a line above the grid says so. Pressing another card with a half-typed Action shows the refusal on the header that was pressed, with "Save it", "Discard it" and "Back to AXIO". The Action form has Discard. The side menu asks before leaving with unsaved Marks or an unsaved note.

**14. Marks grid, small things.** One line per fact beside each cell. "Worth nothing?" is asked only for an option typed as 0; a share price of 0 is refused. Saving some Marks keeps the grid open and the Trades without Marks locked. Skipped sessions are counted once, in the line that names them, and "Add them" opens their columns. Enter after the last cell goes to Save.

**15. Phone layout and form details.** Figures never break ("−$1,040.00 · −1.73R" stays whole). Conviction is five buttons labelled "1 low · 5 high". Expiration is settled inside the Review, so there is no "Back to the Trade"; Replay's button is "Back to the Review". The phone parts (value under its label, the "Date" heading) are not shown: the mockup is desktop only for now.

## (b) Earlier design rules this mockup breaks

Checked against the plan and specs where a source is named; the others come from the coach's description of the current page.

1. **Hold is no longer always preselected, and Hold can need a reason.** Earlier rule: Hold is preselected and one Save records it; only Exit, Roll and Adjust need a reason (UI contract, "Forms and evidence capture"; D4 A58; D5R A159). Now: past the Stop or Target, or after a decision that was not carried out, nothing is preselected and Hold needs a reason. And an Exit that is the Plan's own exit (the Stop or Target reached, with no Hold past it first) needs no reason, where before every Exit did.
2. **No Action without the day's Marks.** Earlier rule: saving an Action is not held back by missing Marks (D5R A159). Now it is, unless each Mark is saved or marked "Can't get a price".
3. **Marks leave the card.** Earlier rule: each card has its own Marks panel, then Reflections, then Action, one open at a time (D5R A152, A153; D9R2's grid). Now: one grid for the whole page, before the Trades, and no panels inside a card.
4. **A slip is questioned on the screen.** Earlier rule: the screen sends what was typed and shows the issues that come back (D5R A160). Now the cell is checked as the cursor leaves it, and a far price must be confirmed.
5. **A Mark saved in this Review is corrected with no reason.** Earlier rule: correcting a Mark needs a reason (Market Data design).
6. **The Review records the sale.** Earlier rule: the Review records the intent only and the exit is recorded from the Trade Detail (D4 A58 as amended by decision 72). Now "I sold: record it" and "Record the sale" open a short form in the card. The reflection the app asks for on a sale (Reflect now, Reflect later or Decline to reflect, with its own prompts) is replaced there by a check against the Plan's exit; see "A sale against the Plan" below.
7. **An expired contract needs no Action**, and the day can be Complete without one.
8. **A day can be Complete with an exercise or assignment still to record.** Earlier: such a Review stays incomplete until the app can record it. Now "record later" lets that one Review be Complete. The Trade stays open, and the next Review asks again as if it had not been pressed.
9. **"Record expiration" is not the main button when the option is in the money**, and choosing "It expired worthless" there needs a reason.
10. **Expiration is settled in the Review**, not on a separate screen that leads back to the Trade.
11. **Attention labels are replaced.** "Boundary reached", "Quantified pressure", "Evidence limited" and "Blocker" give way to "Past Stop", "At Target", "63% to Stop", "Marks needed", "Expired: settle". The order itself is new (see suggestion 6) and is sorted again only when Marks are saved.
12. **The status card's list of every missing item is gone**, replaced by a count, one next step and one line per Trade (earlier: one linked line per blocker, D5R A161).
13. **The figure grid is replaced.** Earlier: Current P&L, Risk to stop, Worst case, Reward to target, Reward to risk, At entry (D5R A158). Now "Plan" and "Now"; the rest sits behind "More figures".
14. **The refusal moves.** Earlier: "Save or discard what you entered…" at the top of the open card (D5R A156). Now it appears on the header that was pressed and offers the save and the discard itself.
15. **Decline is harder than answering.** Earlier: Decline sits beside Answer and ends the reflection in one click. Now it is a far link, then a confirm.
16. **The Close Review asks more.** Earlier: every answer is optional, and Replay is never required (Journal design: "optional" means unanswered is valid). Now the questions unlock only after the Trade's key moments have been seen in Replay, and "take it again?" and "the key lesson" must be answered ("What worked, and what did not?" stays optional).
17. **Replay moves and grows.** Earlier: a button inside the Action panel of an open Trade. Now its own strip on every card, including the closed Trade's, and it shows the Actions and reasons recorded in each Review.
18. **"What you decided against" and "Note" are folded** behind "Add more".
19. **New screen words.** None of the mockup's wording has been through the approved-words step. The most visible: "No longer valid if" for the Plan's invalidation (the user's choice), "Past Stop", "At Target", "From here", "Nothing is chosen for you here."
20. **A new setting and a new page.** How far a Mark must move before it is questioned is set by the trader on a Settings page, a new entry in the menu. The app has no Settings page today, and this one overlaps D23 (Manage references and Workspace settings).
21. **Desktop only.** The responsive rule (UI contract, "Responsive behavior") is not met; phone was put off for now.

## (c) Replay in the Review: what I decided, and why

A student does not learn from a chart they are told to open. They learn when the chart answers a question they already have. So the Review asks the question, shows the short answer on the card, and leaves the long answer one press away.

1. **Where.** Its own strip in the open card, between "where it stands" and "what will you do". It is there before the Marks are in, after the Action is saved, and on a closed Trade's card.
2. **What it says.** A small picture of the Trade's P&L against its Stop and Target, and one line worked out from the path, different for each state: "Past the Stop since Mon Nov 9 · 6 sessions. See how it got here." / "At the Target since Thu Nov 12. See the run." / "Session 4 of this Trade · low −$280.00, high $0.00. See the path."
3. **How prominent.** It follows the pressure. Inside the lines the button is plain: on a quiet day Replay is there but not asked for. Past a line the button is as strong as Save.
4. **Not required on any ordinary day, even past the Stop.** A forced press each day turns into a ritual that is clicked through. What Replay would teach on that day is put on the card with no press: the path picture, the streak ("Held past the Stop 5 sessions running."), the P&L beside each of the last four decisions, and the "From here" sentence. The reason field carries the discipline; Replay carries the evidence.
5. **Required once: for the Close Review.** The questions unlock after the student has seen the Trade's key moments (for BREN: Entry, Low, Target and first sale, End), each with one sentence. The lesson is written with the whole Trade in view, beside the chart, not in a blank form. Declining stays possible without the walk.
6. **It opens on the moment that teaches.** For a Trade past its Stop, Replay opens on the session it first crossed, not on today.
7. **Key moments is a drop-down**, everywhere Replay appears. It lists the moments in order with their dates ("2. Stop + Sale · Mon Nov 9"). Choosing one moves the chart to that session and shows that moment's sentence under the drop-down. On a session that is not a key moment the drop-down reads "Choose a moment" and the line says "No key moment this session.", so the chart does not jump as the slider moves.
8. **The walk with a drop-down.** In the Close Review the same drop-down ticks each moment once it has been seen ("✓ 1. Entry · Mon Nov 2"), a count beside it reads "1 of 4 seen", and a "Next moment" button goes to the first one not yet seen, so Enter pressed three times walks BREN. A moment counts as seen once its session and sentence have been on screen, however the student got there: the drop-down, "Next moment", the slider or the arrow keys. When all are seen the line reads "All 4 seen. Now write." and the questions unlock. "Seen on screen" was chosen over "picked from the list" (the user's decision, 2026-11-21), so a student who scrubs the whole path with the slider is not made to click each moment again.
9. **The Review writes the story Replay reads back.** Each session in Replay shows "What you did that day": the Action and the reason from that day's Review, and a row of letters under the chart (H, E, R, A, or a dash for a skipped Review). Reading "Oversold. Bounce due." above a chart that kept falling is the lesson, and it is the best reason to write an honest reason tomorrow.
10. **Coming back.** "Back to the Review" or Escape returns to the Replay button on the same card.

## A sale against the Plan

**The user's reason (2026-11-21):** "The 'decided on' exit is on the plan. So the real question is why did you decide to not follow the plan?"

So a sale is measured against the Plan's exit, not against the Exit Action. The earlier design (the Exit Action's reason carries over, with an optional line "Anything different on the day?") is replaced.

**The Plan's exit**, as the mockup reads it: all that is held, when the Stop or the Target is reached, without holding past the line first. The sale form shows it beside the answer: "The Plan's exit: all 200 shares at the Stop (AXIO at or below $47.00) or the Target (AXIO at or above $56.00)."

**A sale that follows the Plan asks nothing** beyond quantity and price. The form says "Follows the Plan: all 200 shares, at the Stop. Nothing more to ask." and the card keeps "Followed the Plan: out at the Stop."

**A sale that leaves the Plan** says how, and asks one required question, "Why did you leave the Plan?". Three ways to leave are recognised, and more than one can apply:

| How it leaves | What the form says |
|---|---|
| Before a line is reached | "Neither the Stop nor the Target is reached." |
| After holding past a line | "The Stop was reached Mon Nov 9. You held 5 sessions past it." |
| Only part | "The Plan's exit is all 2 contracts. This sells 1." |

The verdict changes as the quantity and price are typed.

**My choices as coach**

1. **The question is asked once, where the trader leaves the Plan, and the sale carries the answer.** The Exit Action in the Review asks the same question when the Exit leaves the Plan (inside the lines, or after holding past a line). The sale that carries out that Exit shows the answer ("Your reason, Mon Nov 16: '…' Nothing more to ask.") and asks nothing. The Review is the better place for the question: the trader is at the desk with the Plan, the meter and Replay beside the answer.
2. **Selling part is always asked at the sale** ("Why only part?" when the Exit already has its answer), because an Exit decides the whole position and only the sale knows it was part.
3. **The Action form speaks the same language.** Each card says what the Plan says: "Inside its lines. The Plan says hold." or "Past your Stop (…). The Plan says out." Then:
   - Hold inside the lines follows the Plan: preselected, no reason needed.
   - Hold past a line leaves it: "Why leave the Plan?", required.
   - Exit when a line is first reached is the Plan's exit: "No reason needed." This drops the old rule that every Exit needs a reason.
   - Exit inside the lines leaves it: "Why leave the Plan?", required.
   - Exit after holding past a line: "Why did you leave the Plan?", required. Each Hold along the way already gave a reason in the moment; this one is asked looking back, when what holding cost is on the screen.
   - Adjust asks "Why change the Plan?" and Roll asks "Why roll?"; both stay required.
4. **"Reached" is generous.** A line counts as reached if the Trade stands at or past it at the latest Marks, or if the sale's own price is at or past it.
5. **"Held past" means a Hold was saved in a Review while the Trade stood past the line.** Choosing Exit in the first Review after the line is reached and selling the next day still follows the Plan.
6. **A sale with no Exit decided first** (for example "Sold before the close" on expiration day) is judged the same way and asks at the sale when it leaves the Plan.

**Where to see it**

- Follows the Plan: "Stop hit today", AXIO. Exit needs no reason; the sale of all 200 asks nothing. Change the quantity to 100 and it asks.
- Leaves the Plan, before a line: "Stop hit today" or "Quiet day", any other Trade. Exit asks "Why leave the Plan?"; the sale carries the answer.
- Leaves the Plan, held past a line: "Work to do", AXIO (5 sessions past the Stop); "Day after an Exit", BREN (2 sessions past the Target, answer carried from Monday); "Expiration day", CORV "Sold before the close" (no Exit decided, so the sale asks).

## (d) Decisions since the first version (the user, 2026-11-21)

1. **A long run of Holds past the Stop asks for nothing more than the reason.** Only the count is shown.
2. **How far is "far" for a Mark is the trader's setting, on a Settings page.** Defaults: 5% for a stock or Underlying; for an option 100% up or 50% down. Under the Marks grid there is only a line stating the limits and a link to Settings.
3. **"Record later" only lets that one Review finish.** Later Reviews show what they would have shown if it had never been pressed.
4. **A sale is measured against the Plan's exit**, not against the Exit Action (above). A sale that follows the Plan asks nothing; one that leaves it asks "Why did you leave the Plan?".
5. **Close Review fields, for now:** "Would you take this Trade again under similar conditions?" and "What is the key lesson?", both required, and "What worked, and what did not?", optional. **Later these fields come from the definition of the journal entry type**, which is not specified yet. In the mockup they are one short list (`CR_FIELDS` in `index.html`) that the form is drawn from, to stand in for that definition.
6. **"No longer valid if"** is the label for the Plan's invalidation.
7. **After a part sale the Exit keeps asking**: "Sold 1 since. Still holding 1."
8. **No "Hold all".** The trader goes through each Trade every day; that ritual is the point.
9. **Key moments is a drop-down**, not a row of pills (part (c), points 7 and 8).
10. **Seeing a key moment: sliding past it counts.** A moment is seen once its session and sentence have been on screen.
11. **Leaving for Settings with unsaved Marks** asks "Leave without saving?" and then drops them, as any other page change would.

## Still open

1. **The late Exit asks again.** A Trade held five sessions past its Stop has five Hold reasons already. The mockup still asks "Why did you leave the Plan?" once more at the Exit, looking back. The other way is to ask nothing and show the Hold reasons.
2. **Plans that sell in parts.** The mockup reads every Plan's exit as "all, at the Stop or the Target". A Plan that says "half at the Target, trail the rest" has no place to say so yet, so its first sale would be called leaving the Plan.
3. **A line touched during the day.** "Reached" is judged from the saved Marks and the sale's price. A Stop touched and recovered between two Marks is not seen.
4. **A line set on the Underlying, a sale priced in the option** (DALE's Stop). The sale's price cannot show whether the Stop was reached, so only the Marks decide.
5. **The optional line "Anything different on the day?"** from the earlier design is gone: a sale that follows the Plan, or carries its answer, asks nothing at all.
6. **Roll and Adjust** always ask for a reason. Whether a roll or a new Stop can ever "follow the Plan" is not considered.
7. **Settings and D23.** The Settings page here holds one setting. D23 (Manage references and Workspace settings) covers Workspace settings; whether this page is D23's page, a part of it, or comes earlier on its own is to be settled when either is planned.
8. **The next Review after "record later"** is described in words only: the mockup's data ends on Fri Nov 20.
9. **Trade Detail** needs the same wording (suggestion 12); not drawn here.
10. **Phone** is not drawn.

## Made-up data to know about

- The Trades, prices and results match the coach review: AXIO −$1,040.00 and $300.00 past its Stop on Mon Nov 16; BREN +$988.00 open, +$1,138.00 once sold out; CORV +$1,467.00 at expiration; DALE −$2,088.00 on Mon Nov 16.
- "Expiration day" uses a different DALE history, in which DALE never fell and the put expires worthless, as in the coach's expiration Review. The other days use the DALE that is past its Stop.
- Invented for the mockup, not in the coach review: the thesis and invalidation of BREN, CORV and DALE, and the reasons on earlier sessions' Actions.
- Every figure is worked out from the typed Marks, so any price can be tried.
- BREN's Monday Exit reason is reworded to answer the new question: "Let 2 run past the Target. Four sessions to the expiration: sell the last 2."
- "Stop hit today" is the Quiet day with one made-up Mark: AXIO at $46.40 on Thu Nov 5, under its $47.00 Stop.
