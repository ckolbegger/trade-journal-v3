# Plan: remove duplicate browser tests

Drafted 2026-11-23 from `research/browser-test-duplicates.md` (the second, full pass). Nothing has been changed yet. Not a D9.5 task.

## 1. Purpose and scope

The browser suite has groups of tests that check the same thing twice. This plan removes the copies. For each duplicate set it keeps one test, moves into it any check only the dropped test had, then deletes the dropped test.

In:
- The 17 duplicate sets of the report: BD1, BD2, BD3, BD4, BD5, BD6, BD7, BD9, BD10, BD11, BD12, BD13, BD14, BD15, BD16, BD17, BD18. The report says they drop 31 cases; its own per-set totals add to 30 cases at run time, from 22 test declarations (some sit in loops).
- `e2e/d9/responsive-a11y.spec.ts:168`, which this plan decides to remove (TD.3 explains why).
- Re-pointing every living plan reference to a dropped test, in the same task.

Out: see section 7. BD8 was rejected and is left out.

Expected time saved, two numbers that disagree:
- **The report's estimate:** "about 55 to 60 cumulative test-minutes ... roughly a tenth of the 23-minute browser tier". This was an estimate from setup size, with no run.
- **Measured durations:** the last full browser run (`evidence/D95/suite-runs/t95.13-slip-questions-browser-1.txt`, `-2`, `-3`, `-4`; stages 5.3, 5.0, 4.4 and 7.3 min) shows the 31 run-time cases this plan drops (the 30 above plus :168) taking about **97 seconds** in total. The longest are `d8p/history:135` at 7.8 s, `d9/meter-review:46` at 6.6 s and `d9ar/review:28` at 5.3 s. Spread over parallel workers, the wall-clock saving would be well under a minute.

So the measured saving is far below the estimate. See open question 1 before starting.

## 2. Rules for every task

- **Runs (answer 3):** each task runs only the spec files it changes; no `browser-task` or other suite run per task. TD.11 is the one complete run. Where a line below says otherwise, this rule wins.

1. Change browser tests only. No product code, no styles, no unit or integration tests.
2. Go through the support helpers (decision 65). A check that a kept test in another folder needs moves into that folder's `support.ts` (or the support file it already imports), never copied into the spec.
3. Name cases by title, not line number. Line numbers below are as of this plan; they move after the first deletion.
4. Move first, delete second. For each moved check, show it can fail: change the expected value to a wrong one, run, see it fail on an assertion (not a compile error), restore it, run again. Record both runs in `evidence/Test-Dedup/tdd-log.md`.
5. A "confirm first" step means: read the kept and the dropped case in full, and drop only if the report's reading holds. If it doesn't, keep the case and record why in `evidence/Test-Dedup/structural.md`.
6. If a moved check fails on the kept test's fixture for a real reason (not a test mistake), keep the dropped case, record the failure, and carry on with the rest of the task. Don't fix product code.
7. Run the touched spec files before and after the change, each under `.claude/scripts/with-browser-lock.sh` on port 5175. Record the counts. Never run the full suite inside a task.
8. When a spec file ends up empty, delete it, and re-point any acceptance command that names it. Then run `.claude/scripts/acceptance-commands.sh <breakdown>` for that breakdown.
9. Record each removed test in `evidence/Test-Dedup/structural.md` under the task: file:line, title, and where its checks now live (kept test title, plus any moved check).
10. References: living plan text (acceptance rows and their commands, `plan/acceptance-matrix.md`, `plan/spec-map.md`, `plan/bug-tasks.md`, breakdown defect tables) gets re-pointed to the kept test in the same task. Past records (suite-run outputs, tdd-logs, `structural.md` entries of finished tasks, ocr files) are history and stay as written; the task's own record lists them with the kept test instead. Lookups for this plan found no reference in `acceptance-matrix.md`, `spec-map.md` or `bug-tasks.md`; each task re-runs `rg` on the titles before deleting.
11. Commit each task locally. No push.

Levels (decision 122): tests-only work is Light: no ocr, no suite run, the subagent runs the touched specs. Three tasks are Standard (TD.3, TD.4, TD.8) because they move checks across folders into shared support helpers or change a helper that other cases use, so an ocr review of the moved logic is worth having. TD.6 is Standard because it adds new check logic to a helper. See open question 3 for the after-task run a Standard task brings.

## 3. Tasks

Ordered high confidence first. Each touches one or two spec folders.

### TD.1 — Replay chart key and Plan block (BD5, BD9) (Light)

High confidence. Files: `e2e/d9ar/chart.spec.ts`, `e2e/d9ar/readout.spec.ts`.

- BD5. Keep chart:104 "should shade the session with no Mark on R-CORV-D, join nothing across it and flag the Target reached". Drop chart:123 "should name the shaded No Mark column in the key on R-CORV-D". Move: step back one session and expect the key to contain "No Mark" on Wed 11-11 and Tue 11-10.
- BD9. Keep sweep:24 "should find no broken or unmarked figure anywhere in the replay at any session, ..." (unchanged). Drop readout:305 "should keep every figure in the Plan block on one line, sign with its number, at 375 and 320, ..." (the loop, 3 cases: BREN, AXIO, CORV). Move: nothing. Remove the loop's `places` data and any helper only it used.
- References: chart:123 in `evidence/D09AR/tdd-log/T9AR.23.md:18` (history); readout:305 in `evidence/D09AR/tdd-log/T9AR.24-B12.md:7` (bug task T9AR.24-B12, history; record that sweep:24 now holds it).
- Verify: `e2e/d9ar/chart.spec.ts`, `e2e/d9ar/readout.spec.ts`, `e2e/d9ar/sweep.spec.ts` before and after.

### TD.2 — Journal paging and Settlement Due Today (BD14, BD17) (Light)

Files: `e2e/d8p/history.spec.ts`, `e2e/d8p/states.spec.ts`, `e2e/d8r/history.spec.ts` (read only), `e2e/d8r/states.spec.ts`.

- BD14 (high). Keep d8r/history:16 "should show each Mark cell with its provenance ... paged by keyboard with focus kept on a paging button". Drop d8p/history:135 "should keep keyboard focus on a paging button when paging to either end of the Journal". Move: nothing.
- BD17 (medium, confirm first). Keep d8p/states:28 "should show a Settlement Due Detail with Today selected and Settlement Due in the P&L card, then the expired put Closed via expiration with its Result rows". Drop d8r/states:35 "should show Today on O-S2X Settlement Due with "Expired Fri Nov 20", then Closed by expiration ...". Move: "Where the prices sit" absent while Settlement Due; "Expired" appears once; "Closed" absent, then present; the Closed stamp is in the accessibility tree and not `aria-hidden`; the MNO Mark cells empty and "—". Confirm first that both cases use the same Trade and states (the titles name O-S2X and an expired put).
- References: none found outside suite-run outputs.
- Verify: `e2e/d8p/history.spec.ts`, `e2e/d8p/states.spec.ts`, `e2e/d8r/history.spec.ts`, `e2e/d8r/states.spec.ts` before and after.

### TD.3 — Replay sizes, phone words, tap, and the bottom navigation (BD2, BD3, BD16, d9/responsive-a11y:168) (Standard)

Files: `e2e/d9/responsive-a11y.spec.ts` (deleted), `e2e/d9ar/responsive-a11y.spec.ts`, `e2e/d9ar/support.ts`, `plan/D09-trade-replay.md` (row at line 910).

BD2 and BD3 are one task: BD2's kept case (d9:130) is one of BD3's dropped cases.

- BD2 (high). Drop d9:208 "should use the phone words in both charts at 375 and 320 px". Its checks are in d9:130 now, and move with BD3 below.
- BD3 (medium, confirm first). Keep d9ar:93 "should fit the Detail overlay on one screen at every size, keeping the session across each resize", d9ar:101 "should fit the Review card’s overlay on one screen at every size, ...", and the 320 loop at d9ar:111. Drop d9:130 "should fit the Detail replay on one screen at 1280, 375 and 320 px ...", d9:138 "should fit the Review card replay on one screen at 1280 and 375 px ...", d9:151 "should fit the Review card replay at 320 px with no sideways scroll". Move into d9ar's `expectPhoneLabels`: "BREN price" and "Trade P&L" present; "one Mark per session" and "dollars for the whole Position" absent; every "Sold" label reads "Sold 2"; Risk and Reward tags start with "$". d9's height rule that subtracted the bottom navigation is obsolete (the overlay now covers it) and is not moved. If the confirm step fails, d9:130 stays and only d9:208 drops.
- BD16 (high). Keep d9ar:256 "should move the slider by a tap on a session and a tap on a card’s heading". Drop d9ar:279 "should leave no hover box after a tap on a session". Move, after the first tap in :256: no `hover` test id, no `rect.hover-column`; the screenshot only if an evidence file uses it.
- d9:168 "should keep a focused replay control clear of the bottom navigation on a phone": **remove (yes).** See the decision below.
- After these, `e2e/d9/responsive-a11y.spec.ts` is empty: delete it. Re-point `plan/D09-trade-replay.md:910` (AC-UI-001, AC-UI-002, browser test B9.5, command `npx playwright test e2e/d9/responsive-a11y.spec.ts`) to B9AR.7, `npx playwright test e2e/d9ar/responsive-a11y.spec.ts`, with a short note "(since TD.3)".
- References (history, listed in the record): d9:130 and :151 in `evidence/D09AR/structural.md:1408`, `evidence/D09/structural.md:335`, `evidence/D09AR/tdd-log/T9AR.18-D1.md`, `evidence/D09/tdd-log/T9.18.md`, `T9.18-F2.md`, `T9.19-B1.md`; d9:208 in `evidence/D09/tdd-log/T9.18-F3.md`, `T9.18.md`; d9:168 (bug task T9.19-B7) in `evidence/D09/structural.md:340` and `evidence/D09/tdd-log/T9.19-B7.md`; d9ar:279 in `evidence/D09AR/tdd-log/T9AR.23.md:21`. The comment "T9.19-B8: the phone words ... on the Review card too" in d9's `throughSizes` is covered because d9ar:101 runs `expectPhoneLabels` on the Review card.
- Verify: before, `e2e/d9/responsive-a11y.spec.ts` and `e2e/d9ar/responsive-a11y.spec.ts`; after, `e2e/d9ar/responsive-a11y.spec.ts`; then `.claude/scripts/acceptance-commands.sh plan/D09-trade-replay.md` for the AC-UI row.

**Decision on d9/responsive-a11y.spec.ts:168: yes, a later test has made it obsolete.**

What :168 guards, from its own comment and message:

> `// T9.19-B7 (AC-UI-002, C9.4): Tabbing through the Review card's replay controls on a phone, none sits under the fixed bottom navigation, where its control and value cannot be seen.`
>
> `expect(result.hidden, \`${where}: "${result.label}" (y ${result.top} to ${result.bottom}) is under the bottom navigation (top ${result.navTop})\`).toBe(false);`

What removed that risk is d9ar's `expectOverlayCoversNavigation` (d9ar/responsive-a11y.spec.ts lines 45 to 54), not :170:

> `// The bottom navigation, where the page lays one out, lies under the overlay: what is at its centre belongs to the dialog.`
>
> `return hit?.closest('[role=dialog]') ? 'covered' : \`the navigation shows at its centre (${hit?.tagName})\`;`

It runs on both surfaces at 375 and 320, from d9ar's `throughSizes`, which :93 (Detail) and :101 (Review card) call:

> `if (size.width < 460) { ... await expectOverlayCoversNavigation(page, where); }`

If the overlay is drawn over the navigation, no control can sit under it. d9ar:170 only keeps Tab inside the overlay; it is not what makes :168 obsolete.

What is lost: :168's check is generic. It fails if anything covers a focused control's centre, or if the control is off screen. Nothing in d9ar checks that for every control (d9ar:348 checks only the slider's value for DALE at 320). This plan drops it with :168. If you want to keep it, TD.3 can add the one `elementFromPoint` check to d9ar:170's Tab loop at 375 instead (open question 4).

- **Answer 4 (keep the check):** before deleting d9/responsive-a11y:168, move its Tab loop and "nothing covers the focused control" assertion (the `elementFromPoint` check at each focused Replay control's centre, at 375 and 320 wide) into the d9ar Replay test beside `expectOverlayCoversNavigation`. Show it can fail (cover a control on purpose, e.g. a test-only style, then restore) and run that spec.

### TD.4 — How a replay ends, and No Mark said once (BD1, BD4) (Standard)

Files: `e2e/d9/states.spec.ts` (deleted), `e2e/d9ar/states.spec.ts`, `e2e/d9ar/overlay.spec.ts`, `e2e/d9ar/readout.spec.ts`, `e2e/d9ar/support.ts`, `plan/D09-trade-replay.md` (AC-CALC-004 row).

- BD4 (high). Keep d9ar/states:81 "should say No Mark once on Tue 11-10 with Add the Mark and a dash ...". Drop d9ar/readout:196 "should show R-CORV-D at Tue 11-10 with the dash named No Mark in the Trade P&L row, and the missing Mark said once on the replay". Move into states:81: the readout does not contain "Mark missing"; the count of /No Mark for|Mark missing/ is 1 (states:81 counts only "No Mark for"). d9/gaps:11 stays as it is.
- BD1. Keep d9ar/states:12 "should end K-sale on a Final result ...", d9ar/states:35 "should end R-DALE-U with no Mark while Settlement Due, then with a Final result ...", d9ar/states:72 "should show no Replay button on a Planned Trade", d9ar/overlay:11 "should open the overlay from the Replay button beside six drawers ...". Drop all four cases of `e2e/d9/states.spec.ts`:
  - :118 "should show no Replay button on a Planned Trade, and Plan and Risk selected" (high). Move nothing: the drawer list is in d8r/states:97, the missing button in d9ar/states:72.
  - :47 "should end K-sale on its sale with a Final result headline, ..." (medium, confirm first). Move into d9ar/states:12: chart words "Realized +$478", "Realized +$1,138", "Sold 2 at $4.00"; the six-drawer list; the step back to Thu Nov 12 ("+$982.00 · 3.03R", "Target reached, $26.00 past it.").
  - :75 "should end R-DALE-U at Fri 11-20 with no Mark while Settlement Due, then with a Final result ..." (medium, confirm first). Move into d9ar/states:35: the six drawers; Thu Nov 19 headline "+$564.00 · 0.37R"; after expiry the stake sentence "Nothing is at risk and nothing is left to gain." and "Expired" in the P&L chart.
  - :36 "should show the Replay button beside the six drawers on an Open Trade, with Today selected and no payoff line in the replay" (medium, confirm first). Move into d9ar/overlay:11: Today selected.
  - From all four: move `expectNoPayoffOrTheory` (now local to d9/states.spec.ts line 27; AC-CALC-004) into `e2e/d9ar/support.ts`, and call it from d9ar/states:12, :35 and overlay:11 (the Planned Trade has no replay to check).
- After these, `e2e/d9/states.spec.ts` is empty: delete it. Re-point `plan/D09-trade-replay.md` AC-CALC-004 (browser test B9.4, command `npx playwright test e2e/d9/states.spec.ts`) to `npx playwright test e2e/d9ar/states.spec.ts` with "(since TD.4)".
- References: none for these titles outside suite-run outputs.
- Verify: before, `e2e/d9/states.spec.ts`, `e2e/d9ar/states.spec.ts`, `e2e/d9ar/overlay.spec.ts`, `e2e/d9ar/readout.spec.ts`; after, the three d9ar files; then `.claude/scripts/acceptance-commands.sh plan/D09-trade-replay.md`.

### TD.5 — Escape on the small volatility chart (BD15) (Light)

Files: `e2e/d9/estimates-a11y.spec.ts`, `e2e/d9/estimates.spec.ts`.

- Keep d9/estimates:33 "should show W47’s chips for R-BREN-U on Mon 11-16, each estimate tagged, and open the volatility chip’s chart by keyboard".
- Drop the loop case d9/estimates-a11y:53 "should close the small chart on the first Escape, leave the overlay open and return the focus to the chip at ${size.width} px": its 320 case (high) and its 375 case (medium, confirm first). The loop's other case (:20) stays.
- Move into estimates:33: focus on the chip, `aria-expanded` "false", the overlay still open after 500 ms, a second Escape closes the overlay.
- References: none found.
- Verify: both files before and after.

### TD.6 — Readout figures on one line (BD10, BD11) (Standard)

Medium confidence, confirm first. Files: `e2e/d9ar/readout.spec.ts`, `e2e/d9/gaps.spec.ts`.

- BD10. Keep the loop at readout:264 "should keep every figure in the readout and the header on one line, sign with its number, at 1280, 1440, 1920, 375 and 320, ...". Drop the loop at readout:218 "should keep every readout figure on one line for ..." (5 cases). First add a whole-`.replay-value` one-line check to `brokenReadoutFigures` (readout.spec.ts:231): today it measures only `.card-figure` pieces and grid cells, so a value wrapping between two figures would pass. Add :218's fixtures BREN Wed 11-11 and CORV Mon 11-09 to :264's `places` (this adds two cases back, so BD10 saves three, not five).
- BD11. Keep readout:264 and sweep:24. Drop the loop at d9/gaps:94 "should keep a signed amount on one line in every grid cell at 1280, 375 and 320 wide, ..." (2 cases: R-DALE-D Fri 11-13, R-BREN-U Mon 11-02). Move into readout:264: "At Worst case" matches /^[−+]\$[\d,]+\.\d{2}$/. Confirm first that :264 or sweep:24 visits R-DALE-D Fri 11-13; if neither does, add it to :264's places.
- References: readout:218 in `evidence/D09AR/tdd-log/T9AR.23.md:16` (history). gaps:94 is named by the D9A-R defect table and task text (`plan/D09A-R-stage-a-refactor.md:239` and `:539`, defect 2, T9AR.13): add "(held by readout:264 and sweep:24 since TD.6)" to the defect row. History: `evidence/D09AR/structural.md:493`, `evidence/D09AR/tdd-log/merge6-S1.md:5`.
- Verify: `e2e/d9ar/readout.spec.ts`, `e2e/d9ar/sweep.spec.ts`, `e2e/d9/gaps.spec.ts` before and after.

### TD.7 — A started Action across the Review overlay (BD6) (Light)

Medium confidence, confirm first. File: `e2e/d9ar/review.spec.ts`.

- Keep :74 "should restore a started Action on each card after the Price History round trip, and save exactly it with one press" and :112 "should keep a started Action when the browser goes Forward to Price History and Back again after a round trip".
- Drop :28 "should keep a started Action across the overlay, return to the same session from Price History, and save with one press".
- Move into :74: no `.replay-card` in the card and no overlay before opening; headline "+$988.00 · 3.05R" on open and "+$982.00 · 3.03R" after return; focus on the card's Replay button after Close; zero Action entries after open, move and close (before the round trip).
- References: `evidence/D95/structural.md:147` uses review:28 as the timing sample for `enterTrade` (22.2 s to 2.0 s). That is a D9.5 record; leave it, and note in TD.7's record that the case is gone.
- Verify: `e2e/d9ar/review.spec.ts` before and after.

### TD.8 — Review meters and the walk's order (BD12, BD13) (Standard)

Medium confidence, confirm first. Files: `e2e/d9/meter-review.spec.ts` (deleted), `e2e/d5r/review.spec.ts`, `e2e/d5r/sliders.spec.ts`, `e2e/d5r/support.ts`, `plan/D09-trade-replay.md` (row at line 912).

- BD12. Keep d5r/review:9 "should open the first card not Done on load, ... five Action Entries stored". Drop d9/meter-review:46 "should keep the walk’s order and what each Action saves, through a save and a relaunch". Move: the card order at the start, after Marks are saved, at the end, and the same order after relaunch. `reviewMeters` lives in `e2e/d9/support.ts:268`; make it reachable from d5r through `e2e/d5r/support.ts` (re-export, or move it there and have d9 import it), not by a spec importing another folder's support.
- BD13. Keep d5r/sliders:57 "should draw T-A’s pointer right of break-even, ...". Drop d9/meter-review:11 "should name each card’s meter by W51, draw the dashed track on the card without a Mark and move the meter with the saved Mark". Move: dashed track on T-A before any Mark; `data-state` filled or empty on each card; after saving T-C's Mark, state filled, name /^P&L .../, track not dashed.
- After these, `e2e/d9/meter-review.spec.ts` is empty: delete it. Re-point `plan/D09-trade-replay.md:912` (AC-REV-002, browser test B9.8, command `npx playwright test e2e/d9/meter-review.spec.ts`) to `npx playwright test e2e/d5r/review.spec.ts` with "(since TD.8)".
- References: none for these titles outside suite-run outputs. `plan/D09C-handoff.md:18`, `plan/D09B-handoff.md:177` and `plan/D09-handoff.md:165` name the file in finished handoffs (history).
- Verify: before, `e2e/d9/meter-review.spec.ts`, `e2e/d5r/review.spec.ts`, `e2e/d5r/sliders.spec.ts`; after, the two d5r files; then `.claude/scripts/acceptance-commands.sh plan/D09-trade-replay.md`.

### TD.9 — Position drawer tables at 1280 (BD7) (Light)

Medium confidence (different fixtures), confirm first. Files: `e2e/d6/responsive-a11y.spec.ts`, `e2e/d7/responsive-a11y.spec.ts`.

- Keep d7:163 "should show the Position drawer tables of a Settlement Due option Trade spaced, with Lot Matches named once and every Open Lots column and figure inside its region at 1280 px".
- Drop d6:293 "should space the Position drawer tables, name Lot Matches once in visible text, and show every Open Lots column whole at 1280 px".
- Move into d7:163: the 8 px "touching cells" check and the header-not-truncated check. If either needs to live in a support file for both folders, use the existing shared one (`e2e/d7p/support.ts` is already imported across folders).
- If a moved check fails on the option fixture for a real reason, keep d6:293 (rule 6).
- References: d6:293 is bug task T8P.23-B4's case (`evidence/D08P/structural.md:1479`, `evidence/D08P/tdd-log/T8P.23-B4.md:7`, history).
- Verify: both files before and after.

### TD.10 — Records disagree badge on the Planned list (BD18) (Light)

Medium confidence, confirm first. File: `e2e/d2/ui-alignment.spec.ts`.

- Keep :602 "should keep a Records disagree badge inside the viewport with the Trade cell at 390 and 320".
- Drop :1576 "should keep a Records disagree badge inside the scroll region at 320 and 390".
- Move into :602: each Underlying and Trade cell, with its descendants, ends inside the scroll region (the stricter bound).
- References: none found outside suite-run outputs.
- Verify: `e2e/d2/ui-alignment.spec.ts` before and after.

### TD.11 — One complete cumulative run and the before/after comparison (Standard)

- Send one complete cumulative run to `suite-runner` with the full browser tier (`browser-full`), into the evidence folder (open question 2).
- Compare with the baseline: a full-tier run at TD.1's base commit (open question 5). Record per stage: browser test count, passed, skipped, and stage time; and the total. Expect 31 fewer run-time cases, less the two TD.6 adds back (29 net), if every confirm step passes; list any case kept by a confirm step or rule 6.
- Run `.claude/scripts/run-complete.sh` before recording.

## 4. Progress

| Task | Level | Status | Commits |
|---|---|---|---|
| TD.1 | Light | Done | 7aa0fd3f |
| TD.2 | Light | Done | 0944322e |
| TD.2-F1 | Light | Done | 149c26a5 |
| TD.3 | Standard | Done | 050d59a9 |
| TD.4 | Standard | Done | 9f05e3de |
| TD.5 | Light | Done | 739c0782 |
| TD.6 | Standard | Done | af8dbae1 |
| TD.7 | Light | Done | 3a283e13 |
| TD.8 | Standard | Not started | |
| TD.9 | Light | Not started | |
| TD.10 | Light | Not started | |
| TD.11 | Standard | Not started | |

## 5. Answers (the user, 2026-11-23)

1. **Worth it:** yes. "Getting rid of duplicate code is always worth it." All of TD.1, TD.2, TD.3, TD.4, TD.5, TD.6, TD.7, TD.8, TD.9, TD.10 are in.
2. **Evidence folder:** a new `evidence/Test-Dedup/` (`structural.md`, `tdd-log.md`, `suite-runs/`).
3. **Runs:** only test code is deleted, so each task runs just the spec files it modifies (through `with-browser-lock.sh`, port 5175). No per-task suite run, whatever the task's level. One complete cumulative suite run, TD.11, after every duplicate is removed.
4. **d9:168's generic check:** keep it. TD.3 moves :168's Tab loop with its "nothing covers the focused control" check (`document.elementFromPoint` at each focused Replay control's centre, at 375 and 320 wide) into the d9ar Replay test that checks the overlay covers the bottom navigation (`expectOverlayCoversNavigation`), shows it can fail (cover a control on purpose, then restore), then deletes :168.
5. **When:** after D9.5 is finished (its final gate, T95.67). The baseline for TD.11's comparison is a full run at TD.1's base.
   - **Changed 2026-11-23:** the user paused D9.5 after T95.15's clean ocr review ("Please don't start any new tasks. I want to get the test deduplication work done ASAP."). The dedup runs now. No separate baseline run (the user, 2026-11-23): the timings of T95.14's and T95.15's full runs (`evidence/D95/suite-runs/t95.14-save-marks-timings.md`, `t95.15-grid-keys-timings.md`) are the baseline. Once T95.15's run passes, the branch is pushed (the user's request) and TD.1 starts.
6. **Timings:** every full run from T95.14's onward writes per-stage timings to `evidence/D95/suite-runs/<label>-timings.md` (unit, integration, each browser stage, each check, total). TD.11 writes the same table to `evidence/Test-Dedup/` and compares it with the last D9.5 full run's timings and the TD.1-base run.

## 6. Not in this plan

- The merge candidates of the report's section 3 (M1, M2, M3, M4, M5, M6, M7, M8, M9, M10): same setup, different checks. Not duplicates.
- Building each big fixture once per worker and copying the saved browser profile (the report's "better idea").
- Width changes from `research/viewport-widths.md`, beyond the widths a kept test already covers.
- The other "checked, not duplicates" items of the report's section 3, including BD8.
