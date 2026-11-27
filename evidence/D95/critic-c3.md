# D95 critic-c3 report

## 1. Header

- **Run:** Thu Nov 26 2026, 21:11 to 21:48 EST. Commit `c2c502f2` on branch `claude-opus-5.5`.
- **Tools:** Node v26.12.0, Playwright 1.63.0, Chromium 153.0.8010.12 (full build, new headless mode).
- **Builds:** one `npm run build:all`, run inside `.claude/scripts/with-browser-lock.sh`, exit 0.
- **Served builds:**
  - Every flow used `dist-faults` (the current source, through `e2e/d7/support.ts`'s `test`).
  - C95.8 used `dist-releases/d9r2` for setup, then `dist-releases/current` after the update notice.
- **Server:** only the suite's release server on port 5175, through the Playwright fixtures and inside the browser lock. The fixtures give each test a fresh profile folder.
- **Config:** my own, at `test-results/critic-d95-c3/playwright.config.ts`, with output in `test-results/critic-d95-c3/pw-out`. Text dumps, accessibility snapshots, screenshots and notes are in `/Users/ckolbegger/src/trade-journal-v3/worktrees/claude-opus-5.5/test-results/critic-d95-c3/dumps/`.
- **Phone width:** each flow ran in a context launched at 375 wide with `touch: true`. Most of those steps used `.click()`; one pass used `.tap()` for every action. 320 was checked by resizing.
- **Screen reader:** `page.accessibility.snapshot()` is not available in this Playwright version. I used `locator.ariaSnapshot()` (roles, names, values), `expectAccessible` (axe, WCAG 2.1 AA), and a record of every `aria-live`, `role=status` and `role=alert` node after each step.
- **Clean finish:** `git status --short` is empty, so no tracked file was edited and no commit was made. Nothing listens on 5175.

## 2. Results

| Flow | Result | Key observations |
|---|---|---|
| C95.1 | PASS (1280, 375) | Four Trades by keyboard alone. Enter moves to the next price, then to "Save Marks (4)". After the save, focus is on the first card's header. Hold is preselected inside the lines on all four. After each save, focus goes to the next header; after the last, to "The day", which reads "Complete". Axe is clean. |
| C95.2 | PASS | Every slip question appeared: "$44.00 or $440.00?", "Worth nothing? Yes, $0.00 / Retype", "+15.4% from $104.00. Right?", "+12.8% from $53.20. Right?". Choosing $44.00 stored price 44, and a 10× slip blocked the save ("1 Mark to check first."). Fix in place: Edit shows "Saved in this Review: fix it in place, no reason needed." |
| C95.3 | PASS | Each card's P&amp;L matches Trade Detail: DALE −$2,088.00 on both, AXIO −$1,040.00, BREN +$988.00. Captions are shorter at 320 ("−$4.22 (+$2,532.00)"), with no sideways scroll. The Now box image and caption notes carry full accessible names ("$3.00 past Stop (−$300.00 so far)"). |
| C95.4 | PASS | DALE's put has "No price" and the other Marks are typed; then Exit and two Holds. The day reads "Complete with Unavailable Marks", with "Instruments: DALE Nov 20 $57.50 Put · Trades: DALE (…) · Not calculated: Valuation, Risk, Reward, Condition status". DALE's Plan Call is correctly Out: its Stop is priced in the Underlying, so Hold needs "Why? (required)". |
| C95.5 | PASS | **Out** (AXIO past the Stop, BREN at the Target): nothing preselected; Exit's "Why?" is optional; Hold without a reason is refused with "Say why.", and focus goes to the reason box. **Inside** (ABC): Hold preselected; Exit without a reason refused. **Unknown** (DEF, no price): "Nothing is chosen for you here."; Exit without a reason refused, Hold saves. Roll always needs a reason. |
| C95.6 | PASS | **Review, following the Plan:** "Follows the Plan: all 100 shares, at the Stop. Nothing more to ask." **Before a line:** "Neither the Stop nor the Target is reached." **After holding past:** "The Stop was reached Mon Oct 12. You held 1 session past it." **Part sale:** "Why only part?". **Carried reason (W133):** "Your reason, Mon Oct 12: "Taking profit early." Nothing more to ask." **Say why later** saves at once; the receipt says "…Why you left the Plan is owed at the next Review." At the next Review, Answer without the reason is refused ("Answer "Why did you leave the Plan?"."); with it, the reflection saves. Trade Detail gives the same checks. |
| C95.7 | PASS | The banner reads "You chose Exit on Mon Nov 16. Still holding 100." "Still holding" hides it, saves nothing, and it returns after a reload. "I sold: record it" opens the sale form. All three refusal choices worked: "Save it" (focused) saved the Roll and opened DALE; "Discard it" opened BREN; "Back to BREN" kept the Roll and its reason. A half-typed sale is refused the same way. |
| C95.8 | PASS | A D9 Workspace upgraded through the update notice. The owed reflection shows under "Reflect on 2026-10-12 10:00" and keeps its old form (no "Why did you leave the Plan?" field). It was answered, the Debt is Settled, Hold was preselected, and one Action was saved. |
| C95.9 | PASS | **Heading:** "Expired Fri Nov 20 · no Action needed" (W136). **In the money:** "XYZ $57.00, strike $55.00: $2.00 in the money", "Worth $200.00 at expiration: +$98.05 · +0.25R on the Trade."; "Exercised: record later" for the long and "Assigned: record later" for the short are the main buttons, with W139's text under them. "It expired worthless" in the money reads "This books −$101.95 · −0.25R on a call worth $200.00.", asks "Why did it expire worthless?", and refuses with "Say why." until answered. "Record expiration anyway" works. **Record later:** writes one entry (7 → 8) and changes no Trade (store unchanged); the saved line is W143, the other two choices stay, and there is no undo. **The day:** amber "Complete, settlement to record"; the "To record" rows name MNO and XYZ (W145); the day card's count reads "2 expirations to settle" (W96). **Next day:** W144, "Expired: settle", no Marks asked, "Fri Nov 20 · expired" (W90). **No Underlying Mark:** W142, three plain choices, no main button, no reason asked. **Prefill:** "Sold before the close" and "Bought back before the close" prefill 2026-11-20T15:59, on the expiration evening and the day after (fixed). **W141, every variant matches my hand totals:** "Your loss on the trade is $100.65" (long, nothing sold); "Your net loss … $101.95" and "Your net gain … $98.05" (long, part sold); "You keep $248.70" (short, nothing bought back); "Your net gain … $158.05" and "Your net loss … $51.95" (short, part bought back). Each receipt's realized P&amp;L equals its line. The block is one column at 375 and 320. |
| C95.10 | PASS | **Where it opens:** BREN on Thu Nov 12 (first at the Target), AXIO on Mon Nov 9, DALE on Fri Nov 13; Trade Detail opens on the newest session. **Strip (W146):** "Past the Stop since Mon Nov 9 · 6 sessions. See how it got here.", "At the Target since Thu Nov 12. See the run.", and on the closed card "2 sessions · low −$242.00 on Tue Oct 13. Walk it before you write." **What you did that day (W147):** "Action: Hold · "Giving it one more day."", "Action: Exit · no reason given", "No Review this session.", "Action: not chosen yet.", "Expired. You chose Exercised: record later." **Action row and key (W149):** present. **Key moments (W148):** e.g. "3. Stop + Sale · Mon Nov 9"; choosing one moves the Replay there; "No key moment this session." appears away from one. **Touch:** slider, step buttons and drop-down are 44 px high; Close is 50×44 at 375. **Focus:** at an end it stays in the dialog (Previous at the last session; Next at the first in the two-session case); Escape returns focus to Replay. No sideways scroll at 320. |
| C95.11 | PASS | The walk opens on moment 1 with "1 of 2 seen" and every question locked. Moments counted through the step buttons, "Next moment" and the drop-down. "All 2 seen. Now write." unlocks the questions; an empty save shows "Choose one." and "Write the lesson." Pressing Escape or Close with answers typed offers "Save it" / "Discard it": Discard keeps the Debt Outstanding and forgets what was seen. Save marks the card "Close Review saved", with focus on its header. The closed card's Stop cell reads "Reached Tue Oct 13" (fixed). Trade Detail's walk saves the same review. Decline: "Decline this Close Review? The Journal will show it as declined." and "Why? (optional)"; "Keep it" keeps the Debt; declining shows "Close Review declined". |
| C95.12 | PASS | By keyboard: the whole Review, the expiration block and its form, the Replay (arrows, Home, the drop-down, Escape) and the walk (Next moment, arrow keys on the radios, typing). Every focused element showed a focus ring. A resize from 1280 to 375 to 320 and back, in the middle of an Action and in the middle of the walk, kept every choice, the typed text, the open card and the unlocked walk. |
| Screen reader pass | PASS, with known gaps | Axe was clean in 14 states: the open day, each card, the finished day, the banner, the expiration block at 375 and 320, after "record later", the Replay, the closed card, and the walk locked and unlocked. Names were readable throughout: the day card (terms and definitions, "Trade lines"), the grid (cells named like "AXIO Mark, Mon Nov 16"), the Now box (named image and notes), the closed card ("Plan and what happened" table), the Replay (a named slider with valuetext), and the walk (disabled radios named). Known gaps still present: nothing is announced after Save Marks or an Action; the key list has no name; the day card's hidden "Stop breached" text. |
| Phone width (375, touch) | PASS | Every flow ran at 375 in a touch context. The tapped pass covered the nav, the grid, the card header, the expiration block, the Replay and "record later". Expiration buttons are 309×46 and 309×44. There was no sideways scroll in any dump at 1280, 375 or 320. |
| Day Complete with Unavailable Marks | PASS | See C95.4. |
| Reflection owed on an open Trade | PASS | See C95.8, and C95.6's Say-why-later reflection on DEF, which stays open. |

## 3. Overall: **PASS**

**Defects**

1. **Low.** After an expiration is recorded inside the card, the screen beside the receipt is stale until "Back to the Review".
   - **Steps:** Fri Nov 20, XYZ at 52.00, call at 0. On XYZ's card, press "Record expiration", then save.
   - **Expected:** the day card and the card update after the save, like any other save (T95.53; AC-RESP-001: "a save returns usable state").
   - **Actual:** the block above the receipt still reads "Expired Fri Nov 20 · no Action needed …". The day card still says "3 Trades · 1 Mark, 2 expirations to settle and 1 Action to go", and XYZ's line still reads "Expired: settle · To do: Settle". It is the same when MNO is recorded the next day ("1 expiration to settle").
   - This is the expiration twin of Critic B3's standing item for a closing sale. Nothing is lost, and "Back to the Review" corrects it.

No flow failed its pass condition, and no figure was wrong.

## 4. Minor observations

- **Short contract wording.** An in-the-money short reads "Worth $400.00 at expiration: −$151.30 · −0.42R on the Trade." and "This books +$248.70 · +0.69R on a put worth $400.00." For a short, "worth" is the trader's liability. The figures are right.
- **No price, worthless.** "It expired worthless" with no Underlying Mark shows no "This books …" line, though the amount (the premium kept, +$248.70) does not depend on the Mark.
- **Expiration receipt.** The receipt in the card shows only "Reflection saved." and "Close Review owed", with no sentence on when the Close Review is due. A sale's receipt has one (W135).
- **Close Review not yet due.** The closed card offers "Write the Close Review" and "Decline…" beside "Not due until the next Review."
- **Bought out of a finished day.** In the out-of-the-money day, MNO's acknowledged-unavailable Mark belonged only to a Trade that then expired. The day reads "Complete". I think that is spec-consistent: MNO is no longer a required Instrument.
- **Reflection-only card not reached.** My JKL setup (a part sale after the close with "Say why later") stayed a walked card with an owed reflection. Its Replay worked, but I did not reach a card that owes only a reflection.
- **Still present from the known lists, not counted again:**
  - focus falls to the page body after "Can't get a price" then Cancel;
  - focus lands on a DIV after saving the Close Review from Trade Detail;
  - "Fri Nov 20 you chose Settle Later, no reason given." appears beside W144;
  - the Now box measures expired contracts;
  - the "Settlement Due: …" row values;
  - the 29-date "Missed" list;
  - "Record the sale" and "I sold: record it" prefill 17:00 (after the close), giving "…due in the Review after next";
  - "Back to BREN" puts focus on the first radio;
  - stock Marks show without "$" in the grid's previous column;
  - the "0 means it closed with no value" hint.