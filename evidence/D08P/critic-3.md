# D08P checkpoint critic (T8P.23), critic 3

**Overall: FAIL.** C8P.1, C8P.3 and C8P.4 pass. C8P.2 fails "each figure appears once" on one repeat that is not an accepted exception (Defect 1). The narrow layout has one moderate defect (Defect 2).

**The report file was not written.** The Write tool refused `test-results/critic-d08p-3/report.md` with "Subagents should return findings as text, not write report files". I did not get around that refusal with a shell write, so this message is the report. To keep the file, save this text to that path.

## 1. Header

- **When:** 2026-11-14, about 03:00 to 03:25 EST.
- **Commit:** `0d251d22` on `claude-opus-5.5`, worktree `/Users/ckolbegger/src/trade-journal-v3/worktrees/claude-opus-5.5`.
- **Versions:** Node v26.12.0. @playwright/test 1.63.0 (playwright-core 1.64.1). Chromium 153.0.8010.12, channel `chromium`, new headless.
- **Server:**
  - `npm run build` exited 0, then `vite preview --port 5175 --strictPort` served `dist/`.
  - Every run was wrapped in `.claude/scripts/with-browser-lock.sh`.
  - Ports 5175, 9341 and 9342 were free before the session and after it, and no preview server of mine is still running.
- **Clock:** pinned with the suite's `launchAt` (America/New_York).
- **Files:**
  - No tracked file was edited and nothing was committed; `git status` is clean.
  - I did not read `evidence/` or any other worktree.
  - Scripts, profiles, captured text and screenshots are under `/Users/ckolbegger/src/trade-journal-v3/worktrees/claude-opus-5.5/test-results/critic-d08p-3/`, which is git-ignored.

**Fixtures.** I built each state through the UI with the suite helpers, one profile per state:

- **A:** O-C3 on OC2's four conditions, a Long Call on XYZ 18 Dec 2026 55 Call.
  - Executions: Buy 2 @ 2.00 on Mon 10-12, fee 1.30. Sell 1 @ 3.00 on Wed 10-14 at 11:00, fee 0.65, with the exit reflection deferred.
  - Marks (XYZ / call): Mon 56.00/2.10, Wed 57.40/2.90, Thu 57.90/3.20, Fri 10-16 58.20/3.40, Wed 10-21 58.80/3.75, Thu 10-22 59.10/3.90.
  - Gaps: Tue 10-13, Mon 10-19 and Tue 10-20.
  - Viewed on Thu 10-22 at 18:00.
- **P:** OC2 Planned, confirmed on Mon 09:00.
- **S:** O-S (MNO 20 Nov 2026 45 Put), sold Mon, with a Mon Mark.
  - Settlement Due when viewed Fri Nov 20 at 17:00.
  - Then I recorded the expiration in the UI (Close Review deferred). Viewed again Mon Nov 23 at 17:00, it is Closed by expiration.
- **M:**
  - Stock XYZ in two lots (60 @ 50.10 and 40 @ 50.30).
  - Stock ABC, single lot.
  - OC Long Call closed by sale (Buy 2 @ 2.00, Sell 2 @ 2.50, both on Mon).
  - Marks on Mon and Tue; viewed Tue 10-13 at 18:00.
- **I:** stock ABC made incoherent with `writeIntegrityFixture` (`UnknownPlannedLeg`).

**Helper note.** `recordOptionExit` cannot close a Trade, because it never answers "Closing the Trade". I used `openExitForm`, `fillOptionRows` and `closeTheTrade` instead. That was my misuse of a partial-exit helper, not an app fault.

## 2. Results

| Flow | Result | Key observations |
|---|---|---|
| C8P.1 State of play | PASS | The rail answers what is held, how it is doing, what is near and what needs the trader, with no drawer opened (A, 1280 px).<br><br>**Identity:** "XYZ", "Long Call, Open", "Strike 55", "Expires Fri 18 Dec 2026 (57 days)", the account, Record entry and Record exit.<br><br>**Trade P&L:** "$288.05", "+$15.00 since Wed Oct 21", "1 of 2 contracts open". Checked: 98.70 + 390 − 200.65.<br><br>**Conditions**, in Plan order:<br>• Stop "−$390.00", "XYZ at or below 48.00", row 3 ending "(−1.95R)".<br>• Stop, nearest, "−$290.00", "Option at or below $1.00", "…if the option's Mark is $1.00 (−1.45R)."<br>• Target "+$110.00" (+0.55R).<br>• Target, nearest, "+$10.00" (+0.05R).<br>• Beneath: "Worst case: $390.00 · 1.95R if the call expires worthless" and "Max reward: Unbounded above".<br><br>**Needs you:** "Position Change Reflection Reflection owed", "Due", Reflect now.<br><br>**Stock** (ABC): "$139.00", "+$40.00 since Mon Oct 12", "100 of 100 shares open", and "…from the Tue Oct 13 Mark if ABC's Mark is $28.00 (−1.70R)."<br><br>Every figure I checked by hand was right. |
| C8P.2 Drawers | Order and keyboard PASS. "Each figure once" FAIL (Defect 1). | **Tabs:** "Today, Position, Plan and Risk, Price History 3, Journal 1 owed, Payoff", with Today selected. The counts are descriptions; each tab's name stays its W1 name.<br><br>**Mouse:** I opened every drawer.<br><br>**Keyboard:** ArrowRight cycles through all six and wraps. Home, End and ArrowLeft work, focus stays on the selected tab, and Tab moves into the panel.<br><br>**Today:** "Marks: Thu Oct 22 against Wed Oct 21", provenance "Manual · 2026-10-22 17:00", changes "+0.30" and "+$0.15".<br>• Track names: "Option price: Stop $1.00, Target $4.00, now $3.90" and "XYZ: Stop 48.00, Target 60.00, now 59.10".<br>• Underlying condition lines (A223): Value at expiration $0.00 and $5.00; Distance on XYZ 11.10 and 0.90.<br><br>**Position:** Open P&L +$189.35, Realized to date +$98.70, Incurred fees $1.95.<br><br>**Plan and Risk:** Entry Quality reads "1.98 / planned 2".<br><br>**Payoff:** one chart, the sentence "If XYZ is at 59.10 at expiration: +$308.05", and both tables.<br><br>**Footer:** Fulfillment and Deviations sit below the drawers.<br><br>I saw every accepted exception and did not count it. |
| C8P.3 History | PASS | **Price History:**<br>• Columns run "Thu Oct 22 … Mon Oct 12", newest on the left.<br>• Every gap reads "—" with the name "No Mark".<br>• Trade P&L $18.70, $188.05, $218.05, $238.05, $273.05, $288.05, which matches section 5 and my arithmetic.<br>• "3 sessions without Marks. Enter Marks in the Review" is a link, and the tab reads "Price History 3".<br>• On the Closed Trade, the unheld call shows a plain "—".<br><br>**Journal:** pages 3 cards at a time with ‹ and ›, each disabled at its end:<br>1. "Fri Oct 23" (Session not ended yet), "Today, Thu Oct 22", "Yesterday, Wed Oct 21".<br>2. "Mon Oct 19 to Tue Oct 20 without Marks", Fri Oct 16, Thu Oct 15.<br>3. Wed Oct 14 ($188.05, "+$169.35 since Mon Oct 12", with the owed exit reflection), "Tue Oct 13 without Marks", Mon Oct 12 ("First Mark").<br>4. The Plan card.<br><br>**Reflect now:**<br>• It opens the Journal drawer and the form on Wednesday's card, with focus in the form.<br>• After Answer, Needs you reads "Nothing needs you now." at once, the tab becomes "Journal", and the card reads "Deferred, answered".<br>• All of this holds after a reload. |
| C8P.4 States | PASS | **Planned:** "Expires Fri 18 Dec 2026 (67 days)" shows right after confirm, before any read.<br>• P&L card: "—", "Trade P&L once the entry is recorded and marked", "0 of 2 contracts open".<br>• Tabs: Plan and Risk (selected), Journal, Payoff.<br><br>**Settlement Due:**<br>• No Expires line.<br>• P&L card: "Settlement Due: MNO 20 Nov 2026 45 Put" and "Trade P&L once the expiration is recorded".<br>• Conditions: "The contract expired, so its conditions are no longer measured."<br>• Needs you holds the panel with Record expiration.<br>• No Today drawer; Position is selected, and Open P&L reads "Settlement Due".<br>• The history ends Fri Nov 20.<br><br>**Closed by sale:** "$97.40", "+0.24R realized, final", the Result rows, conditions rows 1–2 only.<br>• Payoff reads "Now: Not applicable: no open position".<br>• The last Journal card reads "Yesterday, Mon Oct 12, final session".<br><br>**Closed by expiration:** "Expired Fri 20 Nov 2026", "$248.70", "+0.69R realized, final".<br>• The Settlement section is separate from the Executions.<br><br>**Incoherent:**<br>• The full-width banner sits above the rail.<br>• P&L card reads "Not available".<br>• No Record links.<br>• Tabs: Position, Plan and Risk, Journal.<br>• The Journal shows W13's single list.<br><br>**Stock:** no strike line, and Payoff reads "Expiration Payoff: Not applicable: no option expiration".<br><br>**Several lots:** two open lots, Opening fees $2.00, Open P&L +$130.00.<br><br>Each state matches the prototype, with the breakdown's words winning where they differ (P96, W4). |
| Narrow (375 and 320 px) | PASS, with Defect 2 | **Checked:** A at 375 and 320 px (every drawer), Settlement Due, Several lots, Incoherent and Planned.<br><br>**Results:**<br>• No sideways page scroll anywhere: `scrollWidth` equals the viewport.<br>• The rail is the top of the page, and the tabs wrap below it.<br>• Condition row 2 never wraps.<br>• Price History opens at the newest column.<br>• Journal cards stack.<br>• No console errors. |

## 3. Overall: FAIL

### Defects

**1. The Trade Summary repeats the average entry and the held quantity, which no accepted exception covers. Severity: High.** It is High by the rubric because C8P.2's pass condition fails. Nothing is misread.

- **Steps:**
  1. In profile M, open stock XYZ (two lots) at Tue Oct 13 18:00.
  2. Open the Position drawer, then the Plan and Risk drawer, and compare both with the rail.
- **Expected:** section 8's C8P.2 says "Each figure appears once, apart from these accepted exceptions (revision 97)". Exception 7 covers the average entry and quantity only in Today's At entry block before Marks.
- **Actual:**
  - The average entry shows twice: "Long 100 shares @ $50.18" in the Position drawer's Trade Summary, and "Average entry $50.18" in Plan and Risk's Entry Quality.
  - The held quantity shows three times: the Trade Summary, the Position row "100 shares of XYZ", and the rail's "100 of 100 shares open".
  - The option Trade (A) repeats it the same way: "Long 1 Dec 18 $55 Call", "Long 1 contract of XYZ 18 Dec 2026 55 Call", and "1 of 2 contracts open".
- **Note:** the Trade Summary moved there under T8P.31, in its existing words. Like exceptions 5 to 8, this may be an existing-wording repeat the user would accept. If so, it needs the user's acceptance and a row in C8P.2.

**2. At 375 and 320 px, Today's comparison table hides the current session's Marks and their change. Severity: Moderate.**

- **Steps:** in profile A at Thu Oct 22 18:00, set the width to 375 (or 320) and open the Today drawer.
- **Expected:** the drawer exists to show the current Marks against the earlier ones (W8: the columns are the earlier date, the current date, and Change). No figure should be unreadable at narrow widths (AC-UI-001, and the brief's narrow check).
- **Actual:**
  - The table is 550 px wide. Its scroll box is 301 px wide at 375 px, and 246 px at 320 px.
  - At 375 the "Thu Oct 22" column starts at x=325, but the box ends at x=338. At 320 the box ends at x=283.
  - So only the row labels and the Wed Oct 21 column show. The current Marks ($3.90 and 59.10), their provenance and the changes "+0.30" and "+$0.15" need a sideways scroll, hinted only by a faint edge shadow.
  - The box is focusable and named, so it is reachable. But the current figures are hidden by default.
  - Screenshot: `/Users/ckolbegger/src/trade-journal-v3/worktrees/claude-opus-5.5/test-results/critic-d08p-3/shots/crop-A375-today.png`.

### Minor observations (not defects)

1. **Closed by sale shows no fees outside the fold.** The Position drawer has no Incurred fees figure outside the folded Fee reconciliation, where the prototype shows fees at the top. W17 keeps the label, and the figure is reachable in the fold.
2. **Plan and Risk's distances don't say which condition they belong to.** Risk to stop and Reward to target list one value per condition ("$390.00 · 1.95R" over "$290.00 · 1.45R"). Only the order ties each value to the Plan's Stop and Target lines above.
3. **The Plan repeats the trader's own prices and the account.** The Stop and Target texts appear both in the Plan and in the rail's Conditions row 2, and the account appears both on the identity card and in the Plan. These are trader inputs, not figures, so I did not count them under C8P.2.
4. **The Payoff sentence repeats the Underlying Mark.** "If XYZ is at 59.10 at expiration: +$308.05" repeats the 59.10 that Today also shows. The value +$308.05 itself appears once.
5. **"No Mark" in the Trade P&L row.** Price History's Trade P&L gap cells take W9's gap name "No Mark", although for a P&L cell the reason is a missing Mark.
6. **"Due" twice on an owed card.** The owed Close Review's Journal card reads "Due" then "Due" (term and value, in the existing OwedDebtItem wording).
7. **A doubled region in Today.** The comparison is a region named "Marks: …" inside another region with the same name, around a table with that name too. Screen readers announce the name redundantly.
8. **Settlement Due's last session sits in a merged card.** Because Marks were missing, the final session falls inside "Tue Oct 13 to Fri Nov 20 without Marks", so no card reads "final session". After the expiration is recorded, a "Fri Nov 20, final session" card does appear.
9. **Settlement Due's Payoff differs from the prototype.** The app still draws the Current line, with "Value at expiration at MNO's latest Mark / Mark missing: MNO, Fri Nov 20". The prototype shows a single "Current: Settlement Due" line, and no approved word covers this.
10. **The nav background stops short in full-page screenshots.** At 1280 px, the left nav's background ends at the viewport height. It does not show in normal scrolling.
