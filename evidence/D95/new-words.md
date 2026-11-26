# D9.5 new words (Part A approved 2026-11-24)

## T95.10 (provisional)
- Accessible names: region "The day"; lists "Trade lines", "Steps", "Facts to check".
- Counts line: "N reflection(s)" (a reflection that is not a Close Review).
- Line text: "To do: Reflection"; "Done" for a line with nothing to do (W101's "Done · Hold" needs the saved Action).
- A hidden " done" on finished steps (screen readers).

## T95.11-B1 (provisional; hidden, screen readers only)
- "Past Stop at the close on Fri" / "At Target at the close on Thu" (the session before's label).
- "63% of the way from entry to the Stop" / "…to the Target" (a share label; reuses `reasonText`'s wording).

## T95.12 (provisional)
- "Add the skipped sessions" (the grid's button).
- "· optional" in a skipped column's header.
- "Cancel" beside the reason field.
- "Enter why you can't get a price." (existing words, reused for an empty reason).

## T95.13 (provisional)
- "1 Mark to check first." (W109's singular).

## T95.14 (provisional)
- "It is now $51.00. Your values are kept." (a conflict on a cell edited in place; replaces the tail "The current Mark is shown above…").

## T95.21 (provisional)

- "The day" row: the signed change in Trade P&L (e.g. −$74.00); on a finished day it replaces "Day so far", so the figure shows once.
- "Past a line" shows "(N sessions)" only when N is above 1.
- "You chose" lists Exit, Roll, Adjust, then Hold.
- "Missed" row: the dates with the existing "Add them" button (replaces the "No Review for … Their Marks are optional." paragraph on a finished day only).

## T95.21-B1 (provisional)

- With several saved Exits, "Tomorrow" reads "Sell AXIO, BREN, then record the sales." Each Trade name links to its own card. One Exit keeps "Sell BREN, then record the sale."

- T95.16: "−$30.00 today" (the day's change in the card header, from the prototype, no W row); header P&L "+$180.00 · +0.40R".

- T95.17 (no W row): the Marks line ("AXIO $45.10 −$0.50", "Call $1.20 +$0.05"); "lose −$…" without "another" while ahead; "To Stop (…)" and "Past Stop (…)" with no price distance; "$1.00 past Stop"; "with DALE then: <reason>"; "1 session". For the word review: "More figures" keeps the existing "max loss: unlimited" where W92 says "max loss no limit".

- T95.18 (no W row): "−$0.50 (−$200.00 so far)" (dollar amount passed only, both shorter lengths); "To Stop (another −$200.00)" and "To Stop (−$200.00)" (no price distance; likewise Target); "Past Stop" with no overrun at every length.

- T95.19 (no W row): top line without a reason ends ", no reason given." (W114's form); "1 earlier decision" (singular of W117).

- T95.20 (no W row): "Figures wait for today's Marks." alone, when no session before's figures are shown (W94 without its second sentence); "No Action until today's Mark is in. Enter it" for one Mark (W95's own singular); the same words for a save refused as ReviewMarksUnresolved, with the count from the refusal's Instruments.

## Approved (2026-11-24)

The user approved every entry above as it stands, after the T95.26 gate. "More figures" keeps "max loss: unlimited" (Trade Detail's words) over W92's "max loss no limit". The critics' wording notes stay in tech-debt.md.

## Part B (awaiting approval)

- T95.33 (no W row): an Unknown Plan Call shows no call line, only "Nothing is chosen for you here."; a short Position: "buy back all 4 contracts at the Stop… Record the buy-back once it is done."; with no replay the Exit line says "sell all of it"; with nothing chosen the button reads "Save"; a saved Action with no reason reads "Mon Nov 16: Hold" with no quote; Conviction hint "1 low · 5 high", group "Conviction now (optional)".
- T95.34 (question for the word review): W128 names the Underlying ("XYZ's note isn't saved.", "Back to XYZ"); with two Trades on the same Underlying the words don't say which. Built as W128 states. The old "… to go on" message (ReviewView.tsx 307) has no W128 replacement and is unchanged.
- T95.42 (no W row, temporary until T95.60's W153 "Decline…" link): "Decline anyway", the extra press to decline an owed reflection whose Debt requires a role.
- T95.39 (no W row): the empty-question refusal "Say why you left the Plan, or choose “Say why later”."; with only one of Stop and Target, "The Stop is not reached." / "The Target is not reached." (W132 words it for both); the heading "Reflection on this exit" kept, now holding only "Add more".
- T95.41 (beyond W129, which covers the long side and the card sentence): "I bought back: record it" and "Bought back N since." for a short Position; the day card sentence "Fri Nov 13 you chose Exit on AXIO: “reason” Still holding 2." (no "Sold N since" on the day card, shorter than the mockup).
- T95.46-B4 (reuses the Review's own "Review after next"): a receipt for an item due in the Review after next reads "Its Close Review is due in the Review after next." and "Why you left the Plan is owed at the Review after next."; an item due in the next Review keeps "next Review".
- T95.46-B6 (no W row; the Review itself shows just "Due"): a receipt for an item the Review already asks for reads "Its Close Review is due now." and "Why you left the Plan is owed now."
- T95.52 (expiration block; W138/W141): "Bought it back before the close" (short, out of the money); W140's "on a put worth $X" used for short contracts too, amount unsigned; a short contract's worth unsigned; W141 for a short contract whose result is a loss reads "You lose $X."; W142's "No price for X…" also when the standing is absent or the Mark not yet entered. No W row: "This could not be saved. Nothing was saved."; "The Review changed after you opened this Trade. Nothing was saved. Refresh to see the current Review." with "Refresh" (ActionForm's words); the form's refusal "Say why." beside the Expiration Reason (W123); aria-label "Expired contract"; "Back to the Review" in the card (X10); the card header shows "Done · Settle Later" until T95.53 (W101 "Settle later").
- T95.53 (W145 covers the exercise and plural only): "CORV: the assignment of 1 contract, expired Fri Nov 20." (short contract; singular "1 contract"); W144 for a short contract: "Fri Nov 20 you chose Assigned: record later. …". For the word review: a saved Settle Later's card header still reads "Done · Settle Later" (from `todoText`), where W101 lists "Settle later"; T95.53 left it.
- T95.57 (Replay): "Key moments" as the drop-down's name (W148); " + " joining kinds ("Stop + Sale", W148); "Action by session" (the row's list name, W149); "No Review" as the row's spoken name, a session spoken as "Mon Nov 2: Hold" (W149); "Expired. You chose Assigned: record later." (W147); "Expired. You chose to record it later." when no option tells the side (W147).
- T95.58 (closed card, nearest W150): "All at the Stop or the Target" (the Plan's Exit, mockup wording); "Bought N at $P, Fri Oct 9", "Sold N at $P, date", "Bought back N at $P, date"; "N expired worthless, date"; "sold 2 contracts, 2 expired worthless" (mixed ending); "expired worthless" in the how-it-ended sentence; the Close Reason kept after it ("How it ended: sold all 100 shares, Mon Oct 12. Stop Triggered."); table name "Plan and what happened", region "How it ended"; Entry's Plan text "100 shares at $30.00" ("Sell …" for a short leg).
