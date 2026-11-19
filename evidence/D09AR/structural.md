# D09AR structural evidence

D9A-R (D9 Stage A Refactor), from `plan/D09A-R-stage-a-refactor.md`. One heading per task: its verification commands and results (structural tasks), its ocr table, its bug tasks, and notes. Lane tiers and merge runs are under "Suite runs"; critics' cost under "Critics".

## Notes on the spec reading

The session read every range of `plan/spec-reading/D09.md`, plus AC-REV-003 (lines 238 to 244) and AC-DEL-002 (lines 462 to 468) by hand (A284), and the handoff's scoped plan list in full: the breakdown, `plan/D09A-R-decisions.md`, `plan/implementation-plan.md` without the D10 to D28 definitions, D9's sections 1.1, 1.3, 1.6, 5's test Trades and 7.2, the acceptance matrix's opening sections and its nine rows the breakdown's section 13 names (read last, after an audit of the list found them missed), D7's conventions C1 to C8, stage A's report, the coach review and critic-2's report. Where a whole spec file was read in place of its listed ranges (the glossary, Trade Analysis, Trade Views, the UI contract, the delivery contract, Market Data from line 3), nothing outside the list was built on.

Order: T9AR.1 and T9AR.2 were dispatched after the breakdown, the decisions, the run rules and the plan's decisions 100 to 118 had been read. The user then asked for the full reading first; it was finished before T9AR.2's review and merge and before any wave 1 brief. Sections read beyond the list are noted here.

## T9AR.1 Tooling

`status.sh` now reads `evidence/<name without hyphens>/DECISIONS-PENDING.md` when the named folder is absent (a hyphenated name only). `status.test.sh` gained case 14 (hyphenated deliverable D98-R, folder D98R, one open question listed; with neither folder, "no decisions file" and exit 0).

| Command | Result |
|---|---|
| `.claude/scripts/status.test.sh 14` before the change | Red: `FAIL: hyphenated deliverable did not read the evidence folder named without the hyphen`; output showed "no decisions file (.../evidence/D98-R/...)". Exit 1. |
| `.claude/scripts/status.test.sh` after the change | `all requested cases passed`, exit 0 (cases 1 to 13 unchanged, case 14 new). |
| `.claude/scripts/status.sh D09A-R` | Exit 0. Lists the 24 open T9AR rows; "Open questions: none" and no "no decisions file" line, so it read `evidence/D09AR/DECISIONS-PENDING.md`. |
| `.claude/scripts/full-suite.sh --current-folder evidence/D09AR` | Prints `e2e/d9ar`, exit 0. |

- Lane tier `T9AR.1` (`suite-runs/T9AR.1-*`): unit 2289, integration 280, checks 14 of 14.
- ocr on `b271d709` (`ocr/T9AR.1-b271d709.json`): 2 files reviewed (both shell scripts; the 5 evidence files excluded), 0 comments. **No findings.**
- Merged by fast-forward (the rebase was a no-op): `b271d709`.

## T9AR.2 Types and the split

Lane TY (`d09ar/ty`), base `90658cdf`. No behavior changed: new fields and types are optional or unused, code and cases moved between files.

| Command | Result |
|---|---|
| `.claude/scripts/it-titles.sh` before any edit, then after the split, `diff before.txt after.txt` | 2187 lines before, 2187 after; the diff is empty (cases moved, none changed) |
| `npx vitest run src/ui/cockpit src/ui/screens tools/cockpit-styles.test.ts` | exit 0; 66 files, 800 tests passed (the stylesheet check finds the three new files imported) |
| `npm run typecheck` | exit 0 |
| `npx tsc6 --noEmit` | exit 0 |
| `npm run lint` | exit 0 (0 errors; two existing warnings in `OwedDebtItem.tsx`, not touched) |
| `npm run lint:deps` | exit 0 |
| `npm run build` | exit 0 |

Cases moved (counts per file, 65 in all; the rest stay):
- `replay.props.test.ts` had 38 cases: 10 stay (the words follow the condition status, the frame and table columns, Session by session, the hover, and the two cases that read the readout together with the table), 7 moved to `session-words.props.test.ts`, 5 to `stake-words.props.test.ts`, 8 to `readout.props.test.ts`, 8 to `plot.props.test.ts`.
- `frame.test.tsx` had 27 cases: 21 stay, 6 moved to `readout.test.tsx` (they now render `Readout` with the same groups; the frame's own "readout of the slider session, not the last" case stays).
- Shared doubles moved to `view-doubles.props.ts` (named `*.props.ts` because the cockpit import rule lets only an adapter or its test import the view's types).

Split of the code (A286): `replay.props.ts` keeps `replayProps`, the table row and the hover; `session-words.props.ts` (headline, how it is going, `crossedCondition`, `markerWords`), `stake-words.props.ts` (stake sentence), `readout.props.ts` (readout groups, `marksGroup`), `plot.props.ts` (plot props, `instrumentsOf`); `readout.tsx` taken out of `frame.tsx`; the readout's rules moved from `replay-frame.css` to `replay-readout.css`; `replay-overlay.css` and `replay-cards.css` added empty; all three imported from `src/ui/cockpit/index.css`.

- Lane tier `T9AR.2` (`suite-runs/T9AR.2-*`, on `07d00eec`): unit 2289, integration 280, checks 14 of 14.
- ocr on `07d00eec` (`ocr/T9AR.2-07d00eec.json`): 24 files reviewed (5 excluded), 0 comments. **No findings.**
- Rebased onto `9bba919f` (clean). The rebase brought in T9AR.1's `status.sh`, a file lane TY does not own, so the lane tier was rerun: `T9AR.2-rebased` on `a8fcaf67`, unit 2289 (203 files), integration 280, checks 14 of 14; `run-complete.sh`: run complete. Merged by fast-forward: `a8fcaf67`.
- Notes from the task's summary (not ocr findings):
  - The six readout cases moved to `readout.test.tsx` render `Readout` directly, where they rendered the frame; names and assertions are unchanged.
  - `src/app/types.ts` needed no change (it re-exports `TradeReplayView`).
  - `ReplayPlotProps.axis.endLabel` became optional and `startLabel?` was added; `plotBase` still supplies `endLabel`.
  - `planOdds` is on `TradeEvaluation` only; a session's figures pick `rewardRiskOdds` and `extremes` (A267).
  - The domain's new type names are not exported from `trade-analysis/index.ts`; lane DM adds the exports.
- **Implementation-level decision (main session): `src/ui/cockpit/replay/view-doubles.props.ts`.** The split made this shared file of test doubles, which section 4.2's ownership table does not name. Rule for the lanes: a lane may add a new double or helper to it; changing or removing an existing export is a stop-and-report, routed to lane TY as a bug task, as `replay.types.ts` changes are.

## T9AR.3 Trade Analysis: the estimated odds and the extremes' weight

Lane DM (`d09ar/dm`), base `8245f6c6`, commit `76e83bd3`. 6 cases, each red then green; no first-run pass. `npm run verify:fixtures` exit 0. Lane tier `T9AR.3`: unit 2295, integration 280, checks 14 of 14.

- Notes from the task's summary (not ocr findings):
  - `RewardRiskOdds` and `ExtremesWeight` are now exported from `trade-analysis/index.ts`; shapes unchanged. Percents are whole-number Rationals; `planOdds` is always a Value (from 1R and the Original Planned Reward).
  - The task read the extremes' weight from the Trade's first Execution (an option sale gives `Main`), because the derived state holds no Plan leg side; a Trade with no Execution gets none. The main session first accepted this as an implementation-level choice; ocr then raised it (below), so it is bug task T9AR.3-B2.
- ocr on `76e83bd3` (`ocr/T9AR.3-76e83bd3.json`): 3 files reviewed (5 excluded), 2 comments.

| Severity | Location | Finding | Verdict |
|---|---|---|---|
| medium | `evaluate.ts:584` | `rewardRiskOdds` and `extremes` never reach a replay session's figures: `figuresOf()` in `replay-series.ts` copies neither, though A267 and A268 say a session's figures carry them | Valid: T9AR.3-B1 |
| medium | `evaluate.ts:587` | `extremes` is set only when the Trade has an Execution, so a confirmed Plan before entry has no weight and a stock or long option reads as `Main`; A268 takes it from the Plan, fixed for the Trade's life, and `derive` has `record.plan` | Valid: T9AR.3-B2 |

**Bug tasks** (lane DM, one at a time):
- **T9AR.3-B1** A session's figures lack the odds and the weight. Case: it should carry the estimated odds and the extremes' weight in each replayed session's figures (R-DALE-D Wed 11-11: 78/990, 8 and 92, `Main`; R-BREN-U: `Remote`).
  - Done: `49ea194f`; red ("expected a Value, got undefined"), green; no first-run pass; `verify:fixtures` exit 0; lane tier `T9AR.3-B1`: unit 2296, integration 280, checks 14 of 14. ocr on `49ea194f` (`ocr/T9AR.3-B1-49ea194f.json`): 2 files, 0 comments. **No findings.**
- **T9AR.3-B2** The weight is read from the first fill, not the Plan. Case: it should give the weight from the Plan before any Execution (a confirmed long-stock Plan: `Remote`; a confirmed Cash-Secured Put Plan: `Main`).
  - Done: `e576c67e`; red "expected undefined to be 'Remote'", green; no first-run pass. `derive` sets a new required `DerivedTradeState.extremes` from `record.plan.legs` (`Main` when any leg is a short option), and `evaluate` passes it through; `TradeEvaluation.extremes` unchanged. No frozen view touched; `verify:fixtures` exit 0. Lane tier `T9AR.3-B2`: unit 2297, integration 280, checks 14 of 14. ocr on `e576c67e` (`ocr/T9AR.3-B2-e576c67e.json`): 3 files, 0 comments. **No findings.**
- Rebased onto `4b3d9c45` (only evidence and plan files had changed on the branch, none of lane DM's, so no rerun). Merged by fast-forward: `5187512d` (T9AR.3), `02b4f51c` (B1), `499751ed` (B2).

## T9AR.4 Trade Analysis: the Plan's terms, and each fill against the Plan

Lane DM (`d09ar/dm`), base `79b900d3`, commit `62acd165`. 8 cases: 5 red then green; 3 first-run passes, each with a mutation check that failed on an assertion (O-S2's every condition with its own result: a Stop's `pnlIfHit` not negated; R-AXIO-U's added lot Above the entry: Above and Below swapped; R-DALE-D's buyback Above the Target: an option fill matched to Underlying conditions). `verify:fixtures` exit 0. Lane tier `T9AR.4`: unit 2305 (205 files), integration 280, checks 14 of 14.

- Notes from the task's summary (not ocr findings): `terms.conditions` lists Stops then Targets, each in Plan order; `priceOf` is `Option` for a structure-value condition, else `Underlying`; leg quantities unsigned. A reducing fill matches conditions by its Instrument's kind; a Stop is "at or beyond" at or below it for a Long leg, at or above for a Short. `oddsOf` exported from `evaluate.ts` (not from the index) so the Plan column reuses it.
- ocr on `62acd165` (`ocr/T9AR.4-62acd165.json`): 3 files, 1 comment.

| Severity | Location | Finding | Verdict |
|---|---|---|---|
| low | `replay-series.ts:261` | Nested ternaries (the Entry-or-conditions choice, and `side` in `against`) should be explicit branches | Doubtful, readability: T9AR.4-F1 (structural). The reviewer notes the logic reads correctly and no repo rule bans nested ternaries; made an F task for consistency with T9AR.10-F1. |

- **T9AR.4-F1** (structural) The two nested ternaries in `replay-series.ts` become explicit branches; verified by the same cases passing before and after.
  - Done: `24de6a9c`. `npx vitest run src/domain/trade-analysis`: 24 files, 255 tests passing before and after; no test changed; typecheck, tsc6, lint exit 0. Lane tier `T9AR.4-F1`: unit 2305, integration 280, checks 14 of 14. ocr on `24de6a9c` (`ocr/T9AR.4-F1-24de6a9c.json`): 1 file, 0 comments. **No findings.**
- Rebased onto `13f6a618` (only evidence and plan files had changed, none of lane DM's; no rerun). Merged by fast-forward: `955e3568` (T9AR.4), `70ddec48` (F1).

## T9AR.5 Trade Analysis: a condition's first crossing

Lane DM (`d09ar/dm`), base `523a8a0e`, commit `27e47d5a`. 7 cases: 6 red then green; 1 first-run pass (case 2, the first kept and the run dropped when Active again), mutation check: `since` given on every session once a first exists failed with `expected [ '2026-11-06', '2026-11-06' ] to deeply equal [ '2026-11-06', null ]`. `verify:fixtures` exit 0. Lane tier `T9AR.5`: unit 2312, integration 280, checks 14 of 14.

- Implementation-level choices the plan left open (from the task's summary; accepted): on a session with no reading `since` is absent, while the run is held so the next crossed session keeps its start ("absent when not crossed now"); the first session's `afterGap` is false; the role's `afterGap` comes from the role's own reading; a condition is listed under `conditions` from the session it first appears; `crossings` is filled on every session, `conditions: []` for a role with none. Code: `advance`, `crossingsOf`, `statusOf` in `replay-series.ts`. `crossedCondition` in `session-words.props.ts` untouched (T9AR.18).
- ocr on `27e47d5a` (`ocr/T9AR.5-27e47d5a.json`): 2 files, 1 comment.

| Severity | Location | Finding | Verdict |
|---|---|---|---|
| medium | `replay-series.ts:280` | The role reads Active when any one condition is Active, so a session where a crossed condition is unreadable and another is Active ends the role's run; the role then restarts with no `afterGap` while the condition keeps its run | Valid: T9AR.5-B1 |

- **Implementation-level decision (main session) for the fix:** a role reads crossed when any of its conditions reads crossed; it reads not crossed only when every condition has a reading and none is crossed; otherwise (a condition unreadable and none crossed) the role has no reading for the session. This follows A271 ("a session with no reading neither starts nor ends a run") and AC-RPT-004 ("gaps cannot prove no episode").
- **T9AR.5-B1** Case: it should hold the role's run through a session where its crossed condition has no reading and another condition reads Active, and mark nothing after a gap when it is crossed again (O-S2: the option Stop crossed, then the option's Mark missing while MNO is Active, then the option crossed again; the role's `since` keeps the first run's start, as the option condition's does).
  - Done: `95fe73b2`; red `expected [ '2026-10-12', '2026-10-14' ] to deeply equal [ '2026-10-12', '2026-10-12' ]`, green; no first-run pass. The test builds a copy of O-S2 (MNO 43.20 on Mon 10-12, Tue 10-13, Wed 10-14; the put 3.70, missing, 3.70), since O-S2's own Marks give no such sequence. `verify:fixtures` exit 0. Lane tier `T9AR.5-B1`: unit 2313, integration 280, checks 14 of 14. ocr on `95fe73b2` (`ocr/T9AR.5-B1-95fe73b2.json`): 2 files, 0 comments. **No findings.**
- Rebased onto `72ece0c8`. The rebase brought in lanes OV's and PL's code, which lane DM does not own, so the lane tier was rerun: `T9AR.5-rebased` on `6855e7d3`, unit 2340, integration 280, checks 14 of 14. Merge held until the `merge2` run finished; then merged by fast-forward: `60e4bd32` (T9AR.5), `6855e7d3` (B1).

## T9AR.6 Facade and manifest

Lane DM (`d09ar/dm`), base `ada81477`, commit `6ff96d06`. Verification, each exit 0: `npm run verify:capabilities` (24 operations, 12 variant-qualified, 10 routes); `npx vitest run src/coordinators/workspace` (131 passed); `npm run typecheck`; `npx tsc6 --noEmit`; `npm run lint` (2 existing warnings in `OwedDebtItem.tsx`); `npm run verify:fixtures` (workspace-v1 to v7 equal their snapshots). Changed: `capabilities.ts` (`replayTrade` variants `ConditionStatus`, `Markers`, `PlanComparison`, `Odds`; `getTrade` gains `Odds`), `routes.ts` (Trade Detail and Review require them), `workspace.test.ts` (the manifest); new `tests/support/replay-view-fields.ts` (`oddsOf`, `figuresWithOdds`, `planColumnWithTerms`, `againstPlanOf`, `crossingsOf`). No view type gap; no coordinator change (A272). Lane tier `T9AR.6`: unit 2340, checks 14 of 14, **integration 1 failed of 280**: `tests/integration/d9/capabilities.test.ts` (I9.7) asserted the old exact `replayTrade` list (a file outside the task's list).

- ocr on `6ff96d06` (`ocr/T9AR.6-6ff96d06.json`): 4 files (5 excluded), 2 comments.

| Severity | Location | Finding | Verdict |
|---|---|---|---|
| medium | `tests/support/replay-view-fields.ts:38` | `planColumnWithTerms` always gives the Plan 50/50 odds, whatever its Stop and Target (entry 100, Stop 90, Target 120 should be 1/3, 33%) | Valid: T9AR.6-B1 |
| medium | `tests/support/replay-view-fields.ts:8` | The helper `r` throws a `RangeError` on a decimal price (`BigInt(0.5)`), though the builders promise plain numbers | Valid: T9AR.6-B2 |

- **T9AR.6-B1** Case: it should give the Plan column the odds its own Stop and Target imply.
- **T9AR.6-B2** Case: it should build the Plan column and a fill's distance from a decimal price.
  - Done, one commit each, no first-run pass, in the new `tools/replay-view-fields.test.ts` (the unit project takes only `src` and `tools`):
    - B1 `db6f7f75`: red `expected false to be true` (50%, not 1/3), green. The builder uses the domain's `oddsOf(entry - stop, target - entry)`.
    - B2 `88b9ba80`: red `RangeError: The number 100.5 cannot be converted to a BigInt`, green. `r` goes through `parseDecimal`; entry 100.5 gives `atTarget` 39/2, a 0.5 distance gives 1/2.
  - Lane tier `T9AR.6-B`: unit 2342 (208 files), integration 280, checks 14 of 14.
  - ocr on `db6f7f75` (`ocr/T9AR.6-B1-db6f7f75.json`): 0 comments, **no findings**. ocr on `88b9ba80` (`ocr/T9AR.6-B2-88b9ba80.json`): 1 comment.

| Severity | Location | Finding | Verdict |
|---|---|---|---|
| medium | `tests/support/replay-view-fields.ts:11` | The builders subtract prices as floats before converting, so `planColumnWithTerms(…, 100.1, 90, 120)` hands `r` `-10.099999999999994`, which `parseDecimal` rejects (at most six decimal places) | Valid: T9AR.6-B3 |

- **T9AR.6-B3** Case: it should build the Plan column from prices whose differences are not exact in floating point (entry 100.1, Stop 90, Target 120).
- **T9AR.6-S1** fix: `8435e52d`. Reproduced: `expected [ 'ConditionStatus', 'Markers', …(2) ] to deeply equal [ 'ConditionStatus', 'Markers' ]`. Changed expected values, a consequence of T9AR.6's planned variants: line 15 (the manifest's `replayTrade`) and line 20 (the Trade Detail route's required `replayTrade` variants), each before `['ConditionStatus', 'Markers']`, after `['ConditionStatus', 'Markers', 'PlanComparison', 'Odds']`. Line 20's change matches the plan row ("the Trade Detail and Review routes require them"). After: 1 of 1. Lane tier `T9AR.6-S1`: unit 2340, integration 280. ocr on `8435e52d` (`ocr/T9AR.6-S1-8435e52d.json`): 1 file, 0 comments. **No findings.** (The reviewer's note that I9.7 checks `getTrade` only with `toContain('Replay')` is not an ocr finding; the manifest test `workspace.test.ts` lists `getTrade`'s `Odds`.)

## T9AR.7 The Replay overlay

Lane OV (`d09ar/ov`), base `8245f6c6`, commit `14ff2e7d`. 9 cases; 7 red then green, 2 first-run passes with mutation checks (the finished-Trade and symbol-alone header: heading rendered `header.slice(0, 4)` failed on the heading text; the shell banner: cleanup set `aria-hidden` in place of removing `inert` failed with the banner still inert). Lane tier `T9AR.7`: unit 2298 (204 files), integration 280, checks 14 of 14.

- Notes from the task's summary: `role="dialog"` with `aria-modal`, rendered through a portal to `document.body`, `inert` on every other body child while open (P153: nothing hidden or changed); focus to Close on open; Escape calls `onClose` unless a control inside called `preventDefault`. No words shortened, no uncovered words.
- ocr on `14ff2e7d` (`ocr/T9AR.7-14ff2e7d.json`): 3 files reviewed (5 excluded), 3 comments.

| Severity | Location | Finding | Verdict |
|---|---|---|---|
| medium | `overlay.tsx:33` | The Tab trap's edge selector matches elements that cannot take focus (a closed `<details>`' `tabIndex=0` region) and misses `summary`, so Tab can leave the dialog | Valid: T9AR.7-B1 |
| medium | `replay-overlay.css:27` | One column at every width; A275's wide layout (charts left, readout right) is never applied | Valid: T9AR.7-B2 |
| medium | `overlay.test.tsx:54` | The Tab case checks only that focus is inside, so a trap that swallows Tab would pass | Valid: T9AR.7-B3 |

Reviewer's notes (not findings): `overlay.tsx` line 16 lacks a space (`||sibling`).

**Bug tasks** (lane OV, one at a time):
- **T9AR.7-B1** Tab leaves the dialog past a closed `<details>`. Case: it should wrap Tab from the last control that can take focus to Close, and Shift+Tab from Close to it, when the dialog holds a closed `<details>` whose hidden region has `tabIndex=0` and a `summary`.
  - Done: `6ec27569`. First red run was a fixture error (logged); valid red "expected <div tabindex=0> to be <button>", then green; no first-run pass. `summary` added to the selector; a `canTakeFocus` filter drops elements inside `[hidden]` or a closed `<details>` other than its own `summary`. Lane tier `T9AR.7-B1`: unit 2299, integration 280, checks 14 of 14.
  - ocr on `6ec27569` (`ocr/T9AR.7-B1-6ec27569.json`), round 2: 2 files, 2 comments.

| Severity | Location | Finding | Verdict |
|---|---|---|---|
| medium | `overlay.tsx:11` | A control inside a closed `<details>`' visible `summary` is dropped from the Tab edges, since only the `summary` itself is exempt | Valid: T9AR.7-B4 |
| medium | `overlay.tsx:5` | The `summary` selector also matches `<summary tabIndex={-1}>`, which the browser skips, so the trap can wrap onto it | Valid: T9AR.7-B5 |

  - **T9AR.7-B4** Case: it should count a button inside a closed `<details>`' `summary` as a Tab edge when it is the last control.
    - Done: `5d4e1b9c`; red (assertion: Tab did not wrap from the summary's button), green; no first-run pass. `canTakeFocus` exempts anything whose ancestor just below a closed `<details>` is that details' `summary`. Lane tier `T9AR.7-B4`: unit 2301, integration 280, checks 14 of 14. ocr on `5d4e1b9c` (`ocr/T9AR.7-B4-5d4e1b9c.json`), round 3: 2 files, 0 comments. **No findings.**
  - **T9AR.7-B5** Case: it should not count a `summary` with `tabIndex=-1` as a Tab edge.
    - Done: `4b63b292`; red (assertion: the trap wrapped onto the `tabIndex=-1` summary), green; no first-run pass. Selector now `summary:not([tabindex="-1"])`. Lane tier `T9AR.7-B5`: unit 2302, integration 280, checks 14 of 14. ocr on `4b63b292` (`ocr/T9AR.7-B5-4b63b292.json`), round 3: 2 files, 0 comments. **No findings.**
- **T9AR.7-B2** No wide layout. Case: it should place the charts on the left and the readout on the right inside the overlay at 1280 wide, and one column at 375 (A275).
  - Done: `9a34b48a`. First red row was a fixture error (reading the CSS through `import.meta.url`), logged as not valid; valid red "expected undefined to be 'grid'", then green; no first-run pass. The test parses `replay-overlay.css` with `postcss` (jsdom computes no layout). Under `.replay-overlay`, `.replay-card` is a grid of `minmax(0,3fr) minmax(0,2fr)` with dense row flow; every child spans the full width but `.replay-plot-frame` (column 1) and `.replay-readout` (column 2); one column under `@media (max-width: 860px)`, the shell's phone breakpoint. `frame.tsx` unchanged. Lane tier `T9AR.7-B2`: unit 2300, integration 280, checks 14 of 14.
  - ocr on `9a34b48a` (`ocr/T9AR.7-B2-9a34b48a.json`), round 2: 2 files, 1 comment.

| Severity | Location | Finding | Verdict |
|---|---|---|---|
| medium | `replay-overlay.css:46-48` | In the two-column grid the plot frame stretches to a taller readout's height, so the hit layer (`inset: 0`) and its session buttons reach into the empty space under the charts, where a click selects a session | Valid: T9AR.7-B6 |

  - **T9AR.7-B6** Case: it should keep the plot frame at its own height in the wide grid (`align-self: start`), so no session button lies below the charts.
    - Done: `15016e21`; red "expected undefined to be 'start'", green; no first-run pass. One line in `replay-overlay.css`, wide grid only. Lane tier `T9AR.7-B6`: unit 2303, integration 280, checks 14 of 14. ocr on `15016e21` (`ocr/T9AR.7-B6-15016e21.json`), round 3: 2 files, 0 comments. **No findings.**
- **T9AR.7-B3** The Tab case can pass with Tab swallowed. Case: the existing Tab case asserts the order (Close, the inside button, Close; and the reverse with Shift+Tab). A test-only change: it must fail against a trap that always refocuses Close.
  - Done: `22a2baca` (test only; `overlay.tsx` unchanged). Mutation check: the trap changed to always refocus Close failed the tightened case with an assertion failure (Close focused where the inside button was expected), which the old assertion would have passed; restored, green. Lane tier `T9AR.7-B3`: unit 2300, integration 280, checks 14 of 14. ocr on `22a2baca` (`ocr/T9AR.7-B3-22a2baca.json`): 1 file, 0 comments. **No findings.**

- Rebased onto `523a8a0e`. The rebase brought in T9AR.3 and T9AR.4's domain code, which lane OV does not own, so the lane tier was rerun: `T9AR.7-rebased` on `ddc5e849`, unit 2319, integration 280, checks 14 of 14; `run-complete.sh`: run complete. Merged by fast-forward: `4fd70538` (T9AR.7), `6a0cb594` (B1), `e45bd7a5` (B2), `6ffc25fb` (B3), `4ac0f109` (B4), `59714fa3` (B5), `ddc5e849` (B6). Three ocr rounds; the third left no findings.

## T9AR.8 Trade Detail: Replay opens the overlay

Lane OV (`d09ar/ov`), base `e7f9f474`, commit `44e50ef1`. 8 planned cases, all green; 7 red then green (for cases 4, 5, 6 and 7 the task had written code ahead of the test, backed it out to a stub, and got a genuine red), 1 first-run pass (case 2, no Replay button on a Planned or records-disagree Detail: built by case 1's guard; mutation, the guard always true, failed with `expected <button …> to be null`). Three added adapter cases in the new `overlay.props.test.ts` (the open-Trade header, Final result, the symbol alone), each a first-run pass with a mutation check. Lane tier `T9AR.8`: unit 2324, integration 280, checks 14 of 14.

- Browser lines re-pointed (P150): `e2e/support/detail/index.ts`, `e2e/d8p/cockpit.spec.ts`, `e2e/d8p/states.spec.ts`, `e2e/d8p/responsive-a11y.spec.ts` (ArrowRight now expects Position; two lines added for the Tab stop on the Replay button after the tab row), `e2e/d8r/states.spec.ts`, `e2e/d8r/support.ts` drop 'Replay' from the drawers; `e2e/d9/support.ts`'s `replay(page)` is the dialog and `openDrawer(page, 'Replay')` presses the button, so the other `e2e/d9` callers are unchanged; `e2e/d9/states.spec.ts` (the Planned case checks for no Replay button; a Close click before `recordExpirationLink`, since the page under the overlay is inert); `e2e/d9/review.spec.ts` (a Close click before "Back to the Review"; the address now ends `&panel=Action&replay=open&session=2026-11-12`). `cardReplay` untouched (T9AR.9). Stage A test titles saying "Replay drawer" kept (P150).
- Browser runs, once each under the lock: `d8p/cockpit` 1 passed; `d8p/states` with `d8r/states` 7 passed; `d8p/responsive-a11y` 2 passed (after adding the Tab stop); `d9/replay` 5 passed; `d9/gaps` with `d9/states` 6 passed and 1 failed (the inert page), fixed and rerun with `review`, 6 passed; `d9/responsive-a11y` 6 passed. The fit check did not recur.
- Notes from the task's summary: new `overlay.props.ts` (`overlayWordsOf(symbol, replay?)`, W53's header and the dialog's name); `CockpitProps` gains `replayOpen?`, `onReplayOpen?`, `onReplayClose?`; `DRAWERS` loses 'Replay'. `.cockpit-tab-row` and `.cockpit-replay-button` rules put in `replay-overlay.css` (the shell's stylesheets are not lane OV's). `drawer=replay` is ignored; `replay=open` on a Detail with no replay opens nothing. Opening writes the slider's session to the address. A drawer link inside the overlay closes it, then focuses its target once the page is no longer inert. No words shortened; no uncovered words.
- ocr on `44e50ef1` (`ocr/T9AR.8-44e50ef1.json`): 17 files (5 excluded), 5 comments.

| Severity | Location | Finding | Verdict |
|---|---|---|---|
| medium | `TradeDetail.tsx:70` | Move the slider, Close, press Replay again: the slider restarts on the load-time `address.session`, not the session written on open | Valid: T9AR.8-B1 |
| medium | `Cockpit.tsx:220` | The same defect from the Cockpit side (the frame remounts from `initialSession`) | Valid: folded into T9AR.8-B1 |
| medium | `TradeDetail.tsx:62` | After Back then Forward, the overlay returns but Close replaces the entry instead of going back (A274), leaving two closed Detail entries | Valid: T9AR.8-B2 |
| medium | `Cockpit.tsx:216` | On a load with `replay=open`, the overlay keeps the body as its opener, so Close returns focus to the body | Doubtful: T9AR.8-B3 (implementation-level decision: focus goes to the Replay button, the overlay's control on the page, per A273) |
| low | `Cockpit.tsx:217` | A nested ternary in the overlay body | Valid (readability): T9AR.8-F1 |

- **T9AR.8-B1** Case: it should reopen the overlay on the session the slider was on when it closed.
- **T9AR.8-B2** Case: it should go back one entry on Close after Back then Forward brought the overlay back.
- **T9AR.8-B3** Case: it should put focus on the Replay button when an overlay opened from the address closes.
- **T9AR.8-F1** Structural: explicit branches in place of the nested ternary.
  - Done, one commit each, no first-run pass:
    - B1 `9b471f99`: red `expected 'Thu Oct 15 · 4 of 4. +$250.00' to be 'Wed Oct 14 · 3 of 4. +$100.00'`, green (two earlier failures were the task's own fixture, not counted). `initialSession` is the slider's `session` state.
    - B2 `c61485c7`: red `expected 'REPLACE' to be 'POP'`, green. The effect clearing `pushed` on close removed. (The case's last step, one more Back, is weak; the `POP` assertion is the check.)
    - B3 `3d066dc6`: red `expected <body> to be <button>`, green. A ref on the Replay button and an open-to-closed focus effect, before the drawer-request focus effect.
    - F1 `8488f9d4`: `overlayBody` chosen by if and else. `TradeDetail.test.tsx` with `trade-detail`: 123 passed; typecheck, tsc6, lint, `lint:deps` exit 0.
  - No browser run (no `e2e` spec affected). Lane tier `T9AR.8-B`: unit 2327, integration 280, checks 14 of 14.
  - ocr, one run per commit: `9b471f99`, `c61485c7`, `3d066dc6`, `8488f9d4` (`ocr/T9AR.8-B1-9b471f99.json`, `ocr/T9AR.8-B2-c61485c7.json`, `ocr/T9AR.8-B3-3d066dc6.json`, `ocr/T9AR.8-F1-8488f9d4.json`): 0 comments each. **No findings.**
- Lane OV rebased onto `d74afb24` (it brought in T9AR.5's domain files and lane PL's chart files): `39d876a0` (T9AR.8), `a76254b5` (B1), `3325fb9f` (B2), `ebbcdab4` (B3), `ca634afb` (F1). Lane tier rerun as `T9AR.8-rebased`: unit 2357, integration 280, checks exit 0; `run-complete.sh`: run complete. Merged by fast-forward to `ca634afb`.

## T9AR.10 Chart: the key, the dates, every line labelled

Lane PL (`d09ar/pl`), base `8245f6c6`, commits `07916b2e` (the task), `80c143ad` (its lane tier files). 7 planned cases, four split into a drawing test and a props test, so 11 red/green pairs; no first-run pass. One green row first exited 1 on the task's own wrong anchor expectation, fixed in the test and rerun green (noted in the log). Lane tier `T9AR.10`: unit 2299, integration 280, checks 14 of 14. Browser: `e2e/d9/replay.spec.ts` only, 5 passed.

- Notes from the task's summary (not ocr findings):
  - Existing expected values changed as consequences of planned cases, not listed in section 1.5's lookup: `corridor.test.tsx`'s "leave out a label that has no free spot" now expects 2 price lines, not 3 (A280: a line is drawn only with its label); its width at a 900 wide box expects '900', not '640', in two places (drawn at the box's own width). `plot.props.test.ts`'s expected objects gain `keyEntries`, `startLabel`, the "Expires …" end label, the single title and the stock axis. Accepted as implementation-level: each follows directly from a planned case.
  - `e2e/d9/responsive-a11y.spec.ts` line 69 (`not.toContain('dollars for the whole Position')`) left as it is: still true.
  - `pnlShortTitle` is no longer read but is still declared, optional, in `replay.types.ts` (lane TY's file). Routed to lane TY as **T9AR.2-F1** (delete the field; verified by typecheck and the same cases passing). Held until lane PL is idle: `plot.props.test.ts` (lane PL's) line 173 still reads `plotBase.pnlShortTitle` (asserting it undefined), so the deletion must change that line too, and lane PL is mid-chain.
  - ocr on `07916b2e` (`ocr/T9AR.10-07916b2e.json`): 9 files reviewed (1 excluded), 5 comments.

| Severity | Location | Finding | Verdict |
|---|---|---|---|
| medium | `corridor-pnl.tsx:231` | The axis filter drops an option's "Expires Fri Nov 20" whenever the cursor's date label would overlap it, so the expiry vanishes over the last sessions | Valid: T9AR.10-B1 |
| medium | `replay-plot.css:301` | Open profit and Open loss share one swatch, and Banked and Realized loss fall back to a grey one, so the key does not match what is drawn | Valid: T9AR.10-B2 |
| medium | `corridor-pnl.tsx:238` | Worst case and Max reward labels sit at the right edge with nothing keeping them out of the cursor's column | Doubtful: T9AR.10-B3 |
| low | `corridor-pnl.tsx:221` | A new nested ternary where `LabelPlacer.box` uses if/else for the same three-way anchor | Valid, readability: T9AR.10-F1 (structural) |
| medium | `plot.props.ts:63` | The key's At Stop and At Target depend on the outcome figures, so the price strip's Stop and Target lines go unnamed when those are unavailable | **Wrong, dismissed.** Confirmed at `plot.props.ts` lines 63 and 64: "At Stop" and "At Target" (W66) name the P&L chart's result lines, drawn from those same figures; the price strip's Stop and Target lines carry their own labels ("Stop 98.00"), and A280 asks the key to name only what has no label of its own (break-even). |

  **Bug tasks** (lane PL, one at a time):
  - **T9AR.10-B1** The expiry label vanishes near the end. Case: it should keep "Expires Fri Nov 20" on an option's axis at the last session, with the cursor's date beside it, never on top of it (W67).
    - Done: `daddc978`. Red: TypeError reading the absent label's `textContent` (a runtime exception), then green; no first-run pass. The "Expires …" label no longer goes through the cursor-overlap filter; the cursor's date is clamped to end 4 px left of it; the start label is still hidden under a same-date cursor. Lane tier `T9AR.10-B1`: unit 2300, integration 280, checks 14 of 14. ocr on `daddc978` (`ocr/T9AR.10-B1-daddc978.json`): 2 files, 0 comments. **No findings.**
  - **T9AR.10-B2** The key's swatches don't match the drawing. Case: it should give each key entry the swatch of what it names: Open profit and Open loss their areas' colours, Banked and Realized loss their bands' colours.
    - Done: `a41bad90`; red (no `data-swatch` on the entries), green (one first green run failed on the test's own file path, fixed in the test); no first-run pass. `Key` sets `data-swatch` (`area-profit`, `area-loss`, `banked-gain`, `banked-loss`) from the entry's kind and label; four `::before` rules in `replay-plot.css` use the same colour variable and opacity as the drawing's `.area.*` and `.banked-band.*` rules, checked by parsing the stylesheet with `postcss`. Lane tier `T9AR.10-B2`: unit 2301, integration 280, checks 14 of 14. Note: the variant is chosen from the entry's label in the component because `PlotKeyEntry` (lane TY's type) has no variant field; carrying it on the entry would be a type change for lane TY. ocr on `a41bad90` (`ocr/T9AR.10-B2-a41bad90.json`): 3 files, 0 comments. **No findings.**
  - **T9AR.10-B3** Worst case and Max reward labels can sit in the cursor's column. Case: it should keep the Worst case and Max reward labels out of the cursor's column at the last session (A280). T9AR.11's planned case covers the other level labels.
    - Done: `9505eb16`. Two early runs passed because the test's cursor sat off the axis (logged as invalid); with the cursor in the last column, red "expected false to be true", then green; no first-run pass. New `LabelPlacer.reserveColumn(x0, x1)` in `geometry.ts`; `corridor-pnl.tsx` reserves the cursor's column just before the Worst case and Max reward labels. Each has one spot, so at the last session both labels, and so both lines, are not drawn (A280). The reservation also precedes Break-even, which T9AR.11 owns. Lane tier `T9AR.10-B3`: unit 2302, integration 280, checks 14 of 14. ocr on `9505eb16` (`ocr/T9AR.10-B3-9505eb16.json`): 3 files, 0 comments. **No findings.**
  - **T9AR.10-F1** (structural) The nested ternary in `span` replaced by explicit branches; verified by the same cases passing before and after.
    - Done: `731c9a74`. `npx vitest run src/ui/cockpit/replay`: 9 files, 117 tests passing before and after; typecheck, tsc6, lint, lint:deps exit 0. Lane tier `T9AR.10-F1`: unit 2302, integration 280, checks 14 of 14. ocr on `731c9a74` (`ocr/T9AR.10-F1-731c9a74.json`): 1 file, 0 comments. **No findings.**
  - `drawPnl` and `drawStrip` return `{ svg, drawn }` (`DrawnChart` in `geometry.ts`), so the key names Worst case, Max reward and Strike only when drawn. The key sits beside the hit-area frame in a new `div.replay-corridor`. An axis end label is hidden when it would sit under the cursor's date. `corridor.tsx` uses `props.cursorLabel ?? current.dateLabel`; nothing sets `cursorLabel` yet.

- T9AR.10 rebased onto `e7f9f474`. The rebase brought in lane DM's and lane OV's code, which lane PL does not own, so the lane tier was rerun: `T9AR.10-rebased` on `8ef41e51`, unit 2332, integration 280, checks 14 of 14; `run-complete.sh`: run complete. Merged by fast-forward: `170970f4` (T9AR.10), `611d3453` (its lane tier files), `61c562e6` (B1), `3235985a` (B2), `c7c01655` (B3), `8ef41e51` (F1).

## T9AR.11 Chart: the entry session, an off-scale Worst case, a session with no Mark

Lane PL (`d09ar/pl`), base `72ece0c8`, commit `9f03a9e9`. 5 planned cases plus 2 the task added (the Worst case and Max reward lines kept at the last session, from the handoff's note; the adapter's `worstCaseTag`), all red then green; one green row first failed on the test's own bug (it dropped each sub-path's first point), fixed in the test. No first-run pass. Lane tier `T9AR.11`: unit 2340, integration 280, checks 14 of 14. Browser: `e2e/d9/replay.spec.ts`, `gaps.spec.ts`, `responsive-a11y.spec.ts`: 11 passed, 3 failed (below).

- Notes from the task's summary (not ocr findings):
  - Existing assertions changed as consequences of planned cases: `corridor.test.tsx`'s "should break the area at a session without a figure" now asserts nothing inside the gap's own column (the area now runs edge to edge, P146); `price-strip.test.tsx`'s No Mark case counts the price chart's own label (the P&L chart now says it too). Accepted as implementation-level.
  - The P&L chart's no-Mark column is a session whose `tradePnl` is null; the price chart's is a null Underlying Mark (they differ on an option Trade with only the contract's Mark missing, R-CORV-D).
  - A lone session between two gaps keeps its short block (a quarter column each side).
  - `worstCaseTag` is offered only for a losing Worst case; weight `figures.extremes ?? 'Main'`; drawn only when the line is below the range. Classes `worst-case-tag.main` and `.remote`.
  - Break-even keeps its label on the chart; the `e2e/d9` lines that assert it still pass, so none changed.
  - Worst case and Max reward labels have a second spot at the left end; price-strip labels carry a `spot` with an anchor.
  - **Browser failure the task reports as not its own:** `e2e/d9/responsive-a11y.spec.ts` lines 126, 134, 146 (`expectFitsOneScreen`, "charts drawn at their box's width") expect 640 on a wide box, and the chart now draws at its box's width, a change T9AR.10 made (A275). Expected to show in `merge2`'s `browser-3`; pinned to T9AR.10.
- ocr on `9f03a9e9` (`ocr/T9AR.11-9f03a9e9.json`): 7 files, 1 comment.

| Severity | Location | Finding | Verdict |
|---|---|---|---|
| medium | `corridor-pnl.tsx:115-116` | A lone session between two No Mark sessions keeps its half-column block, so its area stops a quarter column short of each shaded column, where P146 says the area runs to the column's edge | Valid: T9AR.11-B1 |

- **Implementation-level decision (main session):** P146 governs the lone session too: its area runs to the edge of the No Mark column on each side. The older block's comment ("never reaching a gap") and the lone-session case's bound (within 15 px of the dot) predate P146; the bug task changes that bound to match and records it.
- **T9AR.11-B1** Case: it should run a lone session's area between two No Mark sessions to the edge of each shaded column, and end it upright.
  - Done: `126a37dd`; red "expected 131.8 to be close to 122.75", green; no first-run pass. Each side of a lone session's block is `column/2` when that neighbour has no Mark, else `column/4` (unchanged with a Mark on both sides, and for the first revealed session). Changed assertion in "should fill a single session with a figure between two gaps, and the first revealed session": before, the area's x-extent within the dot ± 15; after, within the dot ± `column/2` (0.1 px tolerance). Lane tier `T9AR.11-B1`: unit 2341, integration 280, checks 14 of 14. ocr on `126a37dd` (`ocr/T9AR.11-B1-126a37dd.json`): 2 files, 0 comments. **No findings.**

## T9AR.12 Chart on a phone: the labels in a strip

Lane PL (`d09ar/pl`), base `d74afb24`, commit `933ffabf`. 4 planned cases: three red then green (case 3's code had been written ahead and was disabled for a genuine red, then restored); case 4 a first-run pass (the strip already listed every phone label), mutation "list a label only when the placer finds it a spot" failed with `Sold 3: expected 'Stop +$316 · Banked +$478 · Target +$…' to contain 'Sold 3'`. Lane tier `T9AR.12`: unit 2353, integration 280, checks 14 of 14.

- Existing corridor cases that read phone labels on the drawing now read the strip (the stake tags, "Sold 2", the phone words, the result and banked labels drawn narrow, the banked label on the last session drawn narrow, B10's three banked labels at 340); wide expectations unchanged.
- `e2e/d9/responsive-a11y.spec.ts` (P150, the two named lines): `expectPhoneWords`'s Sold and stake-tag checks read `.replay-strip-labels`, plus a check that no line label is on the drawing; "labels no phone chart may lose" reads the strip when there is one.
- Browser: 4 passed, 2 failed: B9.5's fit check at 320 by 667 on the Detail replay and the Review card replay, 601 px of 589. **Pending decision, asked and answered** (`DECISIONS-PENDING.md`): take the 12 px from the price chart's phone height: **T9AR.12-D1**.
- Types: `DrawnChart.strip?`, `signedAxisMoney` in `geometry.ts`; `PlotSession.stripLabels` stays unused. New words in `new-words.md` (the slider's value on the phone drawing; the strip's order).
- ocr on `933ffabf` (`ocr/T9AR.12-933ffabf.json`): 6 files (6 excluded), 1 comment.

| Severity | Location | Finding | Verdict |
|---|---|---|---|
| medium | `corridor-pnl.tsx:153` | On a phone, both spots for the slider's value are centred on the cursor; at a late session in a narrow chart neither fits, the placer falls back to the first, and the value runs past the drawing's edge (width 340, 15 sessions: ends near 345) | Valid: T9AR.12-B1 |

- **T9AR.12-D1** Case: it should fit the replay on one screen at 320 by 667 with the P&L chart 200 high, the price chart giving up the 12 px.
- **T9AR.12-B1** Case: it should keep the slider's value inside the phone drawing at the last session.

## Suite runs

| Run | Commit | Tier | Result |
|---|---|---|---|
| `merge3` (after T9AR.5, T9AR.11 with B1 and T9AR.10-S1, T9AR.8 with B1, B2, B3, F1) | `e526637e` | full (`browser-auto 72ece0c8`) | unit 2357 (208 files), integration 280, browser-1 126, browser-2 79, browser-3 77, checks 14 of 14, all exit 0; `run-complete.sh`: run complete |
| `merge2` (after T9AR.4, T9AR.7, T9AR.10 with their bug and follow-up tasks) | `72ece0c8` | full (`browser-auto 79b900d3`: first matching path `e2e/d9/replay.spec.ts`) | unit 2332 (206 files), integration 280, browser-1 126, browser-2 79, checks 14 of 14 all exit 0; **browser-3 failed: 3 failed, 74 passed** (below); `run-complete.sh`: run complete |
| `merge1` (after T9AR.3 with T9AR.3-B1, T9AR.3-B2) | `79b900d3` | task (`browser-auto 1018d618`: no changed path is on the full-tier list) | unit 2297 (204 files), integration 280 (130 files), browser `@every-task` 5, checks 14 of 14; all exit 0; `run-complete.sh`: run complete |
| `wave0` (merge run after T9AR.1, T9AR.2) | `1018d618` | full (`browser-auto 1cc612ea`: first matching path `src/ui/cockpit/index.css`) | unit 2289 (203 files), integration 280 (130 files), browser-1 126, browser-2 79, browser-3 77, checks 14 of 14; all exit 0; `run-complete.sh`: run complete |

### `merge2` failures

`e2e/d9/responsive-a11y.spec.ts` lines 126, 134 and 146 ("should fit the Detail replay on one screen…", "should fit the Review card replay on one screen…", "should fit the Review card replay at 320 px…"), each `<where> at 1280 px: charts drawn at their box's width`. Reproduced in lane PL's T9AR.11 browser run (the same three). Cause, from the spec: `expectFitsOneScreen` (lines 22 to 27) expects a wide box's chart at the fixed 640 (`box < 460 ? Math.max(box, 200) : 640`), and T9AR.10 made the chart draw at its box's own width at every size (A275, its case "it should draw at its box's own width on a wide screen"). Pinned to T9AR.10; fixed in lane PL as **T9AR.10-S1**: the check expects the box's own width (at least 200) at every size, a consequence of A275 recorded as a changed expected value.
- T9AR.10-S1 done: `532b7d79`. Reproduced first under the lock: 3 failed, 3 passed; each expected `[0, 0]`, received `[215, 215]` (the 1280 px chart box is 855 wide). Changed line: before `const want = box < 460 ? Math.max(box, 200) : 640;`, after `const want = Math.max(box, 200);`; the comment on line 22 changed to match. After: 6 passed. Lane tier `T9AR.10-S1`: unit 2341, integration 280, checks 14 of 14. ocr on `532b7d79` (`ocr/T9AR.10-S1-532b7d79.json`): 1 file, 0 comments. **No findings.**
- Lane PL rebased onto `c292e409` (it brought in T9AR.5's domain files): `fa1e2f64` (T9AR.11), `8258d88c` (T9AR.11-B1), `780b88e1` (T9AR.10-S1). Lane tier rerun as `T9AR.11-rebased`: unit 2349, integration 280, checks 14 of 14; `run-complete.sh`: run complete. Merged by fast-forward to `780b88e1`.

## Critics

| Critic | Result | Tokens | Tool calls | Time |
|---|---|---|---|---|
