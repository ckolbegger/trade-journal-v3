# Browser test duplicates (Playwright, e2e/), second pass

Read only. No tests were run, so times are estimates from setup size, not measurements.

## 1. Summary

- Scanned: 137 spec files in 19 folders, 378 `test(...)` declarations (more at run time, because loops over fixtures or widths multiply some). Every spec file and every e2e/*/support.ts was read in full (see section 5).
- Duplicate sets found: 17 (BD1 to BD7, BD9 to BD18). BD8 from the first pass is rejected.
- Cases proposed for removal: 31 declarations (about 12 high confidence, the rest medium).
- Rough time saved: about 55 to 60 cumulative test-minutes. With four stages running cases in parallel, that is roughly a tenth of the 23-minute browser tier. Section 3 lists a further group of "same setup, different checks" cases; merging those could save about 50 more minutes, but they are not duplicates by your definition.
- Almost all duplicates are in the replay work (d9, d9ar), where d9ar re-tests the flows d9 first tested, and in the Detail history and Today work (d8p, d8r).
- Settled from the first pass: BD10 is a move-then-drop, not a plain drop (see the table). d9/responsive-a11y.spec.ts:168 is not an exact copy of d9ar/responsive-a11y.spec.ts:170 (see section 3).
- Better idea with lasting effect: the cost is the fixture build (a BREN replay is about 1.5 min, `buildReview` about 5, `buildOc3` about 3), repeated per case. Build each big fixture once per worker, save the browser profile folder, and copy it for each read-only case. That would remove more time than deleting the duplicates below.

## 2. Duplicate sets

Line numbers are the `test(` line. "Keep" is the case a cleanup task should leave. "Move" lists assertions of the dropped case that the kept case lacks.

| Set | Behaviour | Cases | Keep | Drop | Assertions to move into the kept case | Conf. | Est. time saved |
|---|---|---|---|---|---|---|---|
| BD1 | How a replay ends: Open Trade, K-sale Final result, R-DALE-U Settlement Due then Expired, Planned Trade | d9/states:36, :47, :75, :118; d9ar/states:12, :35, :72; d9ar/overlay:11; d8r/states:97 | d9ar/states:12, :35, :72 and d9ar/overlay:11 | d9/states:118 (high); :47, :75, :36 (medium) | From all four: `expectNoPayoffOrTheory` (AC-CALC-004), which d9ar lacks. From :47: chart words "Realized +$478", "Realized +$1,138", "Sold 2 at $4.00"; the six-drawer list; the step back to Thu Nov 12 ("+$982.00 · 3.03R", "Target reached, $26.00 past it."). From :75: six drawers; Thu Nov 19 headline "+$564.00 · 0.37R"; after expiry the stake sentence "Nothing is at risk and nothing is left to gain." and "Expired" in the P&L chart. From :36: Today selected. :118 needs nothing (drawer list is in d8r/states:97, no Replay button in d9ar/states:72). | high for :118, medium for the rest | about 6 min (K-sale build 9 Marks, DALE build 13 Marks with Expiration, BREN, Planned) |
| BD2 | Phone words in both charts at 375 and 320 | d9/responsive-a11y:130 (calls `expectPhoneWords` at 375 and 320) and :208 (same build, same two widths, same helper) | :130 (or d9ar:93 once BD3 is applied) | d9/responsive-a11y:208 | None. The strip labels are the same at Mon 11-16 and Thu 11-12. | high | about 2 min |
| BD3 | Replay fits one screen, no sideways scroll, axe clean, session kept across resize; from Detail and from a Review card | d9/responsive-a11y:130, :138, :151; d9ar/responsive-a11y:93, :101, :111 | d9ar:93, :101, :111 (five sizes plus overlay-covers-navigation, same helper steps, same BREN build) | d9/responsive-a11y:130, :138, :151 | The phone-title checks of d9's `expectPhoneWords`: "BREN price" and "Trade P&L" present; "one Mark per session" and "dollars for the whole Position" absent; the marker reads "Sold 2"; Risk and Reward tags start with "$". d9ar's `expectPhoneLabels` checks only the strip labels. d9's height rule counted the bottom navigation, which the overlay now covers, so it is obsolete. | medium | about 8 min (three BREN builds, axe at 3 sizes each) |
| BD4 | R-CORV-D on Tue 11-10 says "No Mark" once, dash in each cell that needs it | d9/gaps:11; d9ar/states:81; d9ar/readout:196 | d9ar/states:81 (it has the said-once check and the distinct second half) and d9/gaps:11 (full figures and cards) | d9ar/readout:196 | Into d9ar/states:81: the readout does not contain "Mark missing", and the count of /No Mark for\|Mark missing/ is 1 (states:81 counts only "No Mark for"). The Trade P&L dash is already in gaps:11. | high | about 1.5 min |
| BD5 | R-CORV-D shaded No Mark column and the key | d9ar/chart:104; d9ar/chart:123 | chart:104 | chart:123 | The key check: step back one session and expect the key to contain "No Mark" on Wed 11-11 and Tue 11-10. The one-column count is already in :104. | high | about 1.5 min |
| BD6 | A started Action survives the Review overlay and the Price History round trip | d9ar/review:28, :74, :112 | :74 (two Trades, stored answers checked) and :112 (Forward/Back, new) | d9ar/review:28 | No `.replay-card` in the card and no overlay before opening; headline "+$988.00 · 3.05R" on open and "+$982.00 · 3.03R" after return; focus on the card's Replay button after Close; zero Action entries after open, move and close (before the trip). | medium | about 5 min (`buildReview`, 3 Trades) |
| BD7 | Position drawer tables: cells spaced, "Lot Matches" named once, Open Lots fits at 1280 | d6/responsive-a11y:293 (stock); d7/responsive-a11y:163 (option, Settlement Due) | d7:163 | d6:293 | The 8 px "touching cells" check and the header-not-truncated check, which d7 lacks (d7 has column count 5 and "$0.65" in view, which d6 lacks). Run them on the kept fixture. | medium (different fixtures) | about 2 min |
| BD9 | The Plan block's figures stay on one line at 375 and 320 | d9ar/readout:305 (BREN, AXIO, CORV); d9ar/sweep:24 (4 fixtures, every session, 375 and 320, whole dialog, same marker and stray-figure pattern) | sweep:24 | readout:305 (3 cases) | None. | high | about 4.5 min |
| BD10 | Readout figures on one line | d9ar/readout:218 (5 cases, 1280); d9ar/readout:264 (3 cases, 5 widths) | readout:264 | readout:218 (5 cases) | The whole-value check: `.replay-value` is a `<td>` in the stake grid (readout.tsx:54) and a `<span>` in the other rows (readout.tsx:92), and neither sits inside a `.card-figure`. :264 measures only `.card-figure` pieces and grid cells, so it would miss a value that wraps between two figures. Add a whole-`.replay-value` one-line check to `brokenReadoutFigures`, then drop :218. Fixtures BREN Wed 11-11 and CORV Mon 11-09 are new to :264. | medium | about 7.5 min |
| BD11 | Signed amounts in the stake grid on one line at 1280, 375, 320 | d9/gaps:94 (2 cases: R-DALE-D Fri 11-13, BREN Mon 11-02); d9ar/readout:264; d9ar/sweep:24 | readout:264 + sweep:24 | d9/gaps:94 (2 cases) | "At Worst case" matches /^[−+]\$[\d,]+\.\d{2}$/. The grid's right edge inside the viewport is covered by `expectReadoutShownInFull` and the sweep. | medium | about 3 min |
| BD12 | Review end to end on cards: Marks, debt answer, Actions, Complete, relaunch, five "Done · Action saved" | d5r/review:9; d9/meter-review:46 | d5r/review:9 | d9/meter-review:46 | Card order checks: the first order, the order after Marks saved, the final order, and the same order after relaunch (`reviewMeters`). | medium | about 4 min (5-Trade fixture, 5 Marks, 5 Actions, relaunch) |
| BD13 | Meter names, dashed track and state on Review cards | d5r/sliders:57; d9/meter-review:11 | d5r/sliders:57 | d9/meter-review:11 | Dashed track on T-A before any Mark; `data-state` filled or empty on each card; after saving T-C's Mark: state filled, name /^P&L .../, track not dashed. | medium | about 2.5 min |
| BD14 | Journal paging by keyboard keeps focus on a paging button | d8p/history:135; d8r/history:16 (last step, same keys, same checks) | d8r/history:16 | d8p/history:135 | None. | high | about 3 min (`buildOc3`) |
| BD15 | Escape closes the small volatility chart, overlay stays open, focus on the chip | d9/estimates-a11y:53 (loop: 375 and 320); d9/estimates:33 (presses Escape once) | d9/estimates:33 | the 320 case of :53 (high); the 375 case (medium) | For the 375 case: focus is on the chip, `aria-expanded` is "false", still open after 500 ms, a second Escape closes the overlay. Add them to estimates:33. | high / medium | about 1.5 min each |
| BD16 | A tap on a session moves the slider; no hover box afterwards | d9ar/responsive-a11y:256; :279 (same build, same touch launch, same tap on Wed Nov 11) | :256 | :279 | After the first tap in :256: no `hover` test id, no `rect.hover-column`. The screenshot, if the evidence needs it. | high | about 2.5 min |
| BD17 | Today table on Settlement Due then Closed (Put Mark Today, headings, "Expired", accessible name) | d8p/states:28; d8r/states:35 | d8p/states:28 | d8r/states:35 | "Where the prices sit" absent when Settlement Due; "Expired" appears once; "Closed" absent then present; the Closed stamp in the accessibility tree and not `aria-hidden`; MNO Mark cells empty and "—". | medium | about 2 min |
| BD18 | Records disagree badge stays inside its cell at 320 and 390 on the Planned list | d2/ui-alignment:602; :1576 | :602 (two badge kinds, axe) | :1576 | The stricter bound: each Underlying and Trade cell, with descendants, ends inside the scroll region. | medium | about 0.7 min |

Totals: BD1 4, BD2 1, BD3 3, BD4 1, BD5 1, BD6 1, BD7 1, BD9 3, BD10 5, BD11 2, BD12 1, BD13 1, BD14 1, BD15 2, BD16 1, BD17 1, BD18 1 = 31 declarations to drop. No @every-task case is touched.

Verdict on the first pass: BD1, BD2, BD3, BD4, BD5, BD6, BD7, BD9 confirmed (BD1, BD3, BD6, BD7 gained more "move" items). BD10 corrected as above and split (gaps:94 became BD11). BD8 rejected.

## 3. Checked, not duplicates

- **BD8 (rejected): d4/card-helpers:78 and d5r/marks:91.** :78 pins the `reachCard` helper's contract (decision 65), :91 pins the product. Saves 0.5 min only.
- **d9/responsive-a11y:168 and d9ar/responsive-a11y:170 plus `expectOverlayCoversNavigation`.** :168 tabs through a Review card's replay on a phone and checks no control is hidden under the bottom navigation. d9ar proves the overlay covers the navigation at every size (inside the sizes helper, :93 and :101), so the risk :168 guards is gone. But :170 only keeps Tab inside the overlay on Detail; it does not test hidden controls. Verdict: obsolete in intent, not a copy. Medium-low candidate to drop (about 1.5 min); decide in the cleanup task.
- **Same flow in each deliverable, different feature.** Kill after commit: d1/plan:38, d2/durability, d4/kill, d5/kill-offline:9, d6/kill, d7/kill. Offline cold restart: d1, d2, d4, d5, d5r, d6, d7, d8, d9ar:368. Recovery Only and mid-session failure: d1, d2, d4, d5, d6, d7, d8. Nothing saved without Save: d1, d2, d4, d5, d6, d7, d9r2/drafts. Each drives a different form or store and has its own AC-DEL or AC-JOUR check. (The six no-save specs copy the same helper functions; moving them to support code would be a good cleanup, not a test removal.)
- **Nav placement at 959/960 px asserted in d1, d2, d4, d5, d6, d7.** The assertion repeats; each case also pins its own form's draft across the resize. Trimming the repeated assertion saves seconds only.
- **d1/identity loop (known and unknown user agent).** Both are @every-task; the unknown agent is its own pin.
- **d7/confirm-option-plan (T7.31-F1) and d7/plan-open:11.** The 1R and Breakeven values repeat, but F1 pins "no page error" under dist-faults, a named defect. Option: add a page-error listener to plan-open and drop (about 0.5 min).
- **d9/gaps:115 ("Realized −$440" in the chart) and d9/gaps:56; d9/replay:92 (C9.2) and d9/replay:53.** Same build and state, but each adds an assertion the other lacks. Merge candidates, below.
- **d9ar/readout:264 and d9ar/cards:240 at 375 and 320.** The sweep covers those widths; the wide widths (1280, 1440, 1920) are unique. Trimming the narrow widths saves seconds, not a build. d9ar/cards:240 also has a narrow-column row check that nothing else has.
- **d9/replay and d9ar/overlay, d9ar/readout (BREN Mon 11-16).** d9/replay:17 is a superset of the d9ar assertions.
- **d9/replay:131 (click a session) and d9ar/responsive-a11y:256 (tap).** Different input, mouse and touch.
- **d9ar/chart:316, :325 (key on one line) and d9ar/chart:260, :137.** Different fixtures and labels; the key checks differ from the figure sweep.
- **d8r/rail Thu 18:00 step and d8p/cockpit rail step.** The Thu 18:00 step of d8r/rail repeats d8p/cockpit's rail assertions; the Fri 12:00 and Fri 18:00 steps are unique. Remove only that step (seconds).
- **d8p/history:151, the d8p/responsive-a11y keyboard case, and d5/detail-debt (T8P.23-B10).** Each pins Reflect now from a different state (paged cards; keyboard and axe; viewport position and focus).
- **d8p/lot-matches-fit:55 (DEF, stock) and :75 (O-C3, option).** Same helper, two fixtures, named defect T8P.26-B2. :75 costs a `buildOc3` (about 3 min); medium-low candidate to drop if the fix is table-wide.
- **d8p/payoff-fit, d8p/responsive-a11y, d8r/responsive-a11y, d6/responsive-a11y:196 to :361, d7/payoff-chart-layout.** Each a named fix on a different table or chart.
- **d7/settlement-due:B7.4 and d8p/states:28, d8p/settlement-due-replay, d8p/journal-final-session:2.** Same MNO put setup; different assertions (panel values, Price History, Journal card).
- **d8/responsive-a11y words split (Restore counts) and Restore preview no sideways scroll.** Same setup; the split-word check is new.
- **d9r2/editor:66, :90, :122; d9r2/drafts; d5r/marks:91.** Refused-save focus, drafts, and header hold each have a named defect or acceptance check.
- **d4/review:6 and d5r/review:9; d4/acknowledge, d4/hold, d4/correct-mark, d4/gaps, d4/expected-mark.** d4/review pins attention order and reasons; the other d4 flows pin Mark, Action, correction and gap rules that d5r does not repeat.
- **d2/narrow and d2/ui-alignment; d2/ui-alignment cases among themselves.** Page-width reflow versus styling, gutters, line breaks and tones; each case has its own property. (BD18 is the one overlap.)
- **d7p/layout, d7sp, d8/restore, d8/backup, d8/offline, d8/recovery-only, d8/shell, d8/after-restore, smoke/engine-capabilities, support/detail/helpers, d6/stale-debt, d6/stale-index, d8/watch-outgoing, d9ar/label-sweep (skipped unless LABEL_SWEEP=1).** Distinct features, loops over fault sets, or tests of helpers.

### Same setup, different checks (merge candidates, not counted in the totals)

| ID | Cases | What merging would do | Est. time saved (min) |
|---|---|---|---|
| M1 | d9ar/review:112, :141, :162, :181 (and :28, :74) all call `buildReview` with 3 Trades | Run the read-only ones (:141, :162, :181) on one build, or share a saved profile | about 15 |
| M2 | d9/meter-a11y three cases and d9/open-list:48 all build the same four Trades (BREN, CORV, DALE-D, AXIO-U) | One build for the shape, style and listing checks | about 15 |
| M3 | CORV through 7 Marks: d9/gaps:11, d9/estimates:92, d9ar/states:81, d9ar/chart:104 and :123, d9ar/cards:183 | Fewer builds, more checks per build | about 6 |
| M4 | `buildOc3` in about 12 cases in d8p and d8r (cockpit, history, responsive, payoff-fit, lot-matches-fit, today, rail, plan-risk) | Shared profile | about 20 |
| M5 | MNO put Settlement Due: d7/settlement-due, d8p/states:28, d8p/settlement-due-replay, d8p/journal-final-session:2, d8r/states:35 | Fold the replay and final-session checks into d8p/states:28 | about 6 |
| M6 | d7p/layout: three cases call the same scenario setup | One scenario, three screens | about 6 |
| M7 | d7s/conditions B7S.3 and B7S.4 share the first sessions | Check the card between the Wed and Thu marks | about 3 |
| M8 | d9ar/responsive-a11y 44 px cases (:228, :245, :330 twice) | One build per surface | about 5 |
| M9 | d9/gaps:115 into d9/gaps:56; d9/replay:92 into d9/replay:53 | Add the extra assertion to the same state | about 3 |
| M10 | d4/review and d5r/review | Merge the order and reason checks into one flow | about 4 |

## 4. Method and limits

- Listed every `test(` line (`rg -n "^\s*test\(" e2e`), then read every spec file and every support.ts in full, in the order of the scratchpad list. Comment-only lines and bare closing braces were dropped from what I read; no code lines were skipped.
- Compared cases by flow, helper sequence, fixture and assertions. For BD10 I also read src/ui/cockpit/replay/readout.tsx and figure-words.tsx (read only) to settle where `.replay-value` sits.
- Times are estimates. No run, so no per-case timing. I used about 1.5 min per replay build of 10 Marks, about 3 min for `buildOc3`, about 5 min for `buildReview`, and added axe, resize and relaunch costs. The test timeouts are upper bounds.
- Cross-layer overlap (unit or integration versus browser) is out of scope and was not checked.
- Confidence "high" means the dropped case's assertions are wholly contained in the kept case or differ only by the moves listed. "Medium" means near-copies where a small distinct pin needs moving first.
- Not checked: whether the moved assertions behave the same on the kept fixture (for example BD7).

## 5. Files read

All 137 spec files were read in full. Counts are `test(` declarations (loops run more cases).

| File | Tests |
|---|---|
| e2e/d1/identity.spec.ts | 1 |
| e2e/d1/integrity-blocked.spec.ts | 2 |
| e2e/d1/no-save.spec.ts | 1 |
| e2e/d1/offline.spec.ts | 1 |
| e2e/d1/onboarding.spec.ts | 1 |
| e2e/d1/plan.spec.ts | 2 |
| e2e/d1/readiness.spec.ts | 2 |
| e2e/d1/recovery-only.spec.ts | 1 |
| e2e/d1/responsive-a11y.spec.ts | 3 |
| e2e/d1/runtime-failure.spec.ts | 1 |
| e2e/d1/update.spec.ts | 5 |
| e2e/d2/after-save.spec.ts | 1 |
| e2e/d2/cockpit-layout.spec.ts | 1 |
| e2e/d2/durability.spec.ts | 1 |
| e2e/d2/integrity.spec.ts | 3 |
| e2e/d2/migration.spec.ts | 4 |
| e2e/d2/narrow.spec.ts | 5 |
| e2e/d2/no-save.spec.ts | 2 |
| e2e/d2/offline.spec.ts | 1 |
| e2e/d2/open-position.spec.ts | 3 |
| e2e/d2/responsive-a11y.spec.ts | 4 |
| e2e/d2/runtime-failure.spec.ts | 3 |
| e2e/d2/ui-alignment.spec.ts | 43 |
| e2e/d4/acknowledge.spec.ts | 1 |
| e2e/d4/breach-overrun.spec.ts | 1 |
| e2e/d4/card-helpers.spec.ts | 9 |
| e2e/d4/correct-mark.spec.ts | 1 |
| e2e/d4/expected-mark.spec.ts | 1 |
| e2e/d4/gaps.spec.ts | 1 |
| e2e/d4/hold.spec.ts | 1 |
| e2e/d4/kill.spec.ts | 1 |
| e2e/d4/no-save.spec.ts | 1 |
| e2e/d4/offline.spec.ts | 1 |
| e2e/d4/responsive-a11y.spec.ts | 6 |
| e2e/d4/review.spec.ts | 1 |
| e2e/d4/runtime-failure.spec.ts | 2 |
| e2e/d4/update.spec.ts | 1 |
| e2e/d5/detail-debt.spec.ts | 2 |
| e2e/d5/due-timing.spec.ts | 2 |
| e2e/d5/faults.spec.ts | 2 |
| e2e/d5/kill-offline.spec.ts | 2 |
| e2e/d5/no-save.spec.ts | 1 |
| e2e/d5/responsive.spec.ts | 2 |
| e2e/d5/review-debt.spec.ts | 2 |
| e2e/d5/update.spec.ts | 1 |
| e2e/d5r/durability.spec.ts | 3 |
| e2e/d5r/marks.spec.ts | 5 |
| e2e/d5r/responsive-a11y.spec.ts | 3 |
| e2e/d5r/review.spec.ts | 2 |
| e2e/d5r/sliders.spec.ts | 3 |
| e2e/d6/close-review.spec.ts | 1 |
| e2e/d6/exit-action.spec.ts | 1 |
| e2e/d6/exit-requirements.spec.ts | 2 |
| e2e/d6/exit.spec.ts | 1 |
| e2e/d6/kill.spec.ts | 1 |
| e2e/d6/no-save.spec.ts | 1 |
| e2e/d6/offline.spec.ts | 1 |
| e2e/d6/responsive-a11y.spec.ts | 5 |
| e2e/d6/runtime-failure.spec.ts | 2 |
| e2e/d6/stale-debt.spec.ts | 1 |
| e2e/d6/stale-index.spec.ts | 1 |
| e2e/d7/confirm-option-plan.spec.ts | 1 |
| e2e/d7/kill.spec.ts | 1 |
| e2e/d7/marks-zero.spec.ts | 1 |
| e2e/d7/no-save.spec.ts | 1 |
| e2e/d7/offline.spec.ts | 1 |
| e2e/d7/payoff-chart-layout.spec.ts | 3 |
| e2e/d7/plan-open.spec.ts | 3 |
| e2e/d7/plan-validation.spec.ts | 1 |
| e2e/d7/responsive-a11y.spec.ts | 4 |
| e2e/d7/review-expiration.spec.ts | 1 |
| e2e/d7/runtime-failure.spec.ts | 2 |
| e2e/d7/settlement-due.spec.ts | 1 |
| e2e/d7/short-put.spec.ts | 1 |
| e2e/d7p/layout.spec.ts | 4 |
| e2e/d7s/conditions.spec.ts | 2 |
| e2e/d7s/entry-beyond-stop.spec.ts | 1 |
| e2e/d7s/plan.spec.ts | 2 |
| e2e/d7s/responsive-a11y.spec.ts | 2 |
| e2e/d7sp/review-dated-line.spec.ts | 1 |
| e2e/d8/after-restore.spec.ts | 1 |
| e2e/d8/backup.spec.ts | 4 |
| e2e/d8/offline.spec.ts | 1 |
| e2e/d8/recovery-only.spec.ts | 1 |
| e2e/d8/responsive-a11y.spec.ts | 7 |
| e2e/d8/restore.spec.ts | 6 |
| e2e/d8/shell.spec.ts | 1 |
| e2e/d8/watch-outgoing.spec.ts | 1 |
| e2e/d8p/cockpit.spec.ts | 1 |
| e2e/d8p/first-marks-pending.spec.ts | 1 |
| e2e/d8p/history.spec.ts | 3 |
| e2e/d8p/journal-final-session.spec.ts | 2 |
| e2e/d8p/lot-matches-fit.spec.ts | 2 |
| e2e/d8p/payoff-fit.spec.ts | 1 |
| e2e/d8p/planned.spec.ts | 2 |
| e2e/d8p/responsive-a11y.spec.ts | 2 |
| e2e/d8p/settlement-due-replay.spec.ts | 1 |
| e2e/d8p/states.spec.ts | 3 |
| e2e/d8p/today-narrow.spec.ts | 2 |
| e2e/d8r/history.spec.ts | 1 |
| e2e/d8r/names.spec.ts | 1 |
| e2e/d8r/plan-risk.spec.ts | 2 |
| e2e/d8r/rail.spec.ts | 2 |
| e2e/d8r/responsive-a11y.spec.ts | 3 |
| e2e/d8r/states.spec.ts | 4 |
| e2e/d8r/today.spec.ts | 2 |
| e2e/d9/estimates-a11y.spec.ts | 2 |
| e2e/d9/estimates.spec.ts | 4 |
| e2e/d9/gaps.spec.ts | 4 |
| e2e/d9/meter-a11y.spec.ts | 3 |
| e2e/d9/meter-detail.spec.ts | 2 |
| e2e/d9/meter-review.spec.ts | 2 |
| e2e/d9/open-list.spec.ts | 2 |
| e2e/d9/replay.spec.ts | 5 |
| e2e/d9/responsive-a11y.spec.ts | 5 |
| e2e/d9/review.spec.ts | 2 |
| e2e/d9/session-cards.spec.ts | 1 |
| e2e/d9/states.spec.ts | 4 |
| e2e/d95/marks-step.spec.ts | 1 |
| e2e/d95/slip-questions.spec.ts | 1 |
| e2e/d9ar/cards.spec.ts | 4 |
| e2e/d9ar/chart.spec.ts | 12 |
| e2e/d9ar/crossing-position.spec.ts | 1 |
| e2e/d9ar/label-sweep.spec.ts | 1 |
| e2e/d9ar/overlay.spec.ts | 4 |
| e2e/d9ar/readout.spec.ts | 11 |
| e2e/d9ar/responsive-a11y.spec.ts | 16 |
| e2e/d9ar/review.spec.ts | 6 |
| e2e/d9ar/states.spec.ts | 4 |
| e2e/d9ar/sweep.spec.ts | 1 |
| e2e/d9r2/drafts.spec.ts | 5 |
| e2e/d9r2/editor.spec.ts | 4 |
| e2e/d9r2/grid.spec.ts | 2 |
| e2e/d9r2/history.spec.ts | 1 |
| e2e/d9r2/responsive-a11y.spec.ts | 3 |
| e2e/smoke/engine-capabilities.spec.ts | 1 |
| e2e/support/detail/helpers.spec.ts | 8 |

Total: 378. Support files read in full: e2e/d1/support.ts, e2e/d2/support.ts, e2e/d4/support.ts, e2e/d5/support.ts, e2e/d5r/support.ts, e2e/d6/support.ts, e2e/d7/support.ts, e2e/d7p/support.ts, e2e/d7s/support.ts, e2e/d8/support.ts, e2e/d8p/support.ts, e2e/d8r/support.ts, e2e/d9/support.ts, e2e/d9ar/support.ts, e2e/d9r2/support.ts.
