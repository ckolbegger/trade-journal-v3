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

## T9.4 Trade Analysis: each session's risk, reward and condition status

- Lane TA, base `bf1c01b9`, commit `1c6c4ec1` (before rebase). 7 cases green (`tdd-log/T9.4.md`). Lane tier `T9.4`: unit 2145, integration 269, checks 14 of 14.
- **First-run passes (4), each with its mutation check:** the results stepping on a sale (`atStop` set to `atTarget`: '956/1' vs '-324/1'); each session's own status across a gap (Stop and Target roles swapped); Tue 11-10's figures Unavailable naming the put (Unavailable risk replaced by a Value of 0); the change across a gap (a session without the figure resets the latest: undefined vs `{ since: '2026-11-09', … }`). Each an assertion failure; each restored. In case 1's green the Underlying frame (case 2's behavior) was written early, then reverted for a genuine red on case 2, and re-added (noted in the log).
- Implementation-level notes: `replay` now evaluates every session, flat ones included (the last position's Instrument, or the Plan's first leg, with a Missing frame where the session has none); a flat session's Trade P&L is still the realized amount. `riskChange`/`rewardChange` are left out with no earlier session holding the figure as a Value. `tradePnlOf` became `evaluationOf` and `frameFor`. Test helpers `sessionsOf`, `sessionAt`, `figuresAt` are in `replay-series.test.ts`.
- ocr round 1 (`ocr/T9.4-1c6c4ec1.json`), 1 finding: low, style, `replay-series.test.ts:165`, the test helper's loose `price == null`; Doubtful (it covers exactly `null` and `undefined`; no `eqeqeq` rule; 11 other loose uses in `src`). Outcome: **T9.4-B1**, `=== null || === undefined` (or the helper's type narrowed), verification `replay-series.test.ts` unchanged before and after. The reviewer's own reading of `replay-series.ts` against A250 found no defect.
- T9.4-B1 commit `611bb798`: line 165 `price === null || price === undefined`. `replay-series.test.ts` 17 passed before and after. Lane tier `T9.4-B1`: unit 2145, integration 269, checks 14 of 14. ocr (`ocr/T9.4-B1-611bb798.json`): **No findings.**
- Rebased onto `37ebf97e` (lane CF's T9.9 and evidence between; no file of lane TA's changed) and merged by fast-forward: T9.4 `7ee4e93a`, B1 `b565f15e`.

## T9.5 Trade Analysis: markers and the Plan column

- Lane TA, base `b565f15e`, commit `6e171f5f` (before rebase). 8 cases green (`tdd-log/T9.5.md`); the two-Position-Changes case builds its Trade in the test from R-BREN-U (a later sale of 1 at 4.10, handed over in reverse). Test names reword "$", "-" and "+" amounts.
- **First-run pass:** "should leave the Plan column unchanged after a second lot": the Plan code reads the whole record's Plan Baseline. Mutation `atStop` as `ZERO.add(oneR)`: `AssertionError: expected '600/1' to be '-600/1'`; restored. The fact-order sort was written ahead of its case, then removed for a genuine red and restored (in the log).
- Lane tier `T9.5`: unit 1 failure, `TradeList.test.tsx` "should render distinct Loading, Ready, Empty …" — P138's known flaky case; it passed alone (36 of 36), so the tier counts as passed; integration 269; checks 14 of 14. Trade Analysis 237 of 237.
- Implementation-level notes: `markers` is always set (an empty array for a session with no Position Change), though the type still declares it optional; effect is Opened when nothing was open before, Closed when nothing is open after, else Added or Reduced by the change in open quantity's size; an Expiration has one fill `{ instrument, action: 'Expire', quantity }` with no `price`. `plan` is from the whole record's Plan Baseline.
- ocr round 1 (`ocr/T9.5-6e171f5f.json`), 2 findings:

| Severity | Location | Claim | Assessment | Outcome |
|---|---|---|---|---|
| medium | `replay-series.ts:141` | Markers come from the whole record, chosen by Position Change id, so a Position Change whose fills straddle a session's close shows its later fills (and an effect counting them) in the earlier session, while that session's Position and P&L (`derive` at the cutoff) leave them out | Valid | T9.5-B1 |
| low | `replay-series.ts:175` | The nested ternary picking Opened, Closed, Added or Reduced | Valid (readability) | T9.5-B2, structural |

- **T9.5-B1.** Case: "it should list only the fills up to the session's close in a Position Change that straddles it, with the effect they make".
- T9.5-B1 commit `8cf1f154`: red `expected [['pc-bren-2','Closed']] to equal [['pc-bren-2','Reduced']]` (R-BREN-U with pc-bren-2 a sale of 4: 2 at 4.00 on 11-12, 2 at 4.10 on 11-13 after 11-12's close), then green. `markersOf(record, cutoff)` filters fills by `atCutoff`'s rule, per session; the effect uses the open quantity the kept fills make. Lane tier `T9.5-B1`: unit 2166, integration 269, checks 14 of 14. The later fills get no marker on any day (the Position Change is listed only in its first fill's session, A211): **PD1** in `DECISIONS-PENDING.md`. ocr (`ocr/T9.5-B1-8cf1f154.json`): **No findings.**
- **T9.5-B2.** Readability: the effect as an if/else chain; verification `replay-series.test.ts` unchanged before and after.
- T9.5-B2 commit `b8265864`: `replay-series.test.ts` 26 passed before and after. Lane tier `T9.5-B2` (run before the commit, so headed "8cf1f154 + uncommitted changes"): unit 2166, integration 269, checks 14 of 14. ocr (`ocr/T9.5-B2-b8265864.json`): **No findings.**
- Lane TA rebased onto `801c5ff8` and merged by fast-forward: T9.5 `1bbca00d`, B1 `f9b9172f`, B2 `f670c081`. Lane TA's tasks are all done.

## T9.11 Replay frame: the readout, the table, hover and tap

- Lane CF, base `62e57929` (lane at `801c5ff8`), commit `cf9585f2` (before rebase). 10 cases green (`tdd-log/T9.11.md`). Lane tier `T9.11`: unit 2190, integration 269, checks 14 of 14.
- **First-run passes (2), each a pass-through of the props:** "Final result in place of the first two groups" (mutation: filter out the group titled "Final result": a heading-list assertion failed) and "No Mark in its cells" (mutation: render "No Mark" as "Mark": a cells-list assertion failed); each restored. The Events case's code was written ahead, then removed for a genuine red (`'' vs 'Sold 2 at $4.00; Stop moved'`) and restored.
- `replayProps(view)` is still not written: no case needed it. The adapter must build a final session's groups and write "No Mark".
- **The real `CorridorPlot` has no hover or tap.** The frame holds `hoverIndex` and passes `onHoverSession`/`onSelectSession` to `Plot`, but `CorridorPlot` (lane CP, merged) never calls them. It needs a focusable hit area per revealed session (44 px touch target) calling `onHoverSession(i)` on pointer enter and focus, `onHoverSession(null)` on leave and blur, `onSelectSession(i)` on click or tap, and marking `hoverIndex`. No planned case covers this in the real plot: **PD2** in `DECISIONS-PENDING.md`.
- No-arithmetic check (from the summary): finished strings from props only. P137: no change; the frame adds only W45's "Session" and "Events" headings. Test names reworded without apostrophes. `renderLinks` is still not rendered.
- ocr round 1 (`ocr/T9.11-cf9585f2.json`), 5 findings. A second review round on `frame.tsx` inside the run failed on a provider overload, so its coverage of `frame.tsx` may be partial; the bug tasks' reviews read it again.

| Severity | Location | Claim | Assessment | Outcome |
|---|---|---|---|---|
| medium | `frame.tsx:57` | The real `CorridorPlot`, `PriceStrip` and `PnlChart` never call `onHoverSession`/`onSelectSession`, so hover and tap do nothing outside the test double | Doubtful (accurate; no planned case covers the real plot) | T9.11-B5, lane CP |
| medium | `frame.tsx:14` | `hoverIndex` isn't reset when `tradeKey` changes, so a Trade switch mid-hover shows the new Trade's session at the old index | Valid | T9.11-B1 |
| medium | `frame.test.tsx:236` | The readout tests use only the last session, so they'd pass if the readout always showed the last session | Valid | T9.11-B2 |
| low | `frame.test.tsx:257` | The plot double drops `describedBy`, so removing it from the plot call would still pass | Valid | T9.11-B3 |
| low | `replay-frame.css:155` | `.replay-table summary { display: flex }` removes the disclosure marker, so the folded table has no open or closed cue | Valid | T9.11-B4 |

- PD2 is withdrawn: ocr raised the real plot's hover and tap itself, so it is a bug task by the rule. B5 (lane CP) and B1 (lane CF) run at once: different lanes, no shared file; B2, B3 and B4 follow in lane CF one at a time. T9.11 is mergeable when all five are clean.
- **T9.11-B5.** Cases (`corridor.test.tsx`): "it should report hover and focus on a revealed session, and its end on leave and blur"; "it should select a revealed session on a click or tap"; "it should mark the hovered session".
- T9.11-B5 commit `589c1d28` (lane CP, from `342a45dc`): three cases green. Reds: the first a thrown `Unable to find an accessible element with the role button` (no hit areas existed: behavior absent, accepted as valid red), then two assertion failures. The click handler and `data-hovered` were written ahead, removed before the first green, and restored after their reds. One `button.replay-hit` per revealed session in `div.replay-hits[role=group][aria-label=Sessions]`, a sibling of the `role="img"` wrapper inside `div.replay-plot-frame`; named by the date label; at least 44 px wide; the hover mark is `rect.hover-column` in each chart, tinted and dashed. Lane tier `T9.11-B5`: unit 2192, integration 269, checks 14 of 14.
- T9.11-B5 ocr (`ocr/T9.11-B5-589c1d28.json`), 2 findings:

| Severity | Location | Claim | Assessment | Outcome |
|---|---|---|---|---|
| medium | `corridor.tsx:24-26` | Pointer leave and blur each send `onHoverSession(null)` on their own, so after a click focuses a session, moving the pointer off clears the hover though the button keeps focus (and leaving another hovered session doesn't restore the focused one) | Valid | T9.11-B6 |
| medium | `replay-plot.css:252` | `.replay-hit { min-width: 44px }` centred on columns about 18 px apart at 340 px wide (about 39 px at 640 px, 15 slots), so neighbouring targets overlap and a tap can select the next session | Valid | T9.11-B7 |

- **T9.11-B6.** Case: "it should keep a focused session marked when the pointer leaves, and return to it when the pointer leaves another".
- T9.11-B6 commit `f52b10a5`: red `expected [ 1, 2, null ] to deeply equal [ 1, 2, 1 ]`, then green. `SessionHits` keeps the pointer's and the focused session in a ref and reports `pointer ?? focus`. Lane tier `T9.11-B6`: unit 2193, integration 269, checks 14 of 14. ocr (`ocr/T9.11-B6-f52b10a5.json`): **No findings.**
- **T9.11-B7.** Implementation-level decision (recorded, not pending): each hit area spans exactly its session's column, edge to edge, so targets never overlap; where a column is narrower than 44 px, the slider and its Previous and Next buttons (W42, full-size) are the equivalent way to reach every session (the target-size rule's equivalent-control exception). Case: "it should give each session a target that never overlaps its neighbour's, at a phone's width".
- T9.11-B7 commit `2dc2080e`: the first red was invalid (exit 0: centre plus column width already equals the next centre); the case was strengthened to pin the first hit's left to slot 0's column edge from `timeAxis(340, 15)`, then a valid red `expected 19.816 to be close to 17.13235294117647`, then green. `left` is now the column's left edge, `width` the column; `min-width: 44px` and `translateX(-50%)` removed. Lane tier `T9.11-B7`: unit 2194, integration 269, checks 14 of 14. ocr (`ocr/T9.11-B7-2dc2080e.json`): **No findings.**
- Lane CP rebased onto `a2df53de` and merged by fast-forward: T9.11-B5 `65b5ba3c`, B6 `69cd07c8`, B7 `a9183904`. T9.11 is marked Done when lane CF's part merges.
- **T9.11-B1.** Case: "it should clear the hover when another Trade's replay is passed in".
- T9.11-B1 commit `a448021b`: red `expected <div class="replay-hover" …> to be null`, then green. The Trade-switch branch that resets the held date also clears `hoverIndex`. Lane tier `T9.11-B1`: unit 2191, integration 269, checks 14 of 14. ocr (`ocr/T9.11-B1-a448021b.json`): **No findings.**
- **T9.11-B2.** Case: "it should show the readout of the slider's session, not the last".
- T9.11-B2 commit `ce8e32af` (test only): **first-run pass**, as expected (the frame reads `session.readout`). Mutation: the readout maps `sessions[last].readout`: `AssertionError: expected 'MarksBREN Mark$110.00' to contain '$103.00'`; restored. Lane tier `T9.11-B2`: unit 2192, integration 269, checks 14 of 14. ocr (`ocr/T9.11-B2-ce8e32af.json`): **No findings.**
- **T9.11-B3.** Case: "it should give the plot the table's id to describe it".
- T9.11-B3 commit `ba52e7cc` (test only): **first-run pass**, as expected (`describedBy` reaches the plot through the `plotBase` spread). The plot double now sets `aria-describedby`. Mutation: `describedBy=""` after the spread: `AssertionError: expected '' to be 'bren-table'`; restored. Test name "the table id" (no apostrophe). Lane tier `T9.11-B3`: unit 2193, integration 269, checks 14 of 14. ocr (`ocr/T9.11-B3-ba52e7cc.json`): **No findings.**
- **T9.11-B4.** Case: "it should show whether the table is folded or open".
- T9.11-B4 commit `5ea8fd77`: red a runtime `TypeError` reading `textContent` of null (no cue element: behavior absent, accepted as valid red), then green. An `aria-hidden` `span.replay-table-cue` in the summary shows ▸ folded, ▾ open, from the `details` element's `onToggle`. The W45 fold case's summary-text assertion now strips the glyph (in the refactor row). Lane tier `T9.11-B4`: unit 2194, integration 269, checks 14 of 14. ocr (`ocr/T9.11-B4-5ea8fd77.json`): **No findings.**
- Lane CF rebased onto `c183e890` and merged by fast-forward: T9.11 `b6701de5`, B1 `1b092cdd`, B2 `691b16b8`, B3 `bf9d8758`, B4 `82154dd3`. Lane CF's tasks are all done.

## T9.14 Trade Detail: the Replay drawer

- **Who writes `replayProps(view)`** (implementation-level decision, recorded): no case in T9.9, T9.10 or T9.11 needed the full adapter, so it is unwritten. T9.14 writes it in `replay.props.ts` (lane CF is finished, so the file is free), with its own cases in `replay.props.test.ts` for each part its seam draws from (slider text, headline, readout groups, table rows, plot sessions), using only section 1.6's approved words and the domain's finished values. T9.15 then uses it as merged; if T9.7 merges before T9.14, T9.15 waits for T9.14 rather than writing a second adapter.

## T9.6 The shared replay assembly; `replayTrade` carries the new fields

- Lane RV, base `342a45dc` (code `f670c081`), commit `cfd8e482` (before rebase). Refactor step: the assembly moved to `src/coordinators/replay/assemble-replay.ts` (`assembleReplay(deps, analysis, whole, session)`, plus `index.ts`); `replay-trade.test.ts` 10 files, 87 tests before and after (one import path changed). 6 cases green (`tdd-log/T9.6.md`). Lane tier `T9.6`: unit 2195, integration 269, checks 14 of 14.
- **First-run passes (3), each with its mutation check:** case 1 (built by T9.4 and T9.5; mutation: each session's `markers` as `[]`: `expected [] to deeply equal [ [ 'Execution', 'Opened' ] ]`); case 5, Settlement Due (built by revision 98 and the `terminalTime === null` guard in `finalOf`; mutation: guard removed: `expected false to be true`); case 6, each series read once (mutation: one series read twice: `expected [ 'BREN', 'BREN', … ] to deeply equal [ 'BREN', 'BREN261120C00100000' ]`). Each restored. Case 4 (Expired) passed first because its branch was written with case 3; reverted for a genuine red and restored.
- Implementation-level notes: `final` is worked out in the assembly from `terminalPositionChangeOf`: `Expired` when that change has an option settlement (naming the last settled contract), else `Sold`. `assembleReplay` takes no end date yet; T9.7 adds the Review Date. No re-exports of the new type names were added. Test helper `seriesStack(series, strategyKey, now, options)` in `replay-trade.test.ts` (T9.7 may lift it into `tests/support/`).
- ocr round 1 (`ocr/T9.6-cfd8e482.json`, the second run; the first failed on a provider stream error), 1 finding: medium, `assemble-replay.ts:139`: `final` goes on the last replayed session of any Closed Trade, so when the closing fill comes after the last completed session's close, that session reads Sold while its Position is still open and its P&L is not the realized result (breaks A253). Valid. Outcome: **T9.6-B1**, case "it should flag nothing final when the Trade closed after the last completed session".
- T9.6-B1 commit `ade9d8db`: red `expected false to be true` (K-sale, `now` 2026-11-13T18:00Z, the closing sale at 15:00Z before that session's 21:00Z close: the last session, 11-12, wrongly carried `final: Sold`), then green. A first draft's mismatch (10 sessions, since the series follows the calendar) was not taken as red; a note row records it. `assembleReplay` computes `final` only when the last session's close is at or after `terminalTime`. Lane tier `T9.6-B1`: unit 2196, integration 269, checks 14 of 14.
- Noted by the bug task, not an ocr finding (no bug task): `ended` is still true for such a Trade, so `placeJournal` puts Journal items after the last session on it and `pending` is null. This placement predates D9.
- T9.6-B1 ocr (`ocr/T9.6-B1-ade9d8db.json`): **No findings.** Lane RV rebased onto `45fe4ed0` and merged by fast-forward: T9.6 `8c810c83`, B1 `40b6263e`.

## T9.7 Daily Review: the card's replay, to the Review Date

- **Before the brief (the handoff's T9.7 note):** the card a Save Marks result returns is built by `postMarksReview` (`daily-review.ts:867`), which calls `readTrade` (line 872), the same function `getTrade` is (line 720), through `assembleTrade` (line 628). A254's assumption holds: the replay added in `assembleTrade` reaches the Save Marks card with no further read. No pending decision.

- Lane RV, base `40b6263e` (lane at `632a7feb`), commit `f51a3f73` (before rebase). 6 cases green (`tdd-log/T9.7.md`). No end-date parameter was needed: the Review read session already ends the series at the Review Date. The replay is built only when the whole-lifetime derivation is Derived and the Trade has Position Changes. `seriesStack` copied into `tests/support/replay-series-stack.ts` (the original in `replay-trade.test.ts` stays).
- **First-run passes (5), each with its mutation check:** case 2 (mutation: a Current read session in place of the Review one: `expected [ …(13 dates) ] to deeply equal [ …(11 dates) ]`; mutating `assembleReplay`'s `to` did not fail it, since Market Data's `series` uses the session's own date); case 3 (drop the first session: an assertion failure); case 4 (drop the Derived guard: `TypeError … reading 'filter'`); case 5 (one series read per eligible Trade inside `open`: `expected [ 'XYZ' ] to deeply equal []`); case 6 (drop `replay` from the card in `postMarksReview`: `TypeError … reading 'sessions'`). Each restored. Three fixture faults in early runs are noted in the log as not reds.
- **Lane tier `T9.7`: unit 2207, checks 14 of 14, integration 3 failures caused by this task:**
  - `tests/integration/d7sp/review-query-count.test.ts` "should add at most one observations read for the Trade dated line in getTrade": 2 more `observations` `byInstrumentDate` `getAll` reads. **Planned:** I9.6 (section 4) says `getTrade` adds one series read per Instrument (R-BREN-U: the call and BREN). Decision (recorded): this case's bound rises by one series read per Instrument, citing I9.6; that is the only change to its expected values.
  - `tests/integration/d5r/query-count.test.ts` "should save 1 Marks …" and "should save 3 Marks … then assemble as a Trade Action save does": one more `readonly` snapshot where none was expected. **Not planned** by I9.6 (a series read, not a snapshot), and it may mean the post-save card reads its replay outside the card's one revision (A46). Sent to a fresh subagent, **T9.7-F1**: make the replay's reads join the card's existing read so no snapshot is added; if that cannot be done inside lane RV's files, stop and report (a pending decision).
- T9.7-F1 stopped with no change: the snapshot is the Journal's `TradeNarrative` query in `assembleReplay` (not the series read, which uses the Review read session as I9.6 says); `Journal.query` always opens its own snapshot, and the Journal has no read session to join. Before T9.7 the Marks card's Trade (no Debt) made no narrative read; the replay now makes one per card. **PD3** in `DECISIONS-PENDING.md`; T9.7 is parked, and the d7sp bound change waits with it.

## T9.10 Replay frame: the slider reveals sessions

- Lane CF, base `2d81aafc` (lane at `2102f1d4`), commit `eda3cb8a` (before rebase). 8 cases green (`tdd-log/T9.10.md`). Lane tier `T9.10`: unit 2158, integration 269, checks 14 of 14 (`verify:wording` included).
- **First-run pass:** "should start from a given session when one is passed in": the `initialSession` handling came with the third case, which opens on a given session. Mutation `given < 0 ? last : given` → `last + 0 * given`: `AssertionError: expected '10' to be '8'`; restored. The "keeps the session" case's red came from its other-Trade-resets half; its keep half passed first.
- Notes: the frame handles ArrowLeft, ArrowRight, Home and End itself (a range input steps differently in jsdom and the browser); the slider's session is held as a date plus the Trade key and falls back to the last session when the date is gone; the frame also renders `stake` and the `renderSince`, `renderChips` slots, which no case covers yet; `replayProps(view)` is still not written (T9.11 or T9.14). The prototype was not looked at in a browser.
- No-arithmetic check (from the summary): "11 of 15" is the adapter's `sliderValue`; the edge colour follows `headline.tone` through `data-tone`.
- P137: the Previous and Next buttons show the glyphs ‹ and ›, with "Previous session" and "Next session" as their accessible names (recorded in `words-changed.md`). New words: none.
- ocr round 1 (`ocr/T9.10-eda3cb8a.json`), 2 findings:

| Severity | Location | Claim | Assessment | Outcome |
|---|---|---|---|---|
| medium | `frame.tsx:18` | `ReplayProps.onSessionChange` is never called, so a parent is never told when the session changes | Valid | T9.10-B1 |
| medium | `frame.tsx:8` | With no `initialSession`, the held date stays undefined until the user moves, so a session appended before any interaction moves the slider to the new last session | Doubtful | T9.10-B2 |

- **T9.10-B1.** Defect: the screen can't keep the slider's session (A257; the Review's round trip, P129). Case: "it should tell the screen the slider's new session when it moves".
- T9.10-B1 commit `eb181921`: red `expected last "vi.fn()" call to have been called with [ '2026-11-13' ]`, then green. `onSessionChange(date)` is called on a move by a button, a key or the range input, only when the date changes; not on first render, a Trade change or an appended session. Lane tier `T9.10-B1`: unit 2159, integration 269, checks 14 of 14. ocr (`ocr/T9.10-B1-eb181921.json`): **No findings.**
- T9.10-B2 commit `9dee11cb` (test only): **first-run pass**, as expected. Mutation: the held date starts as `initialSession ?? sessions[last]?.date` (an unmoved slider holds the first-rendered last session): `AssertionError: expected '10' to be '11'`; restored. Lane tier `T9.10-B2`: unit 2160, integration 269, checks 14 of 14. ocr (`ocr/T9.10-B2-9dee11cb.json`): **No findings.**
- Lane CF rebased onto `16b88fc8` and merged by fast-forward: T9.10 `0e0a8efb`, B1 `b3f0a4c7`, B2 `62e57929`.
- **T9.10-B2.** Implementation-level decision (recorded, not pending): the current behavior is the intended one. A slider the trader hasn't moved rests on the newest session, so after Save Marks the Review card shows the new Mark's session (T9.15's third case, A254); a slider the trader moved keeps that session (T9.10's seventh case, A257). The bug task pins this with a case, "it should follow a new last session when the slider has not been moved, and keep a moved slider's session"; it is expected to pass on its first run, and gets the mutation check.

## T9.13 Corridor: the Trade P&L area, the two lines, the banked band and markers

- Lane CP, base `512ec7a1` (lane at `9849a614`), commit `02c047e7` (before rebase). 10 cases green (`tdd-log/T9.13.md`; cases 5 and 10 each have failed "green" rows kept as run, where the test's own helper or fixture was wrong and the test, not the code, was fixed). No first-run passes.
- Lane tier `T9.13`: unit 2129, integration 269, checks 14 of 14.
- The prototype was seen at 1280 px only; the plot was also rendered to static markup at 640 and 340 px. Browser checks at 375 and 320 px are left to T9.18 and the critic.
- No-arithmetic check (from the summary): every dollar figure arrives finished; the arithmetic is SVG positions, band and area geometry, and a 10% axis pad (`pnlRange`); the P&L range comes from break-even, the revealed sessions' figures and the Plan's two results, and Worst case and Max reward never stretch it.
- Implementation-level decisions: "the result" that is never dropped means the Stop and Target labels at the slider's session, the strip's Mark label and both stake tags (`PlotSession` has no label for the P&L value itself); marker labels are drawn once, in the P&L chart, with only the dashed line in the strip; the time axis's end label moved to the P&L chart; the Plan column has no label; the banked band follows the revealed sessions' finished `banked` figure and is not broken at a session with no Mark (realized P&L needs no Mark, A248); a cursor line and a dot per session in the P&L chart. `onSelectSession`, `onHoverSession`, `hoverIndex` still unused; the key (W44) is the frame's.
- P137: nothing shortened. New words: none ("Break-even" is W40).
- `axisMoney` now writes a minus sign for negatives.
- ocr round 1 (`ocr/T9.13-02c047e7.json`), 4 findings:

| Severity | Location | Claim | Assessment | Outcome |
|---|---|---|---|---|
| medium | `corridor-pnl.tsx:85` | The profit and loss fills clamp each point to break-even separately, so between sessions of opposite sign both fills span the whole gap and overlap instead of meeting at the crossing | Valid | T9.13-B1 |
| medium | `corridor-pnl.tsx:127-131` | A banked band spanning two sales is labelled with the last sale's text at the first sale's column and level (+$478 then +$700 reads "Banked +$700" at the +$478 level) | Valid | T9.13-B2 |
| medium | `corridor-pnl.tsx:82` | `.filter(run => run.length > 1)` drops a single session with a figure (between gaps, or the first revealed session) from both fills | Valid | T9.13-B3 |
| low | `geometry.ts:76` | Nested ternary in `LabelPlacer.place`'s anchor offset | Valid (style) | T9.13-B4 |

- **T9.13-B1.** Case: "it should meet the profit and loss fills at break-even between sessions of opposite sign, with no overlap".
- T9.13-B1 commit `428e4826`: red `expected [] to have a length of 1 but got +0` (no vertex at break-even between +100 and −100), then green; `areaPath` adds a vertex where the line between two drawn points crosses break-even. One invalid red row (a stray "it" prefix) noted in the log. Lane tier `T9.13-B1`: unit 2130, integration 269, checks 14 of 14. ocr (`ocr/T9.13-B1-428e4826.json`): **No findings.**
- **T9.13-B2.** Case: "it should label each banked level with its own figure, at that level, when a later sale changes it".
- T9.13-B2 commit `60ac05e2`: red `TestingLibraryElementError: Unable to find an element with the text: Banked +$478` (the label was absent: a runtime error from the query, not an `expect` mismatch, accepted as valid red), then green. Each run of the same banked figure inside a band gets that level's first session's own `bankedLabel`, at that level and column. Lane tier `T9.13-B2`: unit 2131, integration 269, checks 14 of 14. ocr (`ocr/T9.13-B2-60ac05e2.json`, the third run; the first two failed on a provider overload, `server_is_overloaded`): **No findings.**
- **T9.13-B3.** Case: "it should fill a single session with a figure between two gaps, and the first revealed session".
- T9.13-B3 commit `9efa3ce2`: red an assertion failure (the lone-session fill path was empty), then green. A lone session gets a rectangle across the middle half of its column, from break-even to its figure, on its own side of break-even only. Lane tier `T9.13-B3`: unit 2132, integration 269, checks 14 of 14.
- T9.13-B4 commit `23b9341e`: the anchor offset is an explicit if/else. `src/ui/cockpit/replay` 20 tests before and after. Lane tier `T9.13-B4`: unit 2132, integration 269, checks 14 of 14. ocr (`ocr/T9.13-B4-23b9341e.json`): **No findings.**
- T9.13-B3 ocr (`ocr/T9.13-B3-9efa3ce2.json`): **No findings.**
- Lane CP rebased onto `484e41b5` and merged by fast-forward: T9.13 `622301c9`, B1 `51ec9e0d`, B2 `d3acb89b`, B3 `f3e996c3`, B4 `e263efa1`. Lane CP's tasks are all done.
- **T9.13-B4.** Readability, no behavior; verification `corridor.test.tsx` and `price-strip.test.tsx` unchanged before and after.
- T9.9-B3 commit `b4545d7d` (lane CF, on `bf1c01b9`): `SessionWithR`, `ReplayWordsView` and an unused import removed; `sessionWords` takes the real `TradeReplayView`; the fixture is typed with the real `Figures` and sets `currentMarkedPnlInPlanR` on every session (a Value where the case has an R, the Unavailable double otherwise). `replay.props.test.ts` 12 of 12 before and after. Lane tier `T9.9-B3`: unit 195 files, 2150 tests; integration 269; checks 14 of 14.
  ocr (`ocr/T9.9-B3-b4545d7d.json`): **No findings.**
- Lane CF rebased onto `85d52b8c` (evidence only since its last rebase) and merged by fast-forward: T9.9 `1687f447`, B2 `486c719d`, B3 `e52bbe37`.
- Lanes TA and CF were brought to `bf1c01b9` by rebase (lane CF's T9.9 is now `25a696bb`, T9.9-B2 `4413ad4e`).

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

### wave1a (after T9.3, T9.4, T9.9, T9.10, T9.12, T9.13; T9.5 partly)

- **Not one commit:** the head moved during the run. Unit and integration ran at `801c5ff8` (before T9.5 merged), browser-2 and browser-3 at `342a45dc` (T9.5 merged), checks at `8f42affb` (evidence only since). Each header shows "+ uncommitted changes" (the main session's evidence edits). T9.5's lane tiers passed; the next merge run covers it whole.
- Browser tier: full (`first matching path since 1aa7c69e: src/ui/cockpit/index.css`).
- Unit 197 files, 2180 tests; integration 123 files, 269 tests; browser-1 126 passed (5.4 min); browser-2 79 passed (5.0 min); browser-3 56 passed, **1 failed** (4.4 min); checks 14 of 14. `run-complete.sh`: run complete.
- The failure: `e2e/d8/restore.spec.ts:31`, B8.3 "Restore with a safety backup › should show the preview with counts, enable Replace only after both steps, render the summary, and after relaunch show lists and Details equal to profile A…", `expect(received).toEqual(expected)`: after the relaunch the Today text lacked the Marks block (TODAY, YESTERDAY, CHANGE) and the "Wed Oct 14" lines. Not one of P138's known cases. The case alone passed (17.6 s, `suite-runs/wave1a-browser-3-rerun-restore.txt`): not reproduced. D9 has touched no Restore, Today or Marks code. Logged as a second suspected flake in the D8 Restore family (after `wave0`'s B8.16), for the stage report.
