# D4 browser critic report (critic-1, gate T4.34)

Saved verbatim from the critic's final message by the main session.

### 1. Header
- **Date and time:** Thu 2026-10-29, about 15:50 EDT.
- **Commit:** `d08b5e37aabe89c201f2cb25bf705bba07110919` (branch claude-opus-5.5).
- **Versions:** Node v26.12.0, Playwright 1.63.0, Chromium 153.0.8010.12. All runs used timezone America/New_York.
- **Servers used, all on port 5175, one at a time, each stopped afterwards:**
  - `npm run build && npm run preview` for C4.1–C4.5, C4.9, C4.12 and the narrow checks. Dates were pinned with `launchAt`/`pinClock`, which also patch Temporal.
  - `npm run build:faults && npm run preview:faults` with `?clock=` for C4.6, C4.7, C4.8 and C4.11, plus extra checks: a mid-session refused write, and dates outside coverage.
  - `npm run build:releases`, then `npm run serve:releases -- d2`, switched to d4 by sending key 6, for C4.10.
  - The process listening on 5174 was not mine and was left alone.
- **Tracked files:** none edited. `git status --short` is empty. Scratch scripts, profiles and screenshots are in `test-results/critic-d04-1/`.
- **Helpers:** no setup helper failed. Every date shown on screen matched the pinned time. For example, a Mark saved under `?clock=2026-10-13T16:00:00Z` showed "Saved 2026-10-13 12:00".

### 2. Results

| Flow | Result | Key observations |
|---|---|---|
| C4.1 First Review | **FAIL** | **Passed:** Marks come first; the only h2 before Continue is "Marks", with "Today's Marks" for ABC and XYZ. After XYZ 52.00, ABC 31.00 and Continue to Trades: XYZ is "Quantified pressure · 31% of the way from entry to the Target", then ABC at 17%. XYZ's form opens with Hold checked. One press of Save gives "Action saved", and ABC's form opens straight away. ABC saved as Exit with Intent. The status then reads "Complete" and "Every Trade has an Action." Stored state: 2 observations, 2 Action Entries (Hold, and Exit with Intent), no Trade fact added. **Failed:** the Trade's figures show only "Current Marked Trade P&L +$180.00 · +0.72R", "Ongoing Risk to Stop $450.00" and "Incremental Reward to Target $400.00". There is no worst case, and risk and reward carry no R (Defect 1). |
| C4.2 Attention order | PASS | Six Trades marked at Monday 17:00. Order and reasons: 1. BRK "Boundary reached · Stop breached"; 2. MIS "Evidence limited · Mark missing for MIS on Mon Oct 12"; 3. HI "Quantified pressure · 70% of the way from entry to the Target"; 4. LOS "50% of the way from entry to the Stop"; 5. WIN "50% of the way from entry to the Target"; 6. ENT "Routine · No pressure toward the Stop or the Target". At equal pressure the losing Trade comes first. |
| C4.3 Exit, Roll, Adjust | PASS | For each of Exit, Roll and Adjust: Save without Intent shows "Enter your Intent for this Action." beside "Intent (required)", sets aria-invalid, and moves focus to the field. With Intent, each saves and the Trade's card shows "Saved Action: Exit / Intent: …". The probe shows each Entry storing its option and its Intent text, and the Trade facts are byte-identical before and after. |
| C4.4 Can't get a price | PASS (see Defect 3) | Acknowledged MIS with reason "Halted; no closing print." The row shows "Acknowledged Unavailable · You said you can't get a price: …". After every Trade had an Action: "Complete with Unavailable Marks / Instruments: MIS / Trades: MIS / Not calculated: Valuation, Risk, Reward, Condition status". Withdraw gives "Incomplete", then entering 10.50 gives "Complete". The stored record keeps both acknowledgment versions (Asserted, then Withdrawn) and the Mark. |
| C4.5 Correct | PASS | Correcting WIN 33 → 34 without a reason shows "Enter the reason for the correction." with focus on the reason. With a reason, the row shows "$34.00 · Manual · Corrected: Mistyped the close." Re-entering 34.000 shows "That is already the Mark; enter a different price." The Detail shows Corrected with the reason, P&L +$399.00 · +2.00R, Risk to stop $600.00 · 3.00R and Reward to target $200.00 · 1.00R. The Open list shows +$399.00 · +2.00R. |
| C4.6 Missing and Stale | PASS | Before (Tuesday noon, faults build): Open list "Mark missing: XYZ, Mon Oct 12", linking to `/review?instrument=XYZ`, and "Fri Oct 9 close +$119.00 · +0.48R". Detail: "Mark missing for XYZ on Mon Oct 12" and "Stale context: $51.20 from Fri Oct 9 close (stale, not used in any current figure)". Every current figure reads "Mark missing: XYZ, Mon Oct 12", with an "At Fri Oct 9 close" section. The Detail link opens the Review with focus on the XYZ heading. After entering 52.00: Mark $52.00, P&L +$199.00 · +0.80R, Risk $450.00, Worst case $5,200.00, with no stale label. |
| C4.7 Bought today | PASS | After recording 40 @ 50.30 at Tuesday 10:00: P&L, risk, worst case, reward and conditions all read "Awaiting the next close". "At Mon Oct 12 close" shows +$199.00 · +0.80R, risk $450.00 and worst case $5,200.00. "At entry" shows 40 shares, average $50.30, "Risk from entry $112.00 · 0.45R" and "Reward from entry $228.00 · 0.91R", with no P&L. |
| C4.8 Skipped sessions | PASS | Under "Earlier sessions without Marks — optional", with "These sessions do not block the Review.", MNO lists Fri Oct 9 then Thu Oct 8. The Review reads "Complete" with them still unfilled. After filling both and refreshing, the group is gone. Observations exist for 10-07, 10-08, 10-09 and 10-12. |
| C4.9 Resume | PASS | Saved two Actions, half-filled a third (Roll with unsaved Intent), then reloaded. The Marks show, and after Continue the Trades show "Action saved" ×2 and "Action missing" ×2. The saved Exit appears with its Intent, Conviction 3 and Note, and Change prefills them. Still 2 Entries. The unsaved text is not stored, and Web Storage is empty. |
| C4.10 Update with migration | PASS | On d2: two Open Trades, and no Review in the navigation. Switching to d4 brings "An update is ready" with Reload, and the migration message was seen. The list then shows "Mark missing" for both Trades. The Review lists both Marks, and a Mark and a Hold Action save. About shows "Schema version 3", "Session policy nyse", revision 1, and "Calendar coverage 2024-01-01 to 2028-12-31". The probe shows one new database, the pointer moved, and no candidates. |
| C4.11 Recovery Only | PASS | With `?faults=inventory`: a read-only banner, and the Review is readable ("Complete", $51.00 · Manual, "Saved Action: Hold"). There is no Enter, Correct, Save or Change; the only buttons are "Review MNO" and "Continue to Trades". The Detail is fully readable with no Record entry. The database is unchanged. Extra check: a Save refused mid-session leaves the form on screen, disabled, with its values kept, and no Entry is written. |
| C4.12 Validation, offline, responsive, keyboard, About | PASS | −1 shows "A price cannot be negative."; 52.1234567 and "abc" show "Enter a price as a number, with at most 6 decimal places."; 0 is accepted. With the server stopped and the page reloaded, a Mark and an Action saved. After a second launch offline the Review reads Complete. An Adjust form with Intent and Note keeps its values across 1280 → 390 → 1280. Completed by keyboard with a visible 3 px blue focus outline. About lists only D1, D2 and D4 capabilities (MarketData.*, DailyReview.open (LatestCompleted), getTrade, save (SaveTradeAction)) plus the session policy rows. |
| Narrow layout, 375 and 320 px | **FAIL** (Defect 2) | No page-level horizontal scroll on the Review (both families, Mark entry, Correct form), the Open list, the Detail or About. The Open table and Detail Conditions table scroll inside their own containers, which is the accepted U1 design. On narrow, the Open list's second line reads "Net cost $3,001.00 · P&L Mark missing: ABC, Tue Oct 13 Mon Oct 12 close +$99.00 · +0.50R" with a "Mark missing" badge. The calendar icon at 320 is a 44×44 link labelled "Coming soon - update calendar" that goes to About. Outside coverage the list shows "Not available". Failure: the Action radio group renders badly at every width (Defect 2). |

### 3. Overall: **FAIL**

**Defects**

1. **The Review's Trade view omits worst case and the R of risk and reward.** Medium severity.
   - **Steps:** C4.1, Monday 17:00, XYZ Mark 52.00; Continue to Trades; Review XYZ.
   - **Expected:** C4.1's pass condition says "each Trade shows P&L, risk to stop, worst case, reward to target, and R". `specs/design/daily-review.md` (`getTrade`) says it returns "valuation/risk/payoff results".
   - **Actual:** only "Current Marked Trade P&L +$180.00 · +0.72R", "Ongoing Risk to Stop $450.00" and "Incremental Reward to Target $400.00" appear. Worst-Case Ongoing Risk ($5,200.00) is not shown, and risk and reward have no Plan-R (should be 1.80R and 1.60R). The same holds for every Trade in C4.2 and C4.10. The Detail does show all of these.

2. **The Action radio group's layout is broken: each radio is stretched to the form's width, apart from its label.** Medium-low severity.
   - **Steps:** open any Action form, at 1280, 375 or 320 px.
   - **Expected:** a usable radio group whose labels sit with their radios on phone widths. The UI contract ("Forms and evidence capture") says "Single-choice Prompt chips behave as a radio group" and "Touch targets and spacing support phone use". The rest of the app uses compact chips, such as the Plan's Conviction 1–5.
   - **Actual:** the computed width of each radio input is 311 px at 375 (full width) and its height 44 px. The circle is centred on its own row and its label ("Hold", "Exit"…) sits at the left of the next line, so each label reads as belonging to the circle below it.
   - **Screenshots:** `test-results/critic-d04-1/n-c42-320-actionform.png` and `c412-focus-radio.png`.

3. **The "Can't get a price" form shows the wrong validation message.** Low severity.
   - **Steps:** Review, Can't get a price, then Save acknowledgment with no reason.
   - **Expected:** a message about the acknowledgment's reason. The UI contract requires "understandable validation", and A35 calls this a reason for asserting unavailable.
   - **Actual:** "Enter the reason for the correction." There is no correction involved.

4. **The Intent field does not show its prompt text.** Low severity.
   - **Steps:** open any Action form.
   - **Expected:** the Entry Definition's prompt "Why are you taking this action?" (`specs/design/journal.md` line 84). The UI contract says "The UI renders the exact Entry Definition revision loaded for a form", and the brief's recent decision names this prompt for Intent.
   - **Actual:** the field is labelled "Intent (optional)" or "Intent (required)", and the question appears nowhere on the form. The other prompts do show their exact texts, and the Trade Detail's Journal shows "Why are you taking this action?" for the same answer.

### 4. Minor observations
- After a Mark is saved, the Review status keeps listing "Mark missing for … on Mon Oct 12" until Continue to Trades is pressed. This matches A48 (no automatic read), but the header looks stale.
- R sign lost in rounding: a Trade marked at entry shows "−$1.00 · 0.00R", so the R figure loses the minus sign the dollar figure has.
- After a save while another Instrument's Mark is still Missing, the walk shows "A Mark is needed before the next Trade. It is listed under Marks." even when the next Trade in order has its Mark.
- Review outside coverage (faults build, `?clock=2029-01-03T21:00:00Z`): the Review shows only the generic "We couldn't load the Review. Nothing was changed. Retry". It does not say that the calendar needs an update, and Retry cannot help. The list and Detail correctly read "Not available", and the shell icon "Coming soon - update calendar" is present.
- Warning icons look alike: the calendar warning and the storage warning are the same triangle icon side by side. They differ only by accessible name and tooltip.
- "Conviction now" is a select: it is rendered as a combobox, whereas the Plan's Conviction uses 1–5 chips. The input form is inconsistent; the answer is not affected.
- Date wraps at 320 px: on About, "2024-01-01 to 2028-12-31" breaks inside the date ("2028-12-" / "31").
- Trades walk after a reload: the Trades family appears only after Continue to Trades is pressed again. Saved progress is intact.
- Review headings in innerText: `innerText` gives "marks" and "trades" in lowercase while the screen shows "MARKS". This comes from CSS only; the accessible names are "Marks" and "Trades".
