# Test dedup structural record

## TD.1 — Replay chart key and Plan block (BD5, BD9)

Spec counts (cases run) before and after, `.claude/scripts/with-browser-lock.sh npm run test:e2e:specs -- e2e/d9ar/chart.spec.ts e2e/d9ar/readout.spec.ts e2e/d9ar/sweep.spec.ts`:

| File | Before | After |
|---|---|---|
| e2e/d9ar/chart.spec.ts | 16 | 15 |
| e2e/d9ar/readout.spec.ts | 19 | 16 |
| e2e/d9ar/sweep.spec.ts | 4 | 4 |
| Total | 39 passed | 35 passed |

Removed cases:
- e2e/d9ar/chart.spec.ts, "should name the shaded No Mark column in the key on R-CORV-D" (BD5). Its checks live in "should shade the session with no Mark on R-CORV-D, join nothing across it and flag the Target reached". Moved: the key contains "No Mark" on Wed 11-11, then one session back (ArrowLeft) on Tue 11-10. The one shaded column count was already in the kept case. Its comment about W66 went with it.
- e2e/d9ar/readout.spec.ts, "should keep every figure in the Plan block on one line, sign with its number, at 375 and 320" (BD9; loop of 3: BREN, AXIO, CORV). Its checks live in e2e/d9ar/sweep.spec.ts "should find no broken or unmarked figure anywhere in the replay at any session" (unchanged); nothing moved. Removed with it: the loop's `places` data, `brokenPlanFigures` and the describe block "T9AR.24-B12 Figures in the Plan block". No import became unused (STRAY and the others are still used by the B2 helper and cases).

Cases kept: none (both confirmed after reading kept and dropped cases in full).

Mutation checks of the moved key checks: see evidence/Test-Dedup/tdd-log.md, TD.1.

References (rule 10): rg of both titles found living text only in the plan itself. History, left as written: evidence/D09AR/tdd-log/T9AR.23.md:18 (chart case), evidence/D09AR/tdd-log/T9AR.24-B12.md:7 and evidence/D09AR/structural.md:990 (Plan block case; sweep:24 now holds it, kept case "should find no broken or unmarked figure anywhere in the replay at any session"). plan/acceptance-matrix.md, plan/spec-map.md and plan/bug-tasks.md: no reference, nothing re-pointed.

## TD.2 — Journal paging and Settlement Due Today (BD14, BD17)

Spec counts (cases run) before and after, `.claude/scripts/with-browser-lock.sh npm run test:e2e:specs -- e2e/d8p/history.spec.ts e2e/d8p/states.spec.ts e2e/d8r/history.spec.ts e2e/d8r/states.spec.ts`:

| File | Before | After |
|---|---|---|
| e2e/d8p/history.spec.ts | 3 | 2 |
| e2e/d8p/states.spec.ts | 3 | 3 |
| e2e/d8r/history.spec.ts | 1 | 1 |
| e2e/d8r/states.spec.ts | 4 | 3 |
| Total | 11 passed | 9 passed |

Removed cases:
- e2e/d8p/history.spec.ts:135, "should keep keyboard focus on a paging button when paging to either end of the Journal" (BD14). Its checks live in e2e/d8r/history.spec.ts "should show each Mark cell with its provenance ... paged by keyboard with focus kept on a paging button" (last step, same keys and same assertions; same buildOc3 Trade at Thursday 18:00). Nothing moved. The comment in d8r/history.spec.ts that said the case was also in d8p now says it was removed as a duplicate.
- e2e/d8r/states.spec.ts:35, "should show Today on O-S2X Settlement Due with "Expired Fri Nov 20", then Closed by expiration with "Expired Fri Nov 20" as its column and the "Closed" stamp" (BD17). Its checks live in e2e/d8p/states.spec.ts "should show a Settlement Due Detail with Today selected and Settlement Due in the P&L card, then the expired put Closed via expiration with its Result rows". Confirm-first held: both build the same Trade (OS plan, 2 short MNO puts at 1.25, fee 1.30, entered Mon Oct 12 10:00, expiring Fri Nov 20), view it Mon Nov 23 17:00 as Settlement Due, then record the expiration. Moved into the kept case: "Where the prices sit" absent while Settlement Due; "Expired" appears once in Today; "Closed" absent while Settlement Due; the Closed stamp is in the accessibility tree (ariaSnapshot) and has no aria-hidden ancestor; MNO Mark Today cell empty after Closed; Put Mark Change cell "—" in both states. Imports ALL_DRAWERS, buildOs2x and recordExpiration became unused in d8r/states.spec.ts and were removed; expectClosedStamp stays (the K1 case uses it).
- Not moved, because the kept case already holds an equal check: the six-drawer list (kept case asserts the same list with a regex for the Journal owed count), the three Marks headings, the "Expired Fri Nov 20" accessible name and "Expired" text on Put Mark, Yesterday's "Expired" cell, the Closed lifecycle badge. Not moved, no counterpart in the kept case and not in the plan's list: the row labels ["MNO Mark", "Put Mark"] and the Yesterday cell's accessible name after Closed.

Cases kept: none (both confirmed after reading kept and dropped cases in full).

Mutation checks of the moved checks: see evidence/Test-Dedup/tdd-log.md, TD.2.

References (rule 10): rg of both titles and of the spec paths found living text only in the plan itself (and unrelated line mentions of d8p/history.spec.ts and d8r/states.spec.ts that do not name the removed cases). Nothing re-pointed in plan/acceptance-matrix.md, plan/spec-map.md or plan/bug-tasks.md. History, left as written: suite-run outputs naming d8p/history:135 (evidence/D95/suite-runs/t95.13-slip-questions-browser-*).

## TD.2-F1 — checks the dropped TD.2 case had that TD.2 did not move

Dropped case (already removed in TD.2, commit 0944322e): e2e/d8r/states.spec.ts "should show Today on O-S2X Settlement Due with "Expired Fri Nov 20", then Closed by expiration ...". Read in full with `git show 0944322e^:e2e/d8r/states.spec.ts`. No case removed in this task.

Spec counts, `.claude/scripts/with-browser-lock.sh npm run test:e2e:specs -- e2e/d8p/states.spec.ts`: before 3 passed, after 3 passed (two assertions added to an existing case).

Two unmoved checks, each searched with rg over e2e/ (Put Mark, MNO Mark, tbody th, Yesterday):
1. Row labels ["MNO Mark", "Put Mark"] of the Marks table. No living case asserts the labels of a put Trade's Marks table: d8r/states.spec.ts and d8r/today.spec.ts assert ["NVDA Mark", "Call Mark"] and ["XYZ Mark", "Call Mark"] (calls on stock Trades); d9ar and d9 gaps use "Put Mark" only in the replay readout, a different component. Moved into the kept case "should show a Settlement Due Detail with Today selected ...", after the three Marks headings (Settlement Due state).
2. The Yesterday cell's accessible name "Expired Fri Nov 20" after Closed. The kept case asserted only its text "Expired"; no other living case asserts this name in the Closed state (the Today-cell name is asserted while Settlement Due). Moved into the kept case, right after the Yesterday cell's text check.

Cases kept: none. References (rule 10): rg of the dropped title found living text only in the plan itself; nothing re-pointed. Mutation checks: see evidence/Test-Dedup/tdd-log.md, TD.2-F1.

## TD.3 — Replay sizes, phone words, tap, and the bottom navigation (BD2, BD3, BD16, d9/responsive-a11y:168)

Spec counts (cases run), `.claude/scripts/with-browser-lock.sh npm run test:e2e:specs -- e2e/d9/responsive-a11y.spec.ts e2e/d9ar/responsive-a11y.spec.ts`:

| File | Before | After |
|---|---|---|
| e2e/d9/responsive-a11y.spec.ts | 5 | deleted (empty) |
| e2e/d9ar/responsive-a11y.spec.ts | 19 | 18 (run alone) |
| Total | 24 passed | 18 passed |

Removed cases, all in e2e/d9/responsive-a11y.spec.ts (the file is deleted; nothing in e2e/, package.json or .claude/scripts named it):
- :130 "should fit the Detail replay on one screen at 1280, 375 and 320 px with no sideways scroll and no WCAG violation, keeping the session across a resize" (BD3). Kept: d9ar "should fit the Detail overlay on one screen at every size, keeping the session across each resize".
- :138 "should fit the Review card replay on one screen at 1280 and 375 px ..." (BD3). Kept: d9ar "should fit the Review card’s overlay on one screen at every size, ...".
- :151 "should fit the Review card replay at 320 px with no sideways scroll" (BD3). Kept: the same d9ar Review card case (320 is one of its sizes) and the d9ar 320 loop "should fit the Detail/Review card overlay’s header, headline and both charts on one 320 by 667 screen".
- :168 "should keep a focused replay control clear of the bottom navigation on a phone" (answer 4). Kept as a moved check, see below.
- :208 "should use the phone words in both charts at 375 and 320 px" (BD2). Kept: d9ar Detail and Review card cases (`expectPhoneLabels` at 375 and 320).
- d9ar:279 "should leave no hover box after a tap on a session" (BD16). Kept: d9ar "should move the slider by a tap on a session and a tap on a card’s heading".

Confirm-first (BD3) held: d9ar's `throughSizes` runs the same sizes and the same per-size checks on the same Trade (R-BREN-U, slider moved to Thu Nov 12), on both surfaces, at 1280, 1440, 1920, 375, 320.

Moved checks (each with its mutation in evidence/Test-Dedup/tdd-log.md, TD.3):
1. `expectPhoneLabels` (runs on both surfaces at 375 and 320): price chart text contains "BREN price"; P&L chart text contains "Trade P&L"; price text lacks "one Mark per session"; P&L text lacks "dollars for the whole Position"; every strip label starting "Sold" is "Sold 2"; every Risk and Reward tag starts with "$".
2. `throughSizes`, wide sizes (1280, 1440, 1920): the P&L chart text keeps "Stop +$316" and "Target +$956" on the lines (d9 asserted this at 1280 only; now at all three wide sizes).
3. `expectFocusedControlsUncovered` (new, beside `expectOverlayCoversNavigation`, called from `throughSizes` at 375 and 320 on both surfaces): Tab 40 times from Close, each focus stays in the dialog and `document.elementFromPoint` at the focused control's centre is the control or inside it; more than 3 distinct controls reached. d9:168 ran this on the Review card only; it now runs on the Detail too.
4. Tap case: after the first tap, no `hover` test id and no `rect.hover-column`; the `B9AR.7-tap-hover-box.png` screenshot is also taken there (evidence/D09AR/structural.md names it).

Every dropped assertion and where it lives:

| Dropped assertion | Now in |
|---|---|
| Slider session Thu 11-12, value "8", headline "+$982.00 · 3.03R", 9 hit buttons at each size and on return | d9ar `throughSizes` (same lines, both surfaces) |
| Header/headline/charts fit one screen, edges inside the width, chart widths over 150, charts drawn at their box's width | d9ar `expectFitsOneScreen` (support.ts). d9's height rule that subtracted the bottom navigation is obsolete (the overlay covers it) and was not moved |
| Readout values shown in full and inside the width | d9ar `expectReadoutShownInFull` |
| Chart text inside its chart (phones) | d9ar `expectChartTextInside` |
| Smallest chart text at least 10 px (phones) | d9ar `expectSmallestChartTextAtLeast` |
| No line label on the drawing; strip holds "Stop +$316", "Realized +$478", "Target +$956", "Sold 2" | d9ar `expectPhoneLabels` (existing) |
| Short titles, no long titles, "Sold 2" markers, "$" stake tags | moved, item 1 |
| Results at the lines (wide) | moved, item 2 |
| No sideways scroll; axe clean at each size | d9ar `throughSizes` (same helpers) |
| Review card at 320: open at Mon 11-16 with headline "+$988.00 · 3.05R" and the card fits one screen | the headline at open is asserted in d9ar/review.spec.ts and d9ar/overlay.spec.ts on R-BREN-U; the fit at 320 by the d9ar 320 Review card loop case |
| Review card at 1280 and 375 | d9ar Review card `throughSizes` (same sizes among its five) |
| Tab loop, nothing over a focused control, at 375 and 320 | moved, item 3 |
| "Overlay covers the bottom navigation" (what :168's comment relied on) | d9ar `expectOverlayCoversNavigation` (existing) |
| Hover box and column absent after a tap (BD16) | moved, item 4 |

Cases kept: none (all six removed).

References (rule 10): grep of the six titles found living text only in the plan itself. Re-pointed: plan/D09-trade-replay.md line 910 (AC-UI-001, AC-UI-002 command) now `npx playwright test e2e/d9ar/responsive-a11y.spec.ts` with the note "B9AR.7; since TD.3, the d9 file was removed". `.claude/scripts/acceptance-commands.sh plan/D09-trade-replay.md`: 9 commands checked, 0 failed (both rows list 18 tests). Not re-pointed, left as written: plan/D09-trade-replay.md:813 (the B9.5 test-plan row, a record of what was planned) and plan/D09A-R-stage-a-refactor.md inventory lines naming the d9 file (120s, 141, 143, 144, 506, 689, 1000s: records of the state when T9AR ran). History, left as written: evidence/D09AR/structural.md:1408, evidence/D09/structural.md:335 and :340, evidence/D09AR/tdd-log/T9AR.18-D1.md, T9AR.23.md:21, evidence/D09/tdd-log/T9.18.md, T9.18-F2.md, T9.18-F3.md, T9.19-B1.md, T9.19-B7.md.

### TD.3 ocr

gpt-6.1-sol, session a39533b9: 1 file reviewed (e2e/d9ar/responsive-a11y.spec.ts; plan, evidence and the deleted spec excluded), 0 findings. `evidence/Test-Dedup/ocr/TD.3-050d59a9.json`.

## TD.4 — How a replay ends, and No Mark said once (BD1, BD4)

Spec counts, run through with-browser-lock.sh on 5175:

| Files | Before | After |
|---|---|---|
| e2e/d9/states.spec.ts, e2e/d9ar/states.spec.ts, e2e/d9ar/overlay.spec.ts, e2e/d9ar/readout.spec.ts | 28 passed | 23 passed (d9ar states, overlay, readout only; d9/states.spec.ts deleted) |

Removed cases (5):

| File, title | Where its checks now live |
|---|---|
| e2e/d9/states.spec.ts, "should show the Replay button beside the six drawers on an Open Trade, with Today selected and no payoff line in the replay" | See the assertion table |
| e2e/d9/states.spec.ts, "should end K-sale on its sale with a Final result headline, the banked total and an Events card row, and show every drawer" | d9ar/states "should end K-sale on a Final result with its header, cards to the final session and nothing at stake" |
| e2e/d9/states.spec.ts, "should end R-DALE-U at Fri 11-20 with no Mark while Settlement Due, then with a Final result once its Expiration is recorded" | d9ar/states "should end R-DALE-U with no Mark while Settlement Due, then with a Final result and an Expiration, not an Execution, once it is recorded" |
| e2e/d9/states.spec.ts, "should show no Replay button on a Planned Trade, and Plan and Risk selected" | d9ar/states "should show no Replay button on a Planned Trade"; d8r/states "should show a Planned Trade with Plan and Risk, Journal and Payoff only, opening on Plan and Risk, with no Today" |
| e2e/d9ar/readout.spec.ts, "should show R-CORV-D at Tue 11-10 with the dash named No Mark in the Trade P&L row, and the missing Mark said once on the replay" | d9ar/states "should say No Mark once on Tue 11-10 ..."; d9/gaps "should show No Mark on Tue 11-10 with the two results kept ..." |

`e2e/d9/states.spec.ts` is deleted (it held only those four cases).

Every dropped assertion and where it lives (M = moved in this task; L = a living case that already asserts it on the same kind of Trade):

| Dropped assertion | Where |
|---|---|
| Open Trade (BREN): six drawers in order, Today selected | M: overlay "should open the overlay from the Replay button beside six drawers ..." via new support helper `expectSixDrawers` (list was there; selected tab and Today panel visible added) |
| Open Trade: Replay headline +$988.00 · 3.05R | L: the same overlay case (BREN, Mon 11-16) |
| Open Trade: readout groups How it is going / At stake from here, whole Position / Marks / Position | L: d9ar/states R-DALE-U case at Fri Nov 20 (an Open Trade, not final) asserts the same four groups |
| Open Trade: no payoff line or theory words | M: `expectNoPayoffOrTheory` (moved to d9ar/support.ts), called in the overlay case |
| K-sale: lifecycle badge "Long Call, Closed" | L: same d9ar K-sale case |
| K-sale: six drawers, Today selected | M: `expectSixDrawers` in the d9ar K-sale case |
| K-sale: slider "Fri Nov 13 · 10 of 10", headline +$1,138.00, going, stake, groups Final result / Marks / Position | L: same d9ar K-sale case |
| K-sale: readout Trade P&L and Realized +$1,138.00 | M: d9ar K-sale case |
| K-sale: chart words Realized +$478, Realized +$1,138, Sold 2 at $4.00 | M: d9ar K-sale case |
| K-sale: final session card rows | L: same d9ar K-sale case (identical list) |
| K-sale: step back to Thu Nov 12 (slider, +$982.00 · 3.03R, "Target reached, $26.00 past it.", first group How it is going) | M: d9ar K-sale case |
| K-sale: no payoff line (at Fri Nov 13 and Thu Nov 12) | M: `expectNoPayoffOrTheory`, called at both |
| R-DALE-U: Settlement Due heading; six drawers, Today selected (Settlement Due and again after recording) | M: `expectSixDrawers` twice in the d9ar R-DALE-U case; the heading was already there |
| R-DALE-U: Fri Nov 20 slider, headline "No Mark for the put on Fri Nov 20.", no Final result, groups | L: same d9ar case |
| R-DALE-U: no going line while Settlement Due | M: d9ar R-DALE-U case |
| R-DALE-U: no payoff line (Settlement Due, and after expiry) | M: `expectNoPayoffOrTheory`, called at both |
| R-DALE-U: Thu Nov 19 slider and headline +$564.00 · 0.37R | M: d9ar R-DALE-U case (after the Settlement Due screenshot, before Close) |
| R-DALE-U after expiry: slider, headline +$564.00, going, groups Final result / Marks / Position, card EventsExpired | L: same d9ar case |
| R-DALE-U after expiry: stake "Nothing is at risk and nothing is left to gain." | M: d9ar R-DALE-U case |
| R-DALE-U after expiry: "Expired" in the P&L chart | M: d9ar R-DALE-U case |
| Planned: drawers Plan and Risk, Journal, Payoff only; Today, Position, Price History absent; Plan and Risk selected | L: d8r/states Planned case (an option Long Call; asserts the same list, gone list and selected drawer) |
| Planned: no Replay button | L: d9ar/states "should show no Replay button on a Planned Trade" (button count 0) |
| Planned: no `.replay-card` | L: the same d9ar case asserts no dialog named Replay (the card is that overlay) |
| CORV Tue 11-10: slider "Tue Nov 10 · 7 of 8" | L: d9ar/states "should say No Mark once ..." |
| CORV: readout does not contain "Mark missing" | M: d9ar/states "should say No Mark once ..." |
| CORV: Trade P&L dash named No Mark, text "—" | L: d9/gaps "should show No Mark on Tue 11-10 ..." (same assertion on R-CORV-D, same session) |
| CORV: count of /No Mark for\|Mark missing/ is 1 on the replay | M: d9ar/states "should say No Mark once ..." (its count regex widened from "No Mark for" to "No Mark for\|Mark missing"; strictly stronger) |

Moved helpers (rule 2): `expectNoPayoffOrTheory` (AC-CALC-004) and `expectSixDrawers` (the six-drawer list, selected tab, its panel shown) in e2e/d9ar/support.ts; the overlay case's own inline drawer list now calls `expectSixDrawers`.

Cases kept: none; all five removed, every "confirm first" held. Nothing failed for a real reason.

References (rule 10): `rg` of the five titles found living text only in the plan itself and unit and integration tests with similar words (src/ui/cockpit/replay/readout.props.test.ts, tests/integration/d9/lifetime.test.ts; not these titles). Re-pointed: plan/D09-trade-replay.md AC-CALC-004 row (command now `npx playwright test e2e/d9ar/states.spec.ts`, "(since TD.4)"). `.claude/scripts/acceptance-commands.sh plan/D09-trade-replay.md`: 9 commands checked, 0 failed (the AC-CALC-004 row lists 4 tests). Left as written: plan/D09-trade-replay.md line 812 (the B9.4 test-plan row, a record of what was planned), plan/D09.5-daily-review-redesign.md lines 1522, 1632, 1665 and 1902 (pasted grep counts naming `e2e/d9/states.spec.ts`, past records), and plan/D09A-R-handoff.md line 136 (a general rule), and suite-run, tdd-log and structural entries of finished tasks. package.json `test:e2e:4` runs the whole e2e/d9 folder, so the deletion needs no change there.

### TD.4 ocr

gpt-6.1-sol, session b5710bc6: 4 files reviewed (4 excluded), 0 findings. `evidence/Test-Dedup/ocr/TD.4-9f05e3de.json`.

## TD.5

Removed: e2e/d9/estimates-a11y.spec.ts, the loop case "should close the small chart on the first Escape, leave the overlay open and return the focus to the chip at ${size.width} px" (two run-time cases, 375 and 320). The loop's other case (the chart inside the overlay, no sideways scroll, axe) stays. Its header comment lost the Escape sentence.

Kept: e2e/d9/estimates.spec.ts "should show W47’s chips for R-BREN-U on Mon 11-16, each estimate tagged, and open the volatility chip’s chart by keyboard". Confirm first (375 case) held: the kept case ran green with every moved check at its default size. Cases kept: none. Nothing failed for a real reason.

Moved checks (kept case, after the first Escape, then at the end): 500 ms wait; overlay still open; focus on the chip; aria-expanded "false"; after Enter reopens the chart, Escape closes it and a second Escape closes the overlay. Mutations in tdd-log.md under TD.5.

| Dropped assertion | Where |
|---|---|
| Tab reaches the chip and the small chart is visible | L: kept case (tabToVolatilityChip, chart visible, aria-expanded "true") |
| First Escape: chart gone | L: kept case (already asserted) |
| First Escape: overlay still open | L: kept case (immediately, and now again after 500 ms) |
| Focus on the chip after 500 ms | M: kept case |
| aria-expanded "false" | M: kept case |
| Second Escape closes the overlay | M: kept case (end of the case) |

Not carried: the 375 and 320 px viewport for the Escape behaviour; the kept case runs at the default size, and the other estimates-a11y case still opens the chart at both widths.

Spec counts (e2e/d9/estimates-a11y.spec.ts + e2e/d9/estimates.spec.ts): before 8 passed, after 6 passed.

References (rule 10): rg of the title found only the plan itself. plan/D09-trade-replay.md B9.7 test-plan row (line 815) said estimates-a11y covers "Escape" and "focus returns to the chip"; re-pointed to estimates.spec.ts (since TD.5). Left as written: research/browser-test-duplicates.md, evidence/D09/structural.md (finished-task records), suite-run outputs.

## TD.6 — Readout figures on one line (BD10, BD11)

Kept: e2e/d9ar/readout.spec.ts "should keep every figure in the readout and the header on one line, sign with its number, at 1280, 1440, 1920, 375 and 320, ..." (the loop) and e2e/d9ar/sweep.spec.ts "should find no broken or unmarked figure anywhere in the replay at any session, ...". Confirm first held: the dropped loops measured the same kinds of Trade and session, and only the whole-value and grid checks below were missing from the kept case.

Removed:
- e2e/d9ar/readout.spec.ts, loop "should keep every readout figure on one line for ${where}" (5 cases: BREN Mon 11-16, BREN Wed 11-11, AXIO Mon 11-16, DALE-hold Wed 11-11, CORV Mon 11-09). Its helper `expectOneLineEach`, the `FIGURES` constant and the `expectOneLine` import went with it.
- e2e/d9/gaps.spec.ts, loop "should keep a signed amount on one line in every grid cell at 1280, 375 and 320 wide, ${name}" (2 cases: R-DALE-D Fri 11-13, R-BREN-U Mon 11-02). Its `lines` helper and the imports only it used (Locator, R_DALE_D, BREN, DALE, setViewport) went with it.

Moved (rule 2; all in e2e/d9ar/readout.spec.ts, mutations in tdd-log.md under TD.6):
- `brokenReadoutFigures(scope, wholeValues)`: each whole readout value (.replay-value, .replay-r, .replay-pnl-value) is one line, at 1280, 1440 and 1920; the stake grid ends inside the viewport (all widths).
- `places` of the loop: added BREN Wed 11-11 and CORV Mon 11-09 (:218's fixtures, CORV built through 5 at the 2026-11-09 clock), and DALE-hold Fri Nov 13 (gaps' R-DALE-D Fri 11-13; neither the loop nor the sweep visited it) with `signed`: At Worst case P&L matches /^[−+]\$[\d,]+\.\d{2}$/ at every width.

Every dropped assertion, and where it lives (L living, M moved):

| Dropped assertion | Where |
|---|---|
| readout:218, each .replay-value / .replay-r / .replay-pnl-value is one line (BREN Mon 11-16, BREN Wed 11-11, AXIO Mon 11-16, DALE-hold Wed 11-11, CORV Mon 11-09) | M: `brokenReadoutFigures` whole-value check (at 1280 and wider), run on AXIO Mon 11-16, BREN Wed 11-11, CORV Mon 11-09 and DALE-hold Mon 11-16, Thu 11-12, Fri 11-13, the same kinds of Trade and session. BREN Mon 11-16 and DALE-hold Wed 11-11 are not visited by the loop itself (the sweep checks their .card-figure pieces at 375 and 320) |
| readout:218, figures count greater than 0 | L: the Fri Nov 13 place's At Worst case pattern fails on an absent readout cell, and `openAt` needs the Replay |
| readout:218, a screenshot to B9AR.3-*.png | not carried (no evidence file reads it; the committed screenshots in D9A-R's evidence are history) |
| gaps:94, each grid cell one line at 1280, 375 and 320 | L: kept loop (grid cells, five widths) on DALE-hold Fri Nov 13 (the new place), and the sweep (grid cells at every session, 375 and 320) for BREN, including Mon 11-02 |
| gaps:94, grid cells count greater than 0 | L: the signed At Worst case pattern on the Fri Nov 13 place fails when the grid has no cells |
| gaps:94, the grid ends inside the viewport | M: `brokenReadoutFigures` grid check, all widths, all six places |
| gaps:94, At Worst case matches /^[−+]\$[\d,]+\.\d{2}$/ | M: loop, DALE-hold Fri Nov 13, five widths |
| gaps:94, R-BREN-U Mon 11-02 at 1280 | L: kept loop on BREN Wed 11-11 at 1280 (same Trade); Mon 11-02 itself only in the sweep at 375 and 320 |

Assumptions: (1) the whole-value check runs at 1280 and wider only, because on a phone "≈ 540 shares" wraps before its word by design and the dropped case ran at the default (wide) size; (2) the viewport height is 800, not gaps' 900, which does not affect line breaks.

Cases kept: none; both sets dropped. Nothing failed for a real reason.

Spec counts (e2e/d9ar/readout.spec.ts, e2e/d9ar/sweep.spec.ts, e2e/d9/gaps.spec.ts): before 24 passed, after 20 passed (minus 5 and 2, plus 3 places).

References (rule 10): rg of both titles: living text only in plan/D09A-R-stage-a-refactor.md lines 239 and 539 (defect 2). Line 239 now ends "(held by readout:264 and sweep:24 since TD.6)"; line 539 is the case-list wording of a past task and is left as written. Left as written: evidence/D09AR/tdd-log/T9AR.23.md (readout:218), evidence/D09AR/structural.md:493, evidence/D09AR/tdd-log/merge6-S1.md:5, and suite-run outputs.

### TD.6 ocr

gpt-6.1-sol, session 9fddc2c0: 2 files reviewed (3 excluded), 0 findings. `evidence/Test-Dedup/ocr/TD.6-af8dbae1.json`.

## TD.7

Set BD6, file e2e/d9ar/review.spec.ts. Kept: "should restore a started Action on each card after the Price History round trip, and save exactly it with one press" (the moved checks went in) and "should keep a started Action when the browser goes Forward to Price History and Back again after a round trip" (unchanged).

Removed (confirm first held: both cases read in full; the dropped one is the BREN half of the kept one, plus the checks below):
- e2e/d9ar/review.spec.ts:28, "should keep a started Action across the overlay, return to the same session from Price History, and save with one press".

Moved checks (in the kept case's loop; the headlines only on BREN, the only Trade whose figures :28 pinned; the rest on both BREN and AXIO):
- No .replay-card in the card, and no overlay, before opening; no .replay-card in the card after opening.
- Headline "+$988.00 · 3.05R" on open and "+$982.00 · 3.03R" after the return (BREN).
- One open, move (two sessions back, "Thu Nov 12 · 9 of 11") and Close before the round trip; focus on the card's Replay button after that Close; the Action still started (Exit and its Intent) after it; no Action entries recorded by it. The kept case then reopens with the card's button and goes on as before.
- `expectActionStarted` takes an optional Intent (default the shared one) so the loop can check each Trade's own.

Every dropped assertion, and where it lives:

| Dropped assertion | Where |
|---|---|
| reachCard BREN | L: kept case, loop |
| no .replay-card in the card and no overlay before opening | M |
| start an Exit with an Intent | L: kept case, loop (BREN and AXIO) |
| open the overlay; no .replay-card in the card after opening | M |
| headline "+$988.00 · 3.05R" on open | M (BREN) |
| ArrowLeft x2 gives "Thu Nov 12 · 9 of 11" | M (before the trip) and L (after End, in the trip) |
| Close removes the overlay | L: kept case; also M before the trip |
| focus on the card's Replay button after Close | M |
| Action started after Close | M |
| zero Action entries after open, move, Close | M |
| reopen, End, ArrowLeft x2, "Thu Nov 12 · 9 of 11" | L: kept case, loop |
| Price History link, BREN heading, "Back to the Review", Review heading, overlay back on the same session | L: kept case (BREN heading and overlay back; the Review heading is implied by the overlay and the card form the next lines reach) |
| headline "+$982.00 · 3.03R" after the return | M (BREN) |
| Close; Action still started before Save | L: kept case (Exit and Intent checked on each card) |
| one press of Save records one Action | L: kept case (count, and the saved choice and Intent) |

Dropped, not carried: the "if the Exit is not checked, start it again" fallback, which hid a lost draft; the kept case asserts the draft instead.

Spec counts (e2e/d9ar/review.spec.ts): before 6 passed, after 5 passed. Both runs under with-browser-lock.sh on 5175.

References (rule 10): rg of the title and "review:28": living text only in plan/browser-test-duplicates-plan.md (this plan) and research/browser-test-duplicates.md (the report); no acceptance row, acceptance-matrix, spec-map or bug-tasks entry. Left as written: evidence/D95/structural.md:147 (review:28 as the timing sample for `enterTrade`, 22.2 s to 2.0 s; the case is gone now) and evidence/D09/structural.md:549 (line numbers of a past task). The other hits for "review.spec.ts:28" are d5r/review, another file.

## TD.8 — Review meters and the walk's order (BD12, BD13)

Removed: the whole file `e2e/d9/meter-review.spec.ts` (both cases), deleted with git rm.

Helpers (rule 2): `reviewMeters` and `expectTrackDashed` moved into `e2e/d5r/support.ts` (it now imports `expect` from d5's support). `e2e/d9/support.ts` re-exports them from there, so `e2e/d9/open-list.spec.ts` and `e2e/d9/meter-a11y.spec.ts` keep importing them from D9's support unchanged.

### BD12: d9/meter-review "should keep the walk’s order and what each Action saves, through a save and a relaunch" (line 46), kept: d5r/review "should open the first card not Done on load, ... five Action Entries stored"

| Dropped assertion | Where |
|---|---|
| first order: T-A, T-F, then T-B, T-C, T-E in any order | moved into review (first-order block after the pre-Mark meter names) |
| first card T-A open | living: review asserts header aria-expanded true on T-A and one open header |
| order after T-A's Mark: T-B, T-C, T-E in any order, then T-F, T-A | moved into review |
| D-1 resolved in T-A's card before its Action | living: review does the same steps |
| Marks and a Hold Action on every card, each "Done · Action saved", Complete | living: review |
| final order is the five cards | moved into review (sorted list of five; the original checked no more) |
| after relaunch: Complete, five "Done · Action saved" | living: review |
| after relaunch: same card order as before the relaunch | moved into review |
| stored Marks (ABC, DEF, JKL, XYZ) and five Action Entries | living: review (and it adds the settled Entry and obligation keys) |

### BD13: d9/meter-review "should name each card’s meter by W51, draw the dashed track on the card without a Mark and move the meter with the saved Mark" (line 11), kept: d5r/sliders "should draw T-A’s pointer right of break-even, ..."

| Dropped assertion | Where |
|---|---|
| T-A's name before any Mark ("Mark missing: XYZ, ...") | living: review (same name, same fixture) |
| T-A's track dashed before any Mark | moved into sliders |
| the five names after the three Marks (T-A, T-B, T-C, T-F, T-E) | living: sliders asserts the same five |
| T-A, T-B, T-E, T-F data-state filled and track not dashed | moved into sliders |
| T-C data-state empty, track dashed, no pointer | living: sliders (it already asserts all three) |
| no meter shows a word | living: sliders |
| after T-C's Mark: data-state filled, name /^P&L .../ with Stop −$201.00 and Target +$599.00, track not dashed | moved into sliders (ends the case with T-C's Mark) |

Moved checks that came from the report's list: order (four points), T-A dashed, data-state, T-C after its Mark. Beyond the list: none needed.

Kept cases: none (both dropped). Every moved check failed on an assertion when made wrong (tdd-log, TD.8).

Spec counts: before 7 passed (d9/meter-review 2, d5r/review 2, d5r/sliders 3); after 5 passed (d5r/review 2, d5r/sliders 3). Both under with-browser-lock.sh on 5175. `.claude/scripts/acceptance-commands.sh plan/D09-trade-replay.md`: 9 commands checked, 0 failed.

References (rule 10): plan/D09-trade-replay.md AC-REV-002 command re-pointed to `npx playwright test e2e/d5r/review.spec.ts` (since TD.8). Other hits left as history: plan/D09B-handoff.md:177, plan/D09C-handoff.md:18, plan/D09-handoff.md:165 (finished handoffs), research/browser-test-duplicates.md (the report), the B9.8 comment of the dropped file (gone with it). rg of both titles found no acceptance-matrix, spec-map or bug-tasks entry.

### TD.8 ocr

gpt-6.1-sol, session e1e8fbb4: 4 files reviewed (5 excluded), 0 findings. `evidence/Test-Dedup/ocr/TD.8-0a247665.json`.

## TD.9

### BD7: d6/responsive-a11y "should space the Position drawer tables, name Lot Matches once in visible text, and show every Open Lots column whole at 1280 px" (line 293), kept: d7/responsive-a11y "should show the Position drawer tables of a Settlement Due option Trade spaced, with Lot Matches named once and every Open Lots column and figure inside its region at 1280 px"

Confirm first held: both cases open the Position drawer at 1280 on a Trade with one Lot Match; the d7 case ran the moved checks on the option fixture without a real failure.

| Dropped assertion | Where |
|---|---|
| one Lot Matches row | living: d7 (same assertion, option Trade) |
| no drawer cells touch (8 px gap, every drawer table) | moved into d7 |
| Lot Matches visible text exactly once | living: d7 (same assertion) |
| Lot Matches table visible | living: d7 (its row count of 1 is read through the same table) |
| one Lot Matches caption in the tree | living: d7 (same assertion) |
| Open Lots region does not scroll sideways | living: d7 (scrolls: false) |
| last header and figure inside the region | living: d7 (it checks every th and td, a wider check) |
| no Open Lots header truncated | moved into d7 |

Moved checks: 2 (the report's list; nothing beyond it). Both failed on an assertion when made wrong (tdd-log, TD.9). Kept cases: none (d6:293 dropped).

Spec counts: before 9 passed (d6/responsive-a11y 5, d7/responsive-a11y 4); after 8 passed (d6 4, d7 4). Both under with-browser-lock.sh on 5175. typecheck and lint exit 0.

References (rule 10): rg of both titles found plan/browser-test-duplicates-plan.md (this plan) and evidence/D08P/structural.md:1479, evidence/D08P/tdd-log/T8P.23-B4.md:7 (finished records, left as written; kept test d7 "should show the Position drawer tables of a Settlement Due option Trade spaced, ..." now also holds the moved checks). No acceptance-matrix, spec-map or bug-tasks entry.
