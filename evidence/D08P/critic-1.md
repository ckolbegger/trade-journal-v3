# D08P checkpoint critic (T8P.23), critic-1

The tool refused to write `test-results/critic-d08p-1/report.md` ("Subagents should return findings as text"), so this message is the whole report. Overall: **FAIL** on C8P.4. C8P.1, C8P.2, C8P.3 and the narrow layout pass.

## 1. Header

- **Date:** 2026-11-13, about 21:00 to 22:00 EST
- **Commit:** `05ca870f` on `claude-opus-5.5`. The worktree was clean at the start and at the end.
- **Versions:** Node v26.12.0, Playwright 1.63.0, Chromium 153.0.8010.12 (channel `chromium`)
- **Server:** I ran `npm run build && npm run preview` (vite preview, `dist/`) on port 5175, inside `.claude/scripts/with-browser-lock.sh` for the whole session. Ports 5175, 9341 and 9342 were free before I started. The server is stopped and the ports are free again.
- **Clocks:** pinned with `pinClock` and `setClock`, America/New_York.
- **Profiles:** two persistent profiles under `test-results/critic-d08p-1/`:
  - `prof-oc3`: an O-C3-like Long Call, XYZ 18 Dec 2026 55 Call, with OC2's four conditions. Buy 2 @ 2.00 on Mon 10-12 10:00 (fee 1.30). Sell 1 @ 3.00 on Wed 10-14 11:00 (fee 0.65). Marks on Mon (56.00 and 2.10), Wed (57.40 and 2.90) and Thu (57.90 and 3.20). No Marks on Tue. Viewed at Thu 10-15 18:00.
  - `prof-states`: D7's settlement fixture, which gives:
    - T-1, XYZ Nov 20 Call, Settlement Due;
    - T-2, Long Stock XYZ;
    - T-3, MNO Nov 20 Put, whose expiration I recorded from Needs you, so it is Closed by expiration.

    I added:
    - ABC Long Stock in two lots;
    - DEF Call, closed by sale with the Close Review deferred;
    - JKL stock made incoherent with `writeIntegrityFixture` (UnknownPlannedLeg);
    - an NVDA option Plan confirmed at the viewing clock.

    All viewed at Mon 11-23 17:00.
- **Edits:** I edited no tracked file and made no commits. Scripts, screenshots and text dumps are in `test-results/critic-d08p-1/` (git-ignored). Every helper I used worked. I didn't read `evidence/` or any other worktree or branch.

## 2. Results

| Flow | Result | Key observations |
|---|---|---|
| **C8P.1 State of play** (O-C3-like, Thu Oct 15 18:00) | **PASS** | You can answer all four questions from the rail without opening a drawer. The rail is region "State of play".<br>**Identity:** "XYZ", "Long Call, Open", "Strike 55", "Expires Fri 18 Dec 2026 (64 days)" (correct), "Fidelity — Roth IRA", Record entry, Record exit.<br>**Trade P&L region:** "$218.05", "+$30.00 since Wed Oct 14", "1 of 2 contracts open". These match section 5's table.<br>**Conditions:**<br>• "Stop −$320.00 XYZ at or below 48.00 … (−1.60R)"<br>• "Stop nearest −$220.00 Option at or below $1.00 … if the option's Mark is $1.00 (−1.10R)"<br>• "Target +$180.00 … (+0.90R)"<br>• "Target nearest +$80.00 Option at or above $4.00 … (+0.40R)"<br>• "Worst case: $320.00 · 1.60R if the call expires worthless" and "Max reward: Unbounded above"<br>I checked each figure by hand against Marks of 3.20 and 57.90 and 1 contract held.<br>**Needs you:** "Nothing needs you now."<br>The card order differs from the prototype (defect 5). |
| **C8P.2 Drawers** (mouse and keyboard) | **PASS, with observations** | **Mouse:** the tabs read "Today, Position, Plan and Risk, Price History 1, Journal, Payoff", W1's order, with Today selected. Each tab click shows one visible tabpanel.<br>**Keyboard:** ArrowRight cycles through all six and wraps back to Today. Home goes to Today, End to Payoff, ArrowLeft to Journal, and Enter selects. Focus stays on the selected tab, and Tab moves on into the panel.<br>**Exceptions seen as accepted:** Price History's Thu column and the Journal cards' Marks (57.90 and $3.20). Risk to stop and Reward to target appear both in Plan and Risk ("$320.00 · 1.60R / $220.00 · 1.10R"; "$180.00 · 0.90R / $80.00 · 0.40R") and on the rail.<br>**Other figures shown twice** are listed under minor observations 1 to 3. Two of them are required by approved words or existing captions. |
| **C8P.3 History** | **PASS** | **Price History:**<br>• columns "Thu Oct 15 | Wed Oct 14 | Tue Oct 13 | Mon Oct 12", newest on the left;<br>• rows "XYZ Mark", "Call Mark" and "Trade P&L" ($218.05, $188.05, —, $18.70);<br>• each Tue cell is "—" with the accessible name "No Mark";<br>• "1 session without Marks. Enter Marks in the Review", linking to `/review`.<br>**Journal:** "Sessions, newest first". Page 1: "Fri Oct 16 / Session not ended yet", then "Today, Thu Oct 15" ($218.05, +$30.00 since Wed Oct 14), then "Yesterday, Wed Oct 14" (+$169.35 since Mon Oct 12, with the exit's reflection). Page 2 (›): "Tue Oct 13 without Marks", then "Mon Oct 12" ("First Mark", entry reflection), then the Plan card "Planned Mon Oct 12, 9:00 am".<br>**Paging:** ‹ is disabled on page 1 and › on the last page. That is 3 cards per page, about 1.4 screens at 900 px.<br>**Merged run:** D7's Settlement Due fixture shows "Mon Oct 12 to Mon Nov 23 without Marks" (W11). |
| **C8P.4 States** | **FAIL** | **Planned (NVDA):** right after Confirm Plan, before any reload, the card shows "Expires Fri 18 Dec 2026 (25 days)", and it still does after a reload. It shows "—", "Trade P&L once the entry is recorded and marked", "0 of 2 contracts open", the conditions without figures, and "Distances to each condition arrive with the first Marks after entry." The tabs are Plan and Risk, Journal and Payoff. Payoff shows "Now: Not applicable: no open position". The Journal is the old list, not the Plan card (defect 7).<br>**Settlement Due (XYZ Nov 20 Call):**<br>• the panel is in Needs you, with Record expiration;<br>• P&L: "Settlement Due: XYZ 20 Nov 2026 55 Call" / "Trade P&L once the expiration is recorded";<br>• the rail says "The contract expired, so its conditions are no longer measured.";<br>• Position: "Open P&L Settlement Due";<br>• Payoff: "Value at expiration at XYZ's latest Mark: Settlement Due: …" (W18);<br>• no expiration line on the identity card, as in the prototype.<br>The panel is broken at 1280 px (defect 2), and the Position drawer carries condition figures for an expired contract (defect 3).<br>**Closed by sale (DEF):** "Long Call, Closed" with no expiration line. "$97.40", "+0.49R realized, final". Terminal Disposition, Option Disposition Timing and Close Reason. Needs you: "Close Review Reflection owed / Due / Reflect now". Reflect now selects Journal and opens the form. Answering takes the debt off Needs you at once, and it stays off after a reload.<br>**Closed by expiration (MNO Put):** "Expired Fri 20 Nov 2026", "$248.70", "+0.69R realized, final", "Closed via expiration of 2 contracts". The Position drawer lists "Settlement (1)" apart from "Executions (1)".<br>**On both Closed states,** the Result figures appear twice (defect 1).<br>**Incoherent (JKL):** the "Facts can't be replayed" banner runs across the page above the rail. The tabs are Position, Plan and Risk and Journal. P&L "Not available / Trade P&L". No Record links. The Journal is W13's one card ("Every entry, newest first"). There is no Conditions card (defect 6).<br>**Stock (XYZ, Mark missing on Mon Nov 23):** "Long Stock, Open" with no strike or expiration line. "Mark missing: XYZ, Mon Nov 23" and "100 of 100 shares open". The Needs you link "Mark missing for XYZ on Mon Nov 23" goes to the Review. Payoff: "Expiration Payoff: Not applicable: no option expiration".<br>**Several lots (ABC):** Open Lots lists 60 @ $30.00 and 40 @ $30.50. |
| **Narrow layout** (375 and 320 px: O-C3 at both; Settlement Due, Closed by sale, Planned and incoherent at 320) | **PASS** | Every state and every drawer screenshot is exactly the viewport width, so there is no sideways page scroll. The rail becomes the top of the page, then the tabs wrap onto several rows, then the drawer. Condition row 2 ("Option at or below $1.00") stays on one line. At 320 px the Settlement Due panel stacks into one readable column. Tables (Today's comparison, Price History, Open Lots, Lot Matches) scroll inside their own containers, so Today's "Thu Oct 15" and "Change" columns are off-screen until you scroll the table. |

## 3. Overall: **FAIL** (C8P.4)

### Defects

**1. High. On a Closed Detail, the Result figures appear twice: in the rail's P&L card and in the Position drawer's "Result" region.**
- **Steps:** open the DEF Trade (Closed by sale), or the MNO Put (Closed by expiration). Position is the default drawer.
- **Expected:**
  - W4 puts "the realized P&L, '+1.10R realized, final', then the Result rows" on the rail.
  - C8P.2 says each figure appears once.
  - The prototype's Closed-by-sale and Closed-by-expiration Position drawers hold only fees, Lot Matches, Settlement and Executions. They have no Result.
- **Actual:**
  - Rail: "$97.40", "+0.49R realized, final", "Terminal Disposition Closed via sale of 2 contracts", "Option Disposition Timing Fully disposed before expiration: 2 before expiration, 0 at expiration", "Close Reason Target Reached".
  - Position drawer, region "Result": "Realized P&L +$97.40", "Realized R +0.49R", and the same three rows again.
  - On MNO: "$248.70 / +0.69R" and both disposition rows, twice.
- **Severity:** I rate it high because a flow fails its pass condition (C8P.4, and C8P.2's one-place rule). No figure is wrong.

**2. Moderate. At 1280 px, the Settlement Due panel's values in Needs you break mid-word.**
- **Steps:** open the XYZ Nov 20 Call at Mon Nov 23 17:00 at 1280 px wide (screenshot `test-results/critic-d08p-1/st-settle-1280-drawer0.png`).
- **Expected:** A224 and W7 say the panel keeps its words and stays legible. UI contract: figures shown in full.
- **Actual:**
  - The two-column figure grid is squeezed into the 320 px rail.
  - "Long 1 contract" wraps as "Long / 1 / contr / act".
  - "Fri Nov 20, 16:00" wraps as "Fri / No / v / 20, / 16: / 00".
  - "XYZ 20 Nov 2026 55 Call" takes six lines.
- At 320 px it stacks and reads fine.
- **Severity:** moderate, because the layout makes figures hard to read.

**3. Moderate. The Settlement Due Position drawer shows condition and entry figures that the rail says are no longer measured, plus empty price tracks.**
- **Steps:** same Trade, Position drawer.
- **Expected:**
  - W6 for Settlement Due: "The contract expired, so its conditions are no longer measured."
  - T8P.31 sends only Valuation's current Marks, missing-Mark context and Expected Mark Date to Position on a state without Today.
  - The prototype's Settlement Due Position drawer holds only lots, Open P&L "Settlement Due", Realized, fees and Executions.
- **Actual:**
  - "Expected Mark Date Mon Nov 23".
  - "Where the prices sit": an "Option price" track with only an "entry" marker, and an "XYZ" track with no markers.
  - "Stop on XYZ: Value at expiration $0.00, Distance on XYZ —".
  - "Target on XYZ: Value at expiration $5.00, Distance on XYZ —".
  - An "At entry" block: "Quantity 1 contract, Average entry $1.90, Risk from entry $190.00 · 0.48R, Reward from entry $310.00 · 0.78R".

  On the same Detail, Plan and Risk's Entry Quality says "Average entry $2.00". So one label carries two different figures. The rail meanwhile says the conditions are no longer measured.
- **Severity:** moderate, because the drawer misleads.

**4. Moderate. Tables in the Position drawer are hard to read at desktop width.**
- **Steps:** open the O-C3 Position drawer at 1280 px (`test-results/critic-d08p-1/oc3-1280-drawer1.png`). The Settlement Due and Closed Details show the same.
- **Expected:** figures shown in full and readable (UI contract). The prototype gives Lot Matches spaced columns.
- **Actual:**
  - The Lot Matches table has no cell spacing. It reads "$2.00 on 2026-10-12 10:00 $3.00 on 2026-10-14 11:00 1 +$98.70", with the headers "Quantity Realized" run together.
  - It also shows a visible caption "Lot Matches" under the "LOT MATCHES" heading.
  - Open Lots' fourth column is cut off at "UNCONSUMED OPENI…", and its figure ($0.65) is hidden at 1280 px until you scroll the table sideways.
- **Severity:** moderate, because the layout hides a figure and makes others misreadable.

**5. Low. The rail's card order differs from the prototype and from T8P.5's case title.**
- **Steps:** open any Detail.
- **Expected:** T8P.5: "the rail with the identity, P&L, Conditions and Needs you cards". The prototype's C. Cockpit has the same order. P96 says the prototype wins for layout.
- **Actual:** identity, **Needs you**, P&L, Conditions (`src/ui/screens/trade-detail/Cockpit.tsx` lines 128 to 131). None of the plan text I read records this change.
- **Severity:** low.

**6. Low. An incoherent Detail has no Conditions card.**
- **Steps:** open JKL (UnknownPlannedLeg).
- **Expected:** the prototype's "Facts can't be replayed" state lists the Plan's conditions on the rail, without figures.
- **Actual:** the rail holds identity, Needs you and the P&L card only. JKL's Stop $19.00 and Target $30.00 are visible only in Plan and Risk.
- **Severity:** low.

**7. Low. A Planned Detail's Journal drawer is the old list, not W11's Plan card.**
- **Steps:** confirm an option Plan, then open Journal.
- **Expected:**
  - W11: "Plan card: 'Planned Thu Nov 12, 1:40 pm', heading 'Plan'". The prototype's Planned state shows that card.
  - T8P.22's revision-96 note says the old Plan Reflection region goes with the old list.
- **Actual:** a "Plan Reflection" region with the four answers. There is no "Planned …" line and no "Plan" card.
- **Severity:** low.

**8. Low. An unavailable figure shows as a bare "—" with no reason.**
- **Steps:** open the stock XYZ (Mark missing on Mon Nov 23) and go to Plan and Risk. Or open the Settlement Due Call's Plan and Risk or Position drawer.
- **Expected:** A222 says an Unavailable or Not Applicable figure shows its reason. The rail does this: "Mark missing".
- **Actual:** "Risk to stop —" and "Reward to target —" on both Trades. "Distance on XYZ —" on the Settlement Due Trade.
- **Severity:** low, because the rail gives the reason elsewhere.

## 4. Minor observations

1. **C8P.2, Journal card against the rail (W10 conflict).** Today's Journal card repeats the rail's "$218.05" and "+$30.00 since Wed Oct 14". W10 requires each card to carry its Trade P&L and change, but the brief's exception 1 names only the cards' Marks. This is a plan conflict for the user to settle, not an implementation slip.
2. **C8P.2, realized and reward : risk figures.** "Realized to date +$98.70" (Position) appears again in the Payoff's existing caption "Current payoff at expiration … including +$98.70 realized to date". Plan Baseline's "Reward : risk 2" appears again as Entry Quality's "planned 2".
3. **C8P.2, "Average entry" before Marks.** On a Trade with no Marks, Today's "At entry" repeats Entry Quality's "Average entry". On ABC, "$30.20" appears three times: Today, the Position summary "Long 100 shares @ $30.20", and Entry Quality.
4. **The Price History tab count.** The count ("1", "31") is exposed only as the tab's description, a bare number. The Price History table has no accessible name.
5. **Nested Marks regions.** The Today comparison nests two regions with the same name, "Marks: Thu Oct 15 against Wed Oct 14".
6. **Reflect now and focus.** Reflect now in Needs you leaves focus on the rail button, while the form opens in the Journal drawer.
7. **A Settlement Due Trade's history after expiration.** Price History runs to Mon Nov 23, past the Fri Nov 20 expiration, so the expired call's sessions after expiration count as "without Marks" (31). The prototype ends at the last session the contract traded, but A212 says the history runs to the Expected Mark Date, so this may be intended. The Journal also shows "Tue Nov 24 — Session not ended yet. Its Marks are due once this session ends." for a contract that has expired.
8. **Owed Debt words.** An owed Debt's due text is "Due" on its own. That is the existing `DUE_TEXT.Due` word for an overdue Debt, not W7's example "Due in the next Review". The Journal card shows it as "Due / Due".
9. **Open-contract count.** The Settlement Due and Closed P&L cards don't carry the prototype's "1 of 2 contracts open" or "0 of 2 contracts open" line. W4 doesn't require it.
10. **A Trade Summary line outside any card.** The Position drawer's summary line ("Long 1 Dec 18 $55 Call", in a different contract format from elsewhere) sits right-aligned with no label. On Closed Details it floats above the Result card.
11. **My fixture.** I built the ABC fixture with D1's Plan prices (entry 50, Stop 47.50) and filled it at 30. So its "entry at or beyond the Stop" and slippage figures come from my fixture, not from a defect.
