# D9.5 tech debt

Style-only ocr findings and low critic defects (the user's rule, 2026-11-19). Reviewed with the user after the final gate.

| Source | Kind | Item |
|---|---|---|
| ocr T95.3 (`2f9575d9`) | test coverage | `src/coordinators/daily-review/order.test.ts:60`: the "at its Target" case marks 56.50 against a 56.00 Target; no case checks a Mark exactly at the Target. |
| ocr T95.6 (`c0c8c27a`) | style | `tests/integration/d5r/support.ts:70`: `saveMarksFrom` keeps an unused `tradeId` parameter that its callers still pass. |
| run `t95.3-t95.5` | tooling | browser-2 (9.4 min) and browser-4 (13.7 min) passed the 8-minute mark the runner flags; add a browser-5 stage (partly load from the overlap trial). |
| runs `t95.3-t95.5`, `t95.6-t95.7` | flaky test | `tools/estimate-rules.test.ts:122` "should pass every file of the current tree" times out at 5 s under load (both runs, each beside a task); passes alone. |
| the user, 2026-11-22 | test tooling | About 25 post-save heading waits in e2e support helpers (Exit, Expiration, Restore recorded; `READY`, 20 s) would burn 20 s on a refused save; candidates for T95.7-F2's `savedUnlessRefused`. |

- T95.17 ocr (style): `src/ui/screens/ReviewCard.tsx` 332 and 334 use `atEntry != null`; the codebase uses strict checks.

- Critic-1 (T95.26), low: the "0 means it closed with no value" hint shows under a stocks-only grid that refuses $0.00.
- Critic-1, low: an "At entry" block repeats near-identical Risk and Reward beside the Plan box and drawing on a card whose Mark is missing or unavailable.
- Critic-1, low: at 1280, "Reward to risk Mark missing: … · Plan 2.40 to 1" wraps, leaving "1" alone.
- Critic-1, low: at 375 with two slip questions open, "Discard 2" and "Marks to check first." split across lines.

- Critic-2 (T95.26), low: at 320, "Reward to risk 2.30 to 1 · Plan" wraps, leaving "0.29 to 1" on the next line.
- Critic-2, low: at 320 the drawing's "Stop −$740.00" and "Target +$160.00" labels touch, with no gap.
- Critic-2, moderate, moved to tech debt by the user (2026-11-23): a card whose option Mark is acknowledged unavailable (DALE's Put, Tue Nov 17) does not say so; its Now box shows the session before's Marks under "At the Mon Nov 16 Marks", and today's DALE Mark is not shown. The day card and Trade Detail do disclose it.

Critic-2's minor observations (added at the user's request, 2026-11-23; two others, the "0 means…" hint and the "At entry" block, are already listed above):
- No day total with an unavailable Mark: "Day so far" and the finished day's "The day" row are left out with no explanation.
- A reload shows the grid open: reopening a Review whose Marks are all saved shows the grid open with "Save Marks (0)", not folded with "Edit".
- Enter doesn't confirm a reason: after typing a "Why no price" reason, Enter neither confirms "No price" nor moves on; "No price / Cancel" stay shown.
- Old wording: the day card's hidden reasons and the Open list's rows still say "Stop breached" and "Target reached", while the Review's labels say "Past Stop" and "At Target".
- On the standard Review, "No Review for Mon Nov 2 … Mon Nov 16. Their Marks are optional." shows although those Marks exist.
- The drawing's name with an unavailable Mark reads "Acknowledged unavailable: XYZ, Mon Oct 12 Stop −$270.00, …", with no full stop before "Stop".
- The Plan box's Entry reads "short 6 contracts at $0.94" (DALE), with a lower-case "short".
- Focus after the last Hold falls to the page body (focus after each save is Part C's T95.61; check it there).

- Critic-3 (T95.26), moderate, moved to tech debt by the user (2026-11-24, answer (a)): on a partly sold Trade the shared meter (the drawing's name and marker, the collapsed card's meter, the Open list's meter) says "86% of the way to the Stop" (money lost so far ÷ money lost at the Stop, realized included: $640 ÷ $740 for AXIO on Tue Nov 17), while the label and line say 67% (the spec's Pressure share, price-based). Decide once what the shared meter means everywhere (its figure or its words); the plan's S12 kept the shared meter unedited in D9.5.
- T95.27 ocr (style, Doubtful): `src/modules/journal/records.ts:4` `PromptRole` is shared with SingleSelect prompts, so a typed manifest could put PlanDepartureReason or ExpirationReason on a SingleSelect that restore would refuse; type-level only.
- T95.31-F1 ocr (tooling): `.claude/ocr-rule.json` doesn't include `tests/fixtures/**/expected-views.json`, so a commit changing only fixture views is skipped with 0 files; the reviewer added the pattern in a scratch copy.
- T95.36-B4 (pre-existing, outside the sale): `confirmPlan` (`src/coordinators/trade-workflows/trade-workflows.ts:71`) checks its economicTime against now with `Date.parse`; an annotated instant (`…Z[UTC]`) gives NaN, so the future-time check never fires on that path.
- T95.45 (agent note, low): the Action form's `focus` handle (`ActionForm.tsx`) uses `querySelector('input:checked, input, textarea')`, which returns the first radio, so "Back to ABC" puts focus in the form but not on the chosen Action.
- T95.28-F2-B1 (ocr reviewer note, not an ocr finding): `src/ui/AppShell.tsx:333` the launch seed step's catch branch awaits getStatus() with no handler of its own; if that read rejects too, the rejection is unhandled and the status stays unset.

- Critic B1 (T95.46), low: after a part sale through "I sold: record it", the day card's note reads "… Still holding 60." without "Sold 40 since." (the card has it). Built that way on purpose in T95.41 (new-words.md Part B: shorter than the mockup); for the word review.
Critic B1's minor observations (T95.46):
- A closed Trade owing a Close Review and a Position Change Reflection has two buttons both named "Reflect on 2026-10-13 15:00"; their order varied between runs. May predate D9.5.
- An Unknown Plan Call with no earlier Mark says only "Nothing is chosen for you here."; W120 and W121 cover neither case.
- At 375 the Conviction button "5" wraps to a second row.
- A closed Trade owing a reason is headed "Close Review · next Review" then "2 reflections due", never "Say why" (closed card is T95.58; check there).
- After a part sale on a day with no Marks, the next card header says "Long 60 shares" while "At the Mon Oct 12 Marks" figures are for 100 shares (T95.20's session-before figures).
- Not covered by any flow: a short Position's "Record the buy-back".

- Critic B2 (T95.46), low: with an Exit saved with no reason, the day card's note reads "Tue Oct 13 you chose Exit on ABC: Still holding 60." (a bare colon).
Critic B2's minor observations (T95.46):
- A sale at the default 17:00 from Trade Detail leaves the Trade on that evening's Review as "Closed after this session's close · Closed" with "To do: Action", an Action form and 100-share figures; a part sale at 17:00 leaves "Long 100 shares" until the next day (Marks at the close; wording predates D9.5).
- Exit and part sale on the same day: the next day's banner omits "Sold 40 since".
- A closed Trade's card header keeps "Long 100 shares @ $30.00" beside "Done · Exit" after the receipt; its body still shows "Stop breached".
- Not covered by a flow: T95.40-D1 items 2 and 3; "Save it" and "Back to JKL" on a half-typed sale; "Record the buy-back".
- T95.46-B4 (agent note): a sale dated before the previous close (backdated) is classified Due, and its receipt still says "the next Review"; the receipt's due wording covers the after-close case only.

- Critic B3 (T95.46), low: after a closing sale through the day card's banner with no Marks entered, the card still says "Figures wait for today's Marks. Below: at the Mon Oct 12 Marks." with nothing below but the Plan box and the receipt.
- Critic B3, low: beside a closing sale's receipt, the day card still lists the closed Trade ("Next: ABC", "ABC · 30% to Stop · To do: Action", or "Marks needed · To do: Mark, Action" with its row left in the Marks grid) until "Back to the Review" (T95.46-B3 hid the banner and the card's state, not the day card's line).
Critic B3's minor observations (T95.46):
- "Day so far" rises when a Trade is sold at a loss before the close (only Trades open at the close count; matches specs/design/daily-review.md:19).
- "Back to the Review" drops a half-typed sale without the refusal.
- The Trade-switch refusal stays beside the form's own refusal after a failed "Save it".
- ocr (owed range a2dbcc59^..1a774a68), style: `src/ui/AppShell.test.tsx:1332` waits a fixed 20 ms for the stale status instead of an awaited act.
- The T95.46-B4 agent note on backdated sales above is now bug task T95.46-B6.
- T95.46-B8 (agent note): a sold-out card's region label ("XYZ Long 2 shares @ $50.10 review") still carries the position summary after the sale.
- ocr (T95.46-B5 to B9), style: `src/ui/screens/ExitReceipt.tsx:58-59` the `when` helper nests a ternary in a template literal inside a ternary; an early return for Due reads more simply.

- ocr (T95.48), style: `tests/support/replay-series-app.ts:68` nests the expiration ternary inside the sale ternary; explicit branches read more simply.
- ocr (T95.52), style: `src/ui/screens/ReviewCard.tsx:271` the open-panel useState initializer nests a ternary inside `??`; a helper with early returns reads more simply.

- **T95.62-D1, ocr (Doubtful, performance; `daily-review.ts:682` and `pastLineOf` ~535):** for a Settlement Due Trade whose Stop or Target is crossed on the expiration session, `open` assembles the same replay twice (once for the standing, once in `pastLineOf`). Both go through the same read session, so no store read repeats and the pins hold; only the in-memory assembly repeats. Fix: assemble once per Trade and share it.

- **T95.59-B1, ocr (low, test style; `close-review-walk.test.tsx:195`):** the held save is settled outside `act` on the test's last line; no act warning seen. Wrap the settle in `act`.
- **T95.59-B1, main session:** DebtForm's answer prompts stay editable while a save is pending (the gap fixed in the walk by T95.59-B1); ocr has not raised it there.

Stale-code audit, 2026-11-26 (at `eb51a427`; the user's direction: record, don't remove yet). Unused code from before the D9 tag, each proven by deleting it in a scratch copy (typecheck, lint, unit, integration green):
- `src/ui/screens/PayoffView.tsx` (whole file) and `lastRayText` in `payoff-text.ts`: no importer since T8P.27. Tests: `PayoffView.test.tsx` (9 cases).
- `src/ui/screens/MarkEntry.tsx`: the `offerEntry` prop and the Enter and "Can't get a price" forms; the only caller passes `offerEntry={false}` since T5R.9. Tests: 4 cases to delete in `MarkEntry.test.tsx`; 13 cases use Enter only to reach live behaviour and must move onto Correct.
- `WalkedTrade.figures` and `SliderFigures` (`src/coordinators/daily-review`): no screen reads them since the meter replaced the slider. Tests: 2 unit cases; figures assertions in `tests/integration/d5r/range-and-baseline.test.ts` and `shared-mark.test.ts`; 1,442 lines in 10 frozen `expected-views.json` files.
- `PnlChart` (`replay/corridor-pnl.tsx`) and `PriceStrip` (`replay/price-strip.tsx`): wrappers nothing renders (T9AR.10). No tests.
- `settlementTimeOf` (`src/coordinators/valuation/settlement.ts` and its re-export): no caller (T7SP.8). No tests.

- Critic C1 (T95.67), low: W136's second sentence, "Expired today: nothing left to decide, only how it settled.", appears nowhere; only the heading "Expired Fri Nov 20 · no Action needed" shows.
- Critic C1, low: on expiration day with an earlier session Missing, Enter after the last Fri Nov 20 input goes to "XYZ Mark, Thu Nov 19" and opens its editor, not "Save Marks" (T95.15 case 1).
- Critic C1, low: the next day's settlement card says the choice twice: "Fri Nov 20 you chose Settle Later, no reason given." and W144's "Fri Nov 20 you chose Exercised: record later…" (U2).
- Critic C1, low: "Tomorrow: Sell BREN, DALE, CORV, then record the sales." names a short put's buy-back a sale.
Critic C1's minor observations (T95.67):
- The Now box measures expired contracts on the expiration evening (to Stop, Worst case), as the mockup draws; Trade Detail that evening says "The contract expired, so its conditions are no longer measured." Needs a ruling at user review.
- A sale with the Underlying acknowledged Unavailable still says "Neither the Stop nor the Target is reached."
- The day card's visually hidden reasons are read as one run-on after the Trade list as well as each link's description.
- The Now box's key is an unnamed list.
- After Save Marks, focus lands on the first header while another card stays open; the next Tab goes into that card.
- The day card's counts: "1 Trade · … 1 Close Review to go" with two lines listed; "0 Trades · 2 Close Reviews and 1 reflection to go" with "Day so far: $0.00" when no Trade is open.
- The Settle Later session has no mark in the Replay's Action row.
- A buy-back is named "Sale" in Key moments.
- After "Still holding", the card's subline still reads "You chose Exit and it is not recorded".
- The grid's previous-session column shows stock Marks without "$" in one Workspace and with it in another.

- Critic C2 (T95.67), low: on a day with both a settlement to record and Unavailable Marks, the finished day reads only "Complete, settlement to record"; the Unavailable Marks lines show unheaded (the group is labelled for screen readers only; A316, T95.49 case 7).
Critic C2's minor observations (T95.67):
- The Replay headline "+$98.05 · 0.25R" has no "+" on the R; the card shows "+0.25R".
- The closed option card's Plan column reads "XYZ at or below 48.00" with no "$".
- The grid: after "Can't get a price" then Cancel, focus falls to the page body; after "No price" focus stays on "Undo".
- Saving the Close Review from Trade Detail leaves focus on a DIV.
- Nothing is announced to a screen reader after Save Marks or an Action; only focus moves.
- At 320 the Replay's Action row for a 30-session Trade is unreadable; the Key moments select is cut off.
- The "Missed" list runs to 29 dates; the next-day Now box shows "Settlement Due: …" as row values.

- Critic C3 (T95.67), low: after an expiration is recorded inside the card, the block above the receipt and the day card stay stale ("no Action needed", "2 expirations to settle", "To do: Settle") until "Back to the Review" (the expiration twin of critic B3's closing-sale item).
Critic C3's minor observations (T95.67):
- An in-the-money short's "Worth $400.00 at expiration" names the trader's liability as "worth".
- "It expired worthless" with no Underlying Mark shows no "This books …" line, though the amount does not depend on the Mark.
- The expiration receipt in the card has no sentence on when the Close Review is due (a sale's receipt has one, W135).
- The closed card offers "Write the Close Review" and "Decline…" beside "Not due until the next Review."
- "Record the sale" and "I sold: record it" outside the expiration block prefill 17:00 (after the close), giving "…due in the Review after next".
- "Back to BREN" puts focus on the first radio.

- Benchmark (T95.67, the user's answer to Q18, 2026-11-27): `tools/bench-run.ts` (282, 346, 429) still reads the old Review status block and its Blockers list, removed by T95.10, so `bench:run` times out and the Review-open time at scale (AC-PERF-001, A326) is not measured; the capacity steps pass. Fix: read the new page's day card and owed group, then rerun the benchmark.

- Word review (the user, 2026-11-27): the saved "record later" card header reads "Done · Settle Later" (`todoText`); approved wording is W101's "Settle later".
