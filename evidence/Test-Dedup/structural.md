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
