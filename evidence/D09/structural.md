# D09 structural evidence and run records

Stage A runs as a swarm (decision 111, agent cap 4). Each task's heading holds its lane tier, its ocr table and its bug tasks; merge runs are recorded under "Merge runs".

## Spec sections read beyond plan/spec-reading/D09.md

- None yet.

## Session reading (main session)

- Read in full: `plan/D09-trade-replay.md`, `plan/kickoff.md`, `.claude/docs/implementing.md`.
- From `plan/spec-reading/D09.md`, the main session read the ranges D9's tasks build on: `specs/design/trade-analysis.md` (3–48, 73–87, 94–99, 118–139), `specs/design/daily-review.md` (3–33, 66–71), `specs/design/ui-contract.md` (60–99, 108–127). The rest of the list is left to each task's brief, which names the ranges the task needs, to keep the coordinating session's context small. Listed in the handoff's open questions.
- `plan/implementation-plan.md`: decisions 100–117, the D08P, D8, D8R and D9 definitions. `research/replay-requirements.md`: the interview decisions and Round 2. D08P's A210, A211, A212, A213, A215, A216; D8R's A230, A240, W1.
- `prototypes/replay/round-2.html`, Corridor, R-BREN bullish at Mon Nov 16, looked at with Playwright at 1280, 375 and 320 px.

## T9.1 A third browser stage

- Lane TL, base `84d4ed50`, commit `adcc6abb` (on `d09/tl`, before rebase).
- Playwright `--list` with each script's folders and `--grep-invert @release-history`: `test:e2e:1` 126 tests (37 files); `test:e2e:2` 79 (42 files); `test:e2e:3` 57 (26 files, 15 of them `e2e/d8r`, so the `e2e/d8` pattern matches it). 126 + 79 + 57 = 262, gate-full1's total; no test in two stages.
- `run-complete.test.sh` passes, with three new cases (six files for the full tier; `browser-3` missing named).
- `test:e2e:release-history` unchanged: it names `e2e/d1` to `e2e/d7` only.
- Lane tier `T9.1` (`suite-runs/T9.1-*.txt`): unit 191 files, 2111 tests; integration 123 files, 269 tests; checks 14 of 14. "run complete".
- Note from the summary: `.claude/settings.json`'s allow list names `npm run test:e2e` and `npm run test:e2e *`, which may not match `npm run test:e2e:3`, as for `:1` and `:2`. Not changed (not the lane's file).
- The full tier's six stage files and stage times are checked by the merge run after wave 0.
- ocr (`ocr/T9.1-adcc6abb.json`): **No findings.** 5 files reviewed; `suite-runner.md` and `implementing.md` excluded (ocr skips `.md`).
- Merged by fast-forward as `adcc6abb` (the rebase changed nothing: no commit had landed since the base).

## T9.2 Freeze the replay view and chart props types

- Lane TY, base `84d4ed50`, commit `355a665d` (on `d09/ty`, before rebase).
- `typecheck`, `tsc6 --noEmit`, `lint` (0 errors; 2 existing warnings in `OwedDebtItem.tsx`), `lint:deps`: exit 0. Lane tier `T9.2`: unit 2111, integration 269, checks 14 of 14.
- Added: `evaluate.ts` `TradeOutcomes`, `TradeStandingReading`, `TradeEvaluation.outcomes?`, `.standing?`. `replay-series.ts` `ReplayFigures` (a `Pick` of `TradeEvaluation`), `ReplayMarkerFill` (action `Buy` | `Sell` | `Expire`, `price?` absent for an Expiration), `ReplayMarker`, `ReplayPlan` (three `Rational`s), `ReplayedSession.figures?`, `.riskChange?`, `.rewardChange?` (the existing `ReplayChange`), `.markers?`, result `plan?`. `replay-view.ts` `ReplayFigures`, `ReplayMarker`, `ReplayPlanColumn`, `ReplayFinal` (`Sold` | `Expired` with the contract), `ReplaySession.figures?`, `.riskChange?`, `.rewardChange?`, `.markers?`, `.final?`, `TradeReplayView.planColumn?`. `daily-review/types.ts` `DailyTradeReview.replay?: TradeReplayView`. New `src/ui/cockpit/replay/replay.types.ts`: `ReplayProps`, `ReplayFrameSession`, `ReplayPlotProps`, `PlotSession`, `PlotAnchors`, `PlotMarker`, `LabelledFigure`, `ReadoutValue`, `ReadoutRow`, `ReadoutGroup`, `TableRow`, `ReplayTone`; `plotBase` is `ReplayPlotProps` without the per-render fields.
- **Implementation-level decision (recorded, not a pending decision):** the view's Plan column is named `planColumn`, because `TradeReplayView.plan` already holds the pre-exposure Journal items (A252 names the result field `plan`; the domain result keeps `plan`).
- `src/app/types.ts` gained no re-exports: the new names are not exported from `trade-analysis/index.ts` or `trade-views/index.ts`, which lane TY doesn't own. The facade's existing `TradeReplayView` and `DailyTradeReview` carry the new fields. Left to lane RV (T9.6, T9.8) if a screen needs the names.
- ocr (`ocr/T9.2-355a665d.json`): **No findings.** 5 files reviewed.
- Rebased onto `2ddbba88` (only T9.1's tooling and evidence between; no file of T9.2's changed) and merged by fast-forward as `7251c72b`.

## T9.12 Corridor: the Underlying's price strip

- Lane CP, base `301aa24b`, commit `846683fe` (on `d09/cp`, before rebase). 7 cases green (`tdd-log/T9.12.md`).
- Lane tier `T9.12`: unit 2118, integration 269, checks 14 of 14. Lint: the 2 existing warnings only.
- **First-run pass:** "should size the price axis from the Plan's anchors and the revealed sessions": `priceRange` came with case 1's geometry. Mutation: `marks.length > 0` → `> 100`; `AssertionError: expected 48.6 to be greater than 48.6`; restored, green. Case 2's red covered only the shade and the "No Mark" label, since the line's break came with case 1's path code.
- No-arithmetic check (from the summary): the axis range and ticks come from finished anchor prices and revealed Marks; only SVG coordinates, a range pad and gridline ticks are worked out; gridline labels formatted by `axisMoney`.
- The prototype was not looked at in a browser by the task (the brief asked for it). Left to T9.13's brief, which repeats the instruction, and to the gate critic.
- P137: no words shortened. New words: none.
- `replay-plot.css` is not imported (`src/ui/cockpit/index.css` is no lane's).
- ocr round 1 (`ocr/T9.12-846683fe.json`), 1 finding:

| Severity | Location | Claim | Assessment | Outcome |
|---|---|---|---|---|
| medium | `corridor.tsx:1` | `replay-plot.css` is never loaded, so the chart renders with SVG defaults and no responsive sizing | Valid | Bug task T9.12-B1 |

- **T9.12-B1.** Finding: nothing imports `src/ui/cockpit/styles/replay-plot.css`. Defect: Corridor renders unstyled in the app. Case: "it should load every stylesheet under `src/ui/cockpit/styles/` from `src/ui/cockpit/index.css`". Fix: one `@import` line in `index.css`. Implementation-level decision: `index.css` is no lane's file in section 4.2, so lane CP takes it for this line; lane CF adds its own `replay-frame.css` line after B1 merges (T9.10's brief), so the two lanes never edit it at once.
- T9.12-B1 commit `7dc88a02`: `tools/cockpit-styles.test.ts` (new; red `expected [ 'replay-plot.css' ] to deeply equal []`, then green), one `@import` line in `index.css`. Lane tier `T9.12-B1`: unit 2119, integration 269, checks 14 of 14. ocr (`ocr/T9.12-B1-7dc88a02.json`): **No findings.**
- Rebased onto `94581d97` (evidence and Progress only between) and merged by fast-forward: T9.12 `9fbdd2f3`, T9.12-B1 `523decd4`.

## T9.3 Trade Analysis: the Trade's result at each boundary, and its standing

- Lane TA, base `301aa24b`, commit `4ad44271` (on `d09/ta`, before rebase). 16 planned cases green, plus one added case ("Unavailable naming the Underlying when only its Mark is missing": without it, an Underlying-price Stop with a missing Underlying Mark gave a Risk to stop of zero). Test names leave out `$` (it breaks `-t` filtering).
- Lane tier `T9.3`: unit 2128, integration 269, checks 14 of 14.
- **First-run passes (7), each with its mutation check** (`tdd-log/T9.3.md` has a note row for each): case 2 (`resultAt` priced a fixed 100 shares: '-5440/1' vs '-740/1'); case 3 (left out realized P&L: '-162/1' vs '316/1'); case 4 (the condition's own price, not its measurement: '-31836/1' vs '-1536/1'); case 5 (went through `marked(...)`: Unavailable vs '-318/1'); case 8 (a Value with nothing held); case 13 (`crossed: true` on the PastStop branch); case 16 (Unavailable AcknowledgedUnavailable whenever the Mark was absent). Each an assertion failure; each restored.
- Implementation-level decisions (recorded, not pending): the zone comes from dollars only, a result exactly on a line counting as past it (pastBy 0); `crossed` is true when any condition of that role is Breached or Reached. A crossed Underlying-price condition whose dollars are still short of the line stays `Between` with no `crossed` flag; A249 is silent on that direction and the zone is defined by dollars, so the replay follows `evaluate`'s own condition statuses for the crossing. `openProfitAtRisk` is always set on a standing Value (zero with no open profit). `atMaxReward` reuses `maximumIncrementalReward`. Case 14's break-even session is built in the test from R-AXIO-U at its fill.
- Test support added: `reference-trade.ts` `REPLAY_SESSION_DATES` (15 dates, 11-02 to 11-20), `ReplayTestSeries`, `R_AXIO_U`, `R_AXIO_D`, `AXIO`, `AXIO_LEG_ID`; `option-trade.ts` `R_BREN_U`, `K_SALE`, `R_CORV_D`, `R_DALE_D`, `R_DALE_U`, `BREN_CALL`, `CORV_PUT`, `DALE_PUT`. The test file's `evaluateAt(series, date)` helper derives at that day's 16:00 New York close.
- ocr round 1 (`ocr/T9.3-4ad44271.json`), 3 findings:

| Severity | Location | Claim | Assessment | Outcome |
|---|---|---|---|---|
| medium | `evaluate.ts:499` | For an open long Call past expiration, `atMaxReward` is a finite figure (the strike), because `maximumIncrementalReward` returns Unavailable(SettlementDue) before its Unbounded branch | Valid | T9.3-B1 |
| low | `outcomes.test.ts:28-29` | `evaluateAt` reads `series.held[i]!`; a series shorter than the sessions gives `undefined`, an Available Mark with no price, not Missing | Valid | T9.3-B2 |
| low | `evaluate.ts:524` | The nested ternary clamping open profit should be an if/else or a clamp helper | Doubtful (readability) | T9.3-B3 |

- **T9.3-B1.** Defect: a long Call held past its expiration session gets a finite result at the Max reward (the strike priced), against A248 ("Unbounded above for stock and a long Call"; none of the four reads a Mark). Case: "it should give a long Call held past its expiration a result at the Max reward that is Unbounded above".
- **T9.3-B2.** Defect: a test series with fewer Marks than sessions evaluates its later sessions as Available with an undefined price, breaking `reference-trade.ts`'s documented contract. Case: "it should evaluate a session beyond a shorter series' Marks as having no Mark".
- T9.3-B1 commit `f9db22e8`: red `expected { kind: 'Value', … } to match object { kind: 'Unbounded', … }` (R_BREN_U evaluated on 2026-11-23, still held, no Marks), then green. `atMaxReward` decides Unbounded from the Position's structure (lots held; stock or a Call) through a shared `unboundedReward()` helper; `maximumIncrementalReward`'s own result unchanged. Lane tier `T9.3-B1`: unit 2129, integration 269, checks 14 of 14. One invalid red row (a stray "it" prefix matched no test) is noted in the log. ocr (`ocr/T9.3-B1-f9db22e8.json`): **No findings.**
- T9.3-B2 commit `9a0d01de` (test only): red a runtime exception, "Invalid stored decimal: undefined" (R_AXIO_U cut to 3 Marks, evaluated on Fri 11-06 while held), then green with `?? null` in `evaluateAt`. Lane tier `T9.3-B2`: unit 2130, integration 269, checks 14 of 14. ocr (`ocr/T9.3-B2-9a0d01de.json`): **No findings.** The reviewer reviewed the test file in place (its instructions say every commit is reviewed in place, and `.claude/ocr-rule.json` brings `*.test.ts` files in), not relocated under `src/itg/d09/` as the handoff says; 1 of 1 file selected.
- **T9.3-B3.** A readability change with no behavior: the clamp becomes a named helper or if/else. No failing test is possible; verification is the T9.3 cases passing unchanged before and after (a refactor, recorded as such).
- T9.3-B3 commit `e5b5a31a`: the clamp in `standingOf` is an explicit if/else. `outcomes.test.ts` 19 passed before and 19 after. Lane tier `T9.3-B3`: unit 2130, integration 269, checks 14 of 14. ocr (`ocr/T9.3-B3-e5b5a31a.json`): **No findings.** All three T9.3 bug tasks are clean.
- Lane TA rebased onto `9849a614` (only lane CP's UI and the evidence between; no file of lane TA's changed) and merged by fast-forward: T9.3 `ad1ffc33`, B1 `8df5d829`, B2 `6791f5db`, B3 `2a9c512d`, and T9.9-B1 `516ba4c3` (ocr `ocr/T9.9-B1-910d1095.json`: **No findings**).

## T9.13 Corridor: the Trade P&L area, the two lines, the banked band and markers

- Lane CP, base `512ec7a1` (lane at `9849a614`), commit `02c047e7` (before rebase). 10 cases green (`tdd-log/T9.13.md`; cases 5 and 10 each have failed "green" rows kept as run, where the test's own helper or fixture was wrong and the test, not the code, was fixed). No first-run passes.
- Lane tier `T9.13`: unit 2129, integration 269, checks 14 of 14.
- The prototype was seen at 1280 px only; the plot was also rendered to static markup at 640 and 340 px. Browser checks at 375 and 320 px are left to T9.18 and the critic.
- No-arithmetic check (from the summary): every dollar figure arrives finished; the arithmetic is SVG positions, band and area geometry, and a 10% axis pad (`pnlRange`); the P&L range comes from break-even, the revealed sessions' figures and the Plan's two results, and Worst case and Max reward never stretch it.
- Implementation-level decisions: "the result" that is never dropped means the Stop and Target labels at the slider's session, the strip's Mark label and both stake tags (`PlotSession` has no label for the P&L value itself); marker labels are drawn once, in the P&L chart, with only the dashed line in the strip; the time axis's end label moved to the P&L chart; the Plan column has no label; the banked band follows the revealed sessions' finished `banked` figure and is not broken at a session with no Mark (realized P&L needs no Mark, A248); a cursor line and a dot per session in the P&L chart. `onSelectSession`, `onHoverSession`, `hoverIndex` still unused; the key (W44) is the frame's.
- P137: nothing shortened. New words: none ("Break-even" is W40).
- `axisMoney` now writes a minus sign for negatives.

## T9.9 Replay adapter: the headline and the stake sentence

- Lane CF, base `301aa24b`, commit `5849e9c2` (on `d09/cf`, before rebase). 12 cases green (`tdd-log/T9.9.md`; two invalid red rows, where the `-t` filter held a quote or a dollar sign and matched no test, are marked in the log, and the real reds follow).
- Lane tier `T9.9`: unit 192 files, 2123 tests; integration 269; checks pass. `verify:wording` exit 0.
- No first-run passes. P137: nothing shortened. New words: "No Mark." (see `new-words.md`).
- No-arithmetic check (from the summary): no add, subtract or divide on money, share or R; `share.mul(100)` only to format a finished share as a percent; `compare` against zero for sign, tone, zero overrun and "ahead". Figures from `standing.share`, `standing.pastBy`, `rewardRiskNow`, `planColumn.rewardRisk`, `standing.openProfitAtRisk`, the `figures` risk and reward fields, `outcomes.atStop`. Only `replay.props.ts` imports view types.
- Notes (not ocr findings):
  - The headline's R needs `currentMarkedPnlInPlanR` in `ReplayFigures`, which T9.2's `Pick` leaves out; the adapter reads it as an optional field through a widened input type. Carried to T9.4 in the handoff.
  - The side a price is "still" on ("though DALE is still above $54.00") comes from the existing `conditionDirection` helper, reading the held Instrument's right and the sign of the first position's quantity, and assuming long for stock.
  - A final session's "banked before the end" is the previous session's `realizedPnl`, selected, not calculated.
  - A Stop passed by exactly $0.00 reads "Past the Stop by $0.00 (0.00R)."; no approved row and no case covers it (W37 has "Target reached." for the Target side). For the stage report.
- ocr round 1 (`ocr/T9.9-5849e9c2.json`; one round of `replay.props.ts` hit a provider overload, `server_is_overloaded`, and the run still finished with no failed items), 3 findings:

| Severity | Location | Claim | Assessment | Outcome |
|---|---|---|---|---|
| medium | `replay.props.ts:37` | The adapter reads `figures.currentMarkedPnlInPlanR`, which the production view never carries, so the headline's R never shows | Valid | T9.9-B1 (lane TA) |
| medium | `replay.props.test.ts:54` | The fixture adds `currentMarkedPnlInPlanR` by intersection, so the headline cases pass with an R a production-shaped view can't supply | Valid | T9.9-B3 (lane CF, after B1 merges) |
| low | `replay.props.ts:102` | Nested ternaries (lines 28, 57, 67, 102) | Doubtful (readability) | T9.9-B2 (lane CF) |

- **T9.9-B1 (lane TA).** The fix lies in Trade Analysis, which lane CF may not edit: `ReplayFigures` (`replay-series.ts`) gains `currentMarkedPnlInPlanR` in its `Pick`, so the view carries the Trade P&L in Plan R per session (W36, A250 "exactly as `evaluate` returns them"). Type-only now; T9.4 fills `figures` from `evaluate`, so the field comes with it and T9.4's first case asserts it. Verification: `typecheck`. Runs in lane TA after T9.3-B3, and merges with T9.3. Implementation-level decision: an ocr bug task run in the lane that owns the file.
- **T9.9-B2 (lane CF).** Readability, no behavior: the nested ternaries become if/else or small named functions. Verification: `replay.props.test.ts` unchanged before and after.
- T9.9-B1 commit `910d1095` (lane TA): `currentMarkedPnlInPlanR` added to `ReplayFigures`' `Pick`; the view's `ReplayFigures` is derived (`NonNullable<ReplayedSession['figures']>`), so `replay-view.ts` needed no edit. `typecheck`, `tsc6`, `lint`, `lint:deps` exit 0. Lane tier `T9.9-B1`: unit 2130, integration 269, checks 14 of 14.
- T9.9-B2 commit `dcf5f90d`: `toneOf`, the final-result sentence (a named `ending`), the Ahead/Behind return and the stake sentence's `cap` are if/else; `plannedAmountWords`' single ternary left. `replay.props.test.ts` 12 of 12 before and after. Lane tier `T9.9-B2`: unit 2123, integration 269, checks 14 of 14. ocr (`ocr/T9.9-B2-dcf5f90d.json`): **No findings.**
- **T9.9-B3 (lane CF).** After B1 merges and lane CF rebases: `ReplayWordsView`'s widening and the fixture's intersection go; the fixture is built from the real `TradeReplayView`. Verification: `typecheck` and the 12 cases unchanged. T9.9 merges after B3.

## Merge runs

### wave0 (on `1aa7c69e`, after T9.1 and T9.2)

- Browser tier: full (`first matching path since 84d4ed50: package.json`). The first run with three browser stages.
- Unit 191 files, 2111 tests; integration 123 files, 269 tests; browser-1 126 passed (5.4 min); browser-2 79 passed (5.0 min); browser-3 56 passed, **1 failed** (4.4 min); checks 14 of 14. `run-complete.sh`: run complete (six stage files).
- The failure: `e2e/d8/responsive-a11y.spec.ts:299`, B8.16 "should complete a Restore with the keyboard only, every focused control showing a focus ring", `TimeoutError: page.waitForEvent: Timeout 15000ms exceeded while waiting for event "filechooser"` (`chooseFile`, `e2e/d8/support.ts:43`). Not one of P138's known flaky cases.
- Reproduction (main session, under the lock): the case alone passed (2.1 s); the whole `test:e2e:3` stage again passed 57 of 57 in 4.2 min (`suite-runs/wave0-browser-3-rerun.txt`). It did not reproduce, so no failing test can be written for it, and wave 0 changed no product or test code. Logged as an unreproduced browser failure (a suspected flake) for the stage report; if it fails again in a later run, it becomes a pending decision under P138's spirit.
- Stage times: none near 8 minutes, so the third stage meets T9.1's expected result.
