# D08P gate critic-6 report

(The harness blocked writing `test-results/critic-d08p-6/report.md`, so this message is the report.)

## 1. Header

- **Date and time:** Sat 2026-11-14, about 06:20 to 06:55 EST.
- **Commit:** `55d0cf5950e9fcd2332ca033ffe58d1c7be6945a` (branch `claude-opus-5.5`). The working tree was clean at start and end.
- **Versions:** Node v26.12.0; Playwright 1.63.0; Chromium 153.0.8010.12 (the `chromium` channel, persistent profiles, America/New_York, clock pinned with the suite's `launchAt`).
- **Server:** `npm run build`, then `vite preview --port 5175 --strictPort` serving `dist`. My own wrappers (`test-results/critic-d08p-6/run.sh` and `offline.sh`) started and stopped it, and every run was under `.claude/scripts/with-browser-lock.sh`. Ports 5175, 9341 and 9342 were free before the first run and after the last. No server of mine is left running.
- **Setup helpers (starting states only):**
  - O-C3 with section 5's Marks and Journal: `buildOc3`.
  - Plans, entries and Marks: `onboardedAt`, `confirmOptionPlan`/`fillOptionPlan`, `recordOptionEntry`, `createTrades(FOUR_TRADES)`, `createTradeAt`, `enterMark`.
  - Closing: `fillOptionExit` with `closeTheTrade`, and `recordExpiration` (only to fill the form after I pressed Record expiration in Needs you myself).
  - Other: `writeIntegrityFixture(UnknownPlannedLeg)`, `fillDebtAnswers`, and `expectAccessible` (axe).
- **My own actions:** every action a flow names, by role and label: opening the Detail, each tab by mouse and keyboard, paging, Reflect now, Confirm Plan, reload, the offline reload and About.
- **Helpers:** none failed.
- **Files:** scripts, dumps and screenshots are under `test-results/critic-d08p-6/` (git-ignored).
- **No tracked file was edited, and no commit was made.**

## 2. Results

| Flow | Result | Key observations |
|---|---|---|
| C8P.1 State of play (O-C3, Thu Oct 15 18:00) | PASS | The rail answers all four questions without opening a drawer. **Identity:** "XYZ", "Long Call, Open", "Strike 55", "Expires Fri 18 Dec 2026 (64 days)", "Fidelity — Roth IRA", Record entry and Record exit. **P&L card:** "$218.05", "+$30.00 since Wed Oct 14", "1 of 2 contracts open". **Conditions:** "Stop nearest −$220.00 / Option at or below $1.00 / Change in Trade P&L from the Thu Oct 15 Marks if the option's Mark is $1.00 (−1.10R)." and "Target nearest +$180.00 / XYZ at or above 60.00 / … if XYZ is at 60.00 at expiration (+0.90R)." Beneath them: "Worst case: $320.00 · 1.60R if the call expires worthless" and "Max reward: Unbounded above". **Needs you:** "Position Change Reflection, Reflection owed, Due" with Reflect now. Every figure checks against section 5. |
| C8P.2 Drawers | PASS | **Tabs:** Today, Position, Plan and Risk, "Price History 1", "Journal 1 owed", Payoff, in W1's order, with Today selected. **Keyboard:** ArrowRight and ArrowLeft wrap, Home and End work, selection follows focus, the roving tabindex is correct, and Tab moves into the panel. **Mouse:** each tab shows one visible panel. **Accessibility:** axe (WCAG 2.1 A/AA) found no violations with each of the six drawers open. **Figures:** checked against the nine accepted exceptions, no figure appears twice in the Open state apart from minor observations 1 and 2. Values: Net cost $200.65, Open P&L +$119.35, Realized to date +$98.70, Incurred fees $1.95, 1R $200.00, Original reward $600.00, Reward : risk 3, Entry Quality "2.97 / planned 3". **Payoff:** one chart with Planned and Now lines and two tables. **Footer:** Fulfillment and Deviations below the drawers. |
| C8P.3 History | PASS (moderate defect D1) | **Price History:** columns Thu Oct 15, Wed Oct 14, Tue Oct 13, Mon Oct 12. The Tue cells read "—" with the accessible name "No Mark". Below: "1 session without Marks. Enter Marks in the Review", linking to /review. **Journal, page 1:** Fri Oct 16 ("Session not ended yet"), "Today, Thu Oct 15", and "Yesterday, Wed Oct 14" (with the owed reflection, Reflect now and Decline). **Page 2 (via ›):** "Tue Oct 13 without Marks" (the Tue Hold), "Mon Oct 12" ($18.70, "First Mark"), and "Plan" ("Planned Mon Oct 12, 9:00 am"). ‹ and › are each disabled at their end. **Gap note on a second Trade:** "Tue Oct 13 has no Marks, so Wed Oct 14 is compared with Mon Oct 12." **Reflect now in Needs you:** it selects Journal and opens the form on Wednesday's card. After Answer, the rail shows "Nothing needs you now." and the tab reads "Journal" without a reload (revision 95). |
| C8P.4 States | PASS | **Planned:** right after Confirm Plan, before any reload: "Long Call, Planned", "Expires Fri 18 Dec 2026 (67 days)", "—", "Trade P&L once the entry is recorded and marked", "0 of 2 contracts open". Tabs: Plan and Risk (selected), Journal, Payoff. The Expires line is the same after reload. **Settlement Due:** "Settlement Due: MNO 20 Nov 2026 45 Put", "Trade P&L once the expiration is recorded", and "The contract expired, so its conditions are no longer measured." The Settlement Due panel and Record expiration are in Needs you. No Today tab; Position is selected with Open P&L "Settlement Due". History ends Fri Nov 20. **Closed by expiration:** "Expired Fri 20 Nov 2026", "$248.70", "+0.69R realized, final", the Result rows, "Settlement (1)", and the "Fri Nov 20, final session" card. **Closed by sale:** "$247.40", "+1.24R realized, final", conditions on rows 1 and 2 only, no Record links, and "Now: Not applicable: no open position". **Incoherent:** the full-width "Facts can't be replayed" banner above the rail, "Not available / Trade P&L", only Position, Plan and Risk and Journal, and W13's one list. **Stock with two lots:** no strike or expiration line, "$210.00", "100 of 100 shares open", "… if XYZ's Mark is $47.50 (−1.92R).", two open lots, and "Expiration Payoff: Not applicable: no option expiration". **Before first Marks and Mark missing:** both checked; they show W3, W7, W8, W9 and W19's words. Each state matches the prototype. |
| C8P.5 Narrow | PASS | Checked every state above at 375 and 320 px. The rail is the top of the page. `scrollWidth` equals `clientWidth` with every drawer open. Every condition's row 2 is one 23 px line with no overflow. The Payoff chart, Open Lots, Lot Matches and Price History scroll inside their own boxes, which T8P.26-B1 and B2 allow. |
| C8P.6 Offline and About | PASS | I loaded the Detail online, with the service worker in control, then stopped the server (a fetch to it failed). Relaunched offline and reloaded, the rail and all six drawers rendered with the same figures. About, offline, shows readiness all passed. Installed capabilities cover D1 to D7S: Workspace, ReferenceCatalog, Journal, confirmPlan (LongStock, LongCall, LongPut, CashSecuredPut, StructureValueCondition), recordPositionChange (Close, CloseReview…, Option, SellToOpen, BuyToClose, Expiration), MarketData (CorrectMark, AssertUnavailable, WithdrawAcknowledgment), DailyReview (SettlementFamily, SaveReviewMarks), and getTradeDetail (SettlementDue). D08P adds `TradeViewsAndReporting.replayTrade` and `MarketData.query (… ReadSeries)`. |
| Narrow-layout check | PASS | No page-level sideways scroll at 375 or 320 px in any state or drawer, and no condition row 2 wraps. |

## 3. Overall: PASS, with one moderate defect

All six flows meet their pass conditions.

### Defects

**D1. Journal paging drops keyboard focus to the page body at either end (moderate).**
- **Steps:**
  1. Open O-C3's Detail at Thu Oct 15 18:00, with the Journal drawer selected.
  2. Focus "Earlier sessions" (›) and press Enter. The last page shows and › becomes disabled.
  3. Focus "Newer sessions" (‹) and press Enter. The first page shows and ‹ becomes disabled.
- **Expected:** focus stays on a logical element, such as the other paging button or the cards list. Sources:
  - `specs/design/ui-contract.md`: "Keyboard focus is visible and logical"; "logical focus after navigation".
  - AC-UI-002: "focus/order/names/roles are coherent".
  - The breakdown's B8P.5: "the cockpit by keyboard".
- **Actual:** in both cases `document.activeElement` becomes `BODY` as soon as the pressed button disables itself. The next Tab starts again from the top of the document.
- **Severity:** moderate (an accessibility failure; the flow still passes).

## 4. Minor observations

1. **C8P.2, Payoff.**
   - The sentence "If XYZ is at 57.90 at expiration: +$188.05" repeats the latest XYZ Mark, which Today's comparison also shows.
   - The Current table's caption "… including +$98.70 realized to date" repeats Position's Realized to date.

   Both are existing D7 wording, but neither is in the accepted-exception list.
2. **C8P.2, Mark missing (stock Trade at Tue Oct 13 18:00, Tue Mark missing).**
   - The Trade P&L at the Mon Marks ($29.00) appears in three places: Today's "At the Mon Oct 12 Marks" block ("Open P&L +$29.00", "Current Marked Trade P&L +$29.00 · +0.12R"), Price History's Mon column, and the Journal's Mon card.
   - Exception 2 covers only Price History's latest session, which here is the Tue gap.
   - Exception 8 covers the dated block's Mark, fees and realized figure, not its P&L.
   - The notice "Mark missing for XYZ on Tue Oct 13" also appears both in Needs you and at the top of Today.
3. **Settlement Due, open count.** The P&L card has no open-count line. The prototype shows "1 of 2 contracts open" there, but W4 doesn't require it.
4. **Settlement Due, repeated reason.** "Settlement Due: MNO 20 Nov 2026 45 Put" appears at the `figure` length in four places: the P&L card, Plan and Risk's Risk to stop, Plan and Risk's Reward to target, and Payoff's "Value at expiration at MNO's latest Mark". Each is its own figure, so A222 is arguably met, but the prototype says such figures "say why once".
5. **Settlement Due, Expected Mark Date.** The Position drawer shows "Expected Mark Date: Mon Nov 23", although A212 says no Mark falls due for the expired contract.
6. **Before first Marks, two phrasings.** Today, Position and Plan and Risk say "Awaiting the close after Fri Oct 9" (P102 keeps "Awaiting close"). The rail and Needs you say "once the Mon Oct 12 session ends". Both describe the same moment.
7. **Narrow widths.** At 320 px, Open Lots shows only its Opened column until scrolled inside its box. At 375 and 320 px, the Payoff chart shows only its left edge, with the strike and the Now legend out of view until scrolled. Both are allowed by B1 and B2.
8. **Price History table name.** The table element has no accessible name of its own; only its region is named.
9. **Journal page length.** At 1280 × 900, Thursday's full Daily Trade Review (four "Not answered" rows) makes Journal page 1 about 1.5 screens tall. It still pages by about a screen's worth of cards.
