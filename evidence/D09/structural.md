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

## Merge runs

### wave0 (on `1aa7c69e`, after T9.1 and T9.2)

- Browser tier: full (`first matching path since 84d4ed50: package.json`). The first run with three browser stages.
- Unit 191 files, 2111 tests; integration 123 files, 269 tests; browser-1 126 passed (5.4 min); browser-2 79 passed (5.0 min); browser-3 56 passed, **1 failed** (4.4 min); checks 14 of 14. `run-complete.sh`: run complete (six stage files).
- The failure: `e2e/d8/responsive-a11y.spec.ts:299`, B8.16 "should complete a Restore with the keyboard only, every focused control showing a focus ring", `TimeoutError: page.waitForEvent: Timeout 15000ms exceeded while waiting for event "filechooser"` (`chooseFile`, `e2e/d8/support.ts:43`). Not one of P138's known flaky cases.
- Reproduction (main session, under the lock): the case alone passed (2.1 s); the whole `test:e2e:3` stage again passed 57 of 57 in 4.2 min (`suite-runs/wave0-browser-3-rerun.txt`). It did not reproduce, so no failing test can be written for it, and wave 0 changed no product or test code. Logged as an unreproduced browser failure (a suspected flake) for the stage report; if it fails again in a later run, it becomes a pending decision under P138's spirit.
- Stage times: none near 8 minutes, so the third stage meets T9.1's expected result.
