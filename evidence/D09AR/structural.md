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
  - T9AR.6-B3 done: `15acec47`; red `Error: Not a decimal: -20.19999999999999`, green; prices and quantity made exact first, distances by `sub`, `mul`, `div` (atStop −101/5, atTarget 199/5, rewardRisk 199/101); `againstPlanOf` unchanged (no subtraction). Lane tier `T9AR.6-B3`: unit 2343, integration 280, checks 14 of 14. ocr on `15acec47` (`ocr/T9AR.6-B3-15acec47.json`): 0 comments, **no findings**.
  - Lane DM rebased onto `b75e4597` (the task's own short note in `structural.md` merged into this section): `f40f46e3` (T9AR.6), `f327db49` (S1), `d2a9c2f5` (B1), `4d79df81` (B2), `36fc3d54` (B3). Lane tier rerun as `T9AR.6-rebased`: unit 2360, integration 280, checks 14 of 14; `run-complete.sh`: run complete. Merged by fast-forward to `36fc3d54`.
  - ocr on `db6f7f75` (`ocr/T9AR.6-B1-db6f7f75.json`): 0 comments, **no findings**. ocr on `88b9ba80` (`ocr/T9AR.6-B2-88b9ba80.json`): 1 comment.

| Severity | Location | Finding | Verdict |
|---|---|---|---|
| medium | `tests/support/replay-view-fields.ts:11` | The builders subtract prices as floats before converting, so `planColumnWithTerms(…, 100.1, 90, 120)` hands `r` `-10.099999999999994`, which `parseDecimal` rejects (at most six decimal places) | Valid: T9AR.6-B3 |

- **T9AR.6-B3** Case: it should build the Plan column from prices whose differences are not exact in floating point (entry 100.1, Stop 90, Target 120).
- **T9AR.6-S1** fix: `8435e52d`. Reproduced: `expected [ 'ConditionStatus', 'Markers', …(2) ] to deeply equal [ 'ConditionStatus', 'Markers' ]`. Changed expected values, a consequence of T9AR.6's planned variants: line 15 (the manifest's `replayTrade`) and line 20 (the Trade Detail route's required `replayTrade` variants), each before `['ConditionStatus', 'Markers']`, after `['ConditionStatus', 'Markers', 'PlanComparison', 'Odds']`. Line 20's change matches the plan row ("the Trade Detail and Review routes require them"). After: 1 of 1. Lane tier `T9AR.6-S1`: unit 2340, integration 280. ocr on `8435e52d` (`ocr/T9AR.6-S1-8435e52d.json`): 1 file, 0 comments. **No findings.** (The reviewer's note that I9.7 checks `getTrade` only with `toContain('Replay')` is not an ocr finding; the manifest test `workspace.test.ts` lists `getTrade`'s `Odds`.)

## T9AR.14 One name per figure in the replay

Lane RO (`d09ar/ro`), base `bcab74c4`, commit `064729f0`. 4 planned cases plus 1 added (`format.test.ts`'s `ratioToOne`), all red then green; `ratioToOne` had been written ahead and was backed out for genuine reds. No first-run pass. Titles changed for `-t` ("$" and "+" dropped; the quoted words kept in the assertions). Lane tier `T9AR.14`: unit 2378, integration 280, checks 14 of 14. Browser: `replay.spec.ts`, `gaps.spec.ts`, `states.spec.ts`: 14 passed.

- Lines changed: `readout.props.test.ts` (3: the Marks rows and change line with "$"); `replay.props.test.ts` (section 1.5's Underlying-Mark row: 2 table cells, 2 hover lines); `e2e/d9/gaps.spec.ts` (line 61 reads `Realized`, section 1.5's "Banked for a loss" row; line 38 and table cells 46, 47, 48 with "$"); `e2e/d9/replay.spec.ts` (table cells 75, 76); `e2e/d9/states.spec.ts` (table cell 64). The table cells in `states.spec.ts` and the extra `gaps.spec.ts` and `replay.spec.ts` cells are not in section 1.5's lists; they follow from W58 (the table reads the Marks rows) and T9AR.17 replaces the table. Accepted as consequences of a planned case. Not changed: `corridor.test.tsx`, `frame.test.tsx`, `price-strip.test.tsx` (hand-written doubles); no "2 to 1" lines were left in `replay.spec.ts`.
- Words are the plan's W57, W58, W59, not P137 shortenings: "Realized −$440.00" for a realized loss ("Banked" kept for a gain); "… of the result was realized before the end."; "BREN Mark $104.00", hover "BREN Mark: $101.80", "up $1.60 since …"; "2.00 to 1", "0.10 to 1". None uncovered.
- Left for other tasks: the table's Stop and Target trigger cells' bare Underlying price (`triggerOf` in `replay.props.ts`; section 1.5's T9AR.18 row); the table's "Banked" heading (T9AR.17).
- API: `ratioToOne(value)` in `src/ui/format.ts` (`formatDecimal(value, 2) + " to 1"`); the shared `ratio` unchanged (P152). T9AR.15 and T9AR.17 use `ratioToOne` and the Realized/Banked rule.
- ocr on `064729f0` (`ocr/T9AR.14-064729f0.json`): 9 files (5 excluded), 0 comments. **No findings.** Merge after lane DM's (rerun in progress).
- Rebased onto `cf79c748`; lane tier rerun `T9AR.14-rebased`: unit 2382, integration 280, checks 14 of 14; `run-complete.sh`: run complete. Rebased again over the evidence-only `7f095ba3` (no code between): `9a40b95a`. Merged by fast-forward. Lane OV then rebased onto it: `182b2f55` (T9AR.9), `f8e25291` (B1), `a5949701` (B2), `0587caeb` (B3), `67e462eb` (T9AR.8-B4), `a3946e98` (B4); lane tier rerun as `T9AR.9-rebased`: unit 2388, integration 280, checks 14 of 14; `run-complete.sh`: run complete. Merged by fast-forward to `a3946e98`.

## T9AR.15 Reward to risk with the estimated odds; the extremes' weight

Lane RO (`d09ar/ro`), base `9a40b95a`, commit `5f395db7`.

- 6 planned cases plus 1 added (`data-weight` on the grid rows, for the stylesheet). All went red then green; no first-run pass.
  - "under 1%" red read "about 1% : 99%": 0.5% rounds to 1, so the edge follows the view's exact fraction against 1/100.
  - Titles dropped `$`, quotes and parentheses; the quoted words stay in the assertions.
- Lines changed, under section 1.5's T9AR.15 row:
  - `e2e/d9/replay.spec.ts`, Mon 11-02: the stake sentence and the Reward to risk row now carry the odds; one line asserting the odds note was added.
  - `readout.props.test.ts`: the "(Plan 2.95 to 1)" line and the AXIO-U 0.10 to 1 case.
  - `stake-words.props.test.ts`: the old BREN stake-sentence case is replaced by the planned R-DALE-D case.
  - The Stays files are untouched.
  - `view-doubles.props.ts` (a test helper not on any lane's list) gained odds doubles. Accepted as a helper of lane RO's tests.
- Browser: `e2e/d9/replay.spec.ts` 5 passed.
- Words: W60 as written; none shortened. Uncovered: the mirror "over 99% : under 1%" and its spoken form (in `new-words.md`).
- API: `ratioWords(view, session)` in `stake-words.props.ts` returns `{ text, plan?, odds? }`, for T9AR.20.
  - `StakeRow.weight` is `figures.extremes ?? 'Main'`.
  - CSS: `tr[data-weight='Remote']` is 0.85em in `--muted`; the note is `.replay-odds-note`.
  - With no odds in the view, the old wording stays.
- **Not wired:** `ReplayFrameSession.stakeSpoken` (frozen by T9AR.2) is filled by no task. The stake sentence is not spoken with the odds in full, though the readout row is (W60's case is met there). It is in lane SC's files (`session-words.props.ts`, `replay.props.ts`, `frame.tsx`), so it goes to lane SC as **T9AR.15-D1** after lane SC merges.
- Lane tier `T9AR.15`: unit 2388, integration 280, checks 14 of 14.
- ocr on `5f395db7` (`ocr/T9AR.15-5f395db7.json`): 9 files (5 excluded), 1 comment.
  - **T9AR.15-B1** (Valid, `readout.tsx:89-91`): the `role="img"` span's label holds only the odds, so a screen reader loses the current ratio "11.69 to 1". Briefed in lane RO.
  - Reviewer's notes, not findings:
    - The "under 1%" edge compares the view's exact fraction with 1/100 to pick words. That is selection, not calculation, as `plot.props.ts` and `replay.props.ts` already do with `ZERO`. Exactly 1% reads "about 1% : 99%", correctly, but is untested.
    - The mirror keeps W60's Target-first order and needs the user's approval (in `new-words.md`).
    - `extremes ?? 'Main'` is right (A268).
    - With no current odds, the Plan side shows its ratio alone.
  - **B1** `bed934e8`: "should speak the current ratio and the odds in full to a screen reader in the Reward to risk row".
    - Red: `expected <span role="img" …(1)></span> to be null`; then green.
    - The ratio is now plain text, split from the value at " · ", and only the odds sit in the labelled span. Visible text is unchanged.
    - One assertion in T9AR.15's own odds-note case changed: the labelled image's text was the whole value and is now the odds part only. Its other assertions, including the whole row text, are unchanged. Accepted as forced by the fix.
    - Browser: `e2e/d9/replay.spec.ts` 5 of 5. Lane tier `T9AR.15-B1`: unit 2389, integration 280, checks 14 of 14. Sent to ocr, including whether splitting the formatted string belongs in the adapter.
    - ocr on `bed934e8` (`ocr/T9AR.15-B1-bed934e8.json`): 2 files (5 excluded), 0 comments, **no findings**.
      - Reviewer's note, not a finding: the split at " · " does no arithmetic and is safe with today's adapter, but it is fragile. The suggestion is for `ratioWords` to hand over `ratioText` and `marks` separately. This is recorded for the final report as a suggested hardening.
    - Lane RO is ready; it merges after lanes PL and IN.
- **Merged.** Lane tier rerun `T9AR.15-rebased`: unit 2410, integration 286, checks 14 of 14; `run-complete.sh`: run complete. Fast-forwarded to `3cb51638`.
  - Lane S4 then rebased onto it, with its tier rerun as `merge4-S1-rebased`. Lane SC fast-forwarded to `3cb51638`.
  - Briefed:
    - T9AR.15-D1 again, in lane SC;
    - T9AR.20 in the new lane RW at `3cb51638`.
- **T9AR.15-D1** `3fa682b6` (lane SC): "it should speak the stake sentence with the odds in full to a screen reader", in two files.
  - `session-words.props.test.ts`: red `expected undefined to be` the spoken sentence; then green.
  - `frame.test.tsx`: red `TestingLibraryElementError`; then green.
  - No first-run pass.
  - `stakeSpokenOf` swaps the visible odds pair for `ratioWords(...).odds.spoken`. The Plan's part keeps its visible words, since there is no spoken form for it. The field is unset where the sentence has no odds.
  - The frame renders an `aria-hidden` visible span and a `visually-hidden` spoken span.
  - No new words; no browser run.
  - Lane tier `T9AR.15-D1`: unit 2412, integration 286, checks 14 of 14.
  - ocr on `3fa682b6` (`ocr/T9AR.15-D1-3fa682b6.json`): 4 files (5 excluded), 0 comments, **no findings**.
    - The reviewer checked the swap: a Plan pair equal to the current pair still swaps only the current one, which comes first.
    - Suggestion, recorded for the final report alongside T9AR.15-B1's: build the visible and spoken sentences from the same parts in `stake-words.props.ts`, not by searching the finished sentence.
    - The edge wordings are untested here.
  - T9AR.17 briefed on top of it in lane SC; it may export (only) the row builders from `readout.props.ts` and replace the table types in `replay.types.ts`. It may make a minimal change to `stake-words.props.ts`, since lane RO is idle. `readout.props.ts` is left to lane SC, whose T9AR.17 exports its row builders.
- **T9AR.15-D1** briefed in lane SC at `4179346d`: fill `stakeSpoken` from `ratioWords(...).odds.spoken`.
  - It stopped with no change: `ratioWords` is lane RO's and is not merged yet (the main session's brief was premature). Parked until lane RO merges, then re-briefed on lane SC rebased onto it.

## T9AR.17 Session cards replace the table

Lane SC (`d09ar/sc`), from `3fa682b6`.

- **Commits:** refactor `00968f23` (`card-pager.tsx`, with the Journal's tests unchanged) and cases `7c3ad267`.
- **Cases:** 9 planned plus 2 added (Events on a card; the odds spoken in full on a card), all red then green.
  - The second case's first green failed because the test omitted the Held row; the test was corrected, not the code.
  - **First-run passes:** "name the cards' list as the charts' description" (mutation: list id changed, failed) and carried defect 1a (mutation: past-line text cut, failed with `Unable to find … Past the Stop by $180.00 (0.30R) · at Stop −$740.00`).
  - Titles dropped `$`, quotes and parentheses (case 2 its "(R-BREN-U Thu 11-12)", fixture unchanged).
- **Lines changed (section 1.5's T9AR.17 rows):**
  - `e2e/d9/support.ts`: `openTable` and `tableRow` became `sessionCards`, `sessionCard(scope, date)` and `cardRows`.
  - `gaps.spec.ts`, `replay.spec.ts` and `states.spec.ts` now assert card rows (the past-line row in place of "$0.00"; a final card has no stake rows).
  - `frame.test.tsx` and `replay.props.test.ts` table cases became card cases.
  - The `describedBy` id is `replay-cards` in `corridor.test.tsx`, `price-strip.test.tsx`, `frame.test.tsx` and `plot.props.test.ts`.
  - **`plot.props.ts`** (lane PL, idle), one line: the id is built there, not in `replay.props.ts` as section 1.5 says. Accepted as a lookup miss.
- **Types:** `TableRow`, `tableRow`, `tableTitle` and `tableColumns` removed; `card` and `cardsWords` are now required; `SessionCardRow` gained `r?`, `pnl?` and `spoken?`; `SessionCardBody` has `pastLine?` and `events`.
- **Exports:** only `NO_MARK` added to `readout.props.ts`. `cardOf` selects from the readout's built groups, so the row builders were not exported.
- **Words:** none shortened or uncovered.
  - A card's Reward to risk shows the ratio and odds without the "(Plan …)" part; the Plan's ratio stays in the readout and moves to T9AR.18's Plan block (P148 holds).
  - "Events" shows only when a session has events.
  - A no-Mark Trade P&L is the dash.
- **Browser:** `e2e/d9` `gaps`, `replay`, `states`, `responsive-a11y`; B9.5's fit passes.
  - **`replay.spec.ts:108` fails:** the `stake(scope)` helper reads `.replay-stake`, whose text now includes T9AR.15-D1's visually hidden spoken sentence. This is **T9AR.15-D1's regression**: its agent ran no browser spec, saying none read the paragraph, which was wrong.
  - Fixed as **T9AR.15-D1-S1** in lane SC: `57ae6099` (evidence `5d227e04`).
    - The failure was confirmed with the old helper ("1 failed").
    - Only `stake` in `e2e/d9/support.ts` changed: it selects the paragraph's `aria-hidden` span, or the plain paragraph, and nothing when there is none. No expected value changed.
    - `replay.spec.ts`, `states.spec.ts` and `gaps.spec.ts` (the only callers) passed 14 of 14.
    - Lane tier `T9AR.15-D1-S1`: unit 2417, integration 286, checks 14 of 14.
    - Sent to ocr. T9AR.17-B1, B2, B3 and B4 were briefed on top of it.
    - ocr on `57ae6099` (`ocr/T9AR.15-D1-S1-57ae6099.json`): 1 file (1 excluded), 0 comments, **no findings**. The reviewer confirmed each shape matches exactly one element and `toHaveCount(0)` stays meaningful.
- **Lane tier `T9AR.17`:** unit 2417, integration 286, checks 14 of 14.
- **Note for T9AR.18:** remove the Stop and Target (`triggerOf`) rows from `cards.props.ts` when they move to the Plan block.
- **ocr** on `3fa682b6..7c3ad267` (`ocr/T9AR.17-7c3ad267.json`): 22 files (5 excluded), 4 comments, all in `7c3ad267`, all **Valid**, made bug tasks:
  - **T9AR.17-B1** (`frame.tsx:106`): the cards go back to the first page only when the newest card's date changes. Another Trade with the same slider date, without a remount, keeps the old page and hides the slider's card.
  - **T9AR.17-B2** (`session-cards.tsx:57`): a resize that changes the page size can hide the focused card heading or disable the focused pager button, and focus drops to the page.
  - **T9AR.17-B3** (`cards.props.ts:19`): an empty Not-applicable R or "P&L if hit" is copied onto the card, which then shows a bare " · " and "P&L if hit " (the test's `said()` filters it out).
  - **T9AR.17-B4** (`e2e/d9/support.ts:216`): `sessionCard` only presses "Earlier sessions", so finding a newer card after an older one fails once they span pages.
  - These go to lane SC after T9AR.15-D1-S1.
    - **B1** `03e819b6`: red `expected ['Tue Nov 10','Mon Nov 9'] to deeply equal ['Thu Nov 12','Wed Nov 11']`; then green. Fix: `key={tradeKey}` on `<SessionCards>`.
    - **B2** `2f16b8de`: red was the focus assertion; then green. A layout effect on a page-size change hands focus to an enabled pager button, else the first shown heading. The slider's heading was not chosen, since it is hidden off the first page.
    - **B3** `2010281f`: red `expected { label: 'At Worst case', … } to not have property "r"`; then green. `said()` no longer filters empty parts.
      - Only the empty R is tested: the fixture's P&L-if-hit reads "Not applicable: no open position", which is not empty.
    - **B4** `b9f24626`: a new spec `e2e/d9/session-cards.spec.ts`, since no existing spec file is lane SC's. It runs R-BREN-U at 375 wide, one card a page.
      - Red: the Wed Nov 11 lookup was not found; then green. `sessionCard` pages back to the first page, then earlier.
      - The tdd-log rows were written by hand (`tdd.sh` runs vitest only).
    - No first-run pass.
    - Browser: `session-cards.spec.ts` 1, and `gaps`, `replay`, `states`, `responsive-a11y` 20, all passed.
    - Lane tier `T9AR.17-B` (`277c5ceb`): unit 2420, integration 286, checks 14 of 14.
    - ocr on `5d227e04..b9f24626` (`ocr/T9AR.17-B-b9f24626.json`): 8 files (4 excluded), 0 comments, **no findings**.
      - Reviewer's notes, not findings: B2's disabled-button trigger and its one-page fallback are untested; B3's `pnl` half is vacuous in its test.
- Lane SC rebased onto `5e0664e7`:
  - `93dbec7e` (T9AR.15-D1);
  - `6da6b33f` (T9AR.17 refactor);
  - `f383ac30` (T9AR.17);
  - `b8351ccb` (D1-S1) and `06cdd252` (its evidence);
  - `79b77814` (B1), `445ee9ac` (B2), `c7320081` (B3), `39e8983a` (B4);
  - `445aa9d9` (evidence).

  Lane tier rerun `T9AR.17-rebased`: unit 2426, integration 286, checks 14 of 14; `run-complete.sh`: run complete. Fast-forwarded to `445aa9d9`. T9AR.18 briefed in lane SC from there; T9AR.20-F1 follows it in lane SC.
- **Reviewer's notes, not findings (for the final report):**
  - Finding readout groups by title has no shared constant.
  - The cards split the odds at " · ", like T9AR.15-B1.
  - `gapStakeGroup` gives no stake rows when neither Stop nor Target is a Value (doubtful P148).
  - The charts are described by the shown page of cards only, since off-page cards are hidden. That is A277's design, but narrower than the old table.

## T9AR.18 The Plan beside what happened

Lane SC (`d09ar/sc`), from `445aa9d9`, commit `cd2e813f`; rebased onto `9bce9630`, now `bb3ac29a`.

- **Cases:** 14 cases, all red then green.
  - **First-run passes:** "name what each price is a price of" (mutation: always the option's right, failed) and "two Stops with their own rows" (mutation: first condition only, failed).
  - The Strike row and the Entry and At wording had been written ahead of their cases; they were backed out for genuine reds.
- **Lines changed:**
  - `readout.props.test.ts`, `replay.props.test.ts` and `cards.props.test.ts`: the Plan group and the cards' Stop and Target rows removed (section 1.5's row).
  - `e2e/d9/states.spec.ts`, `gaps.spec.ts` and `replay.spec.ts`: the `h3` lists drop "The Plan"; the cards drop their Stop and Target rows; the Events gain W63's and W64's words.
- **Words** (W62, W63, W64, W40's "Strike $100"; none shortened). Uncovered:
  - "Stop breached, first seen Mon Nov 9." (a Stop first seen after a gap, no longer crossed);
  - no "since" form for a Target;
  - both crossings on one session join Stop then Target.
- **Types:**
  - `PlanBlock`, `ReplayProps.plan?`, `ReplayFrameSession.crossingWords?`;
  - `planBlockOf(view)` and `markerPlanWords(marker)` exported;
  - `cardOf` lost its `view` parameter;
  - `planGroup` deleted.
- **Browser:** `gaps`, `replay`, `states` and `session-cards` pass. **B9.5's 320 fit fails** (616 of 588.9 px), caused by the crossing sentence. This was asked as a pending decision; the user chose **the sentence below the charts on a phone** (`DECISIONS-PENDING.md`), routed as **T9AR.18-D1**.
- **Lane tier `T9AR.18`:** unit 2440, integration 286, checks 14 of 14.
- **ocr** on `cd2e813f` (`ocr/T9AR.18-cd2e813f.json`): 15 files, 2 comments, made tasks:
  - **T9AR.18-B1** (Doubtful, `readout.props.ts:149`): with no `terms`, the Plan block is empty while the old group is gone. The fix is to make `terms` required.
  - **T9AR.18-F1** (Valid, readability, `session-words.props.ts:106`): nested ternaries.
- **Reviewer's notes, not findings (for the final report):**
  - `planBlockOf` words every condition by the first Planned Leg, which is latent for multi-leg Plans.
  - With two conditions of a role, the chart's headline At Stop and At Target need not equal a row.
  - A re-crossed Stop says only "Past the Stop since".
  - A card's Events say "first breached" even after a gap.
- **Next, briefed in lane SC in order:** T9AR.18-D1, T9AR.18-B1, T9AR.18-F1, T9AR.23-S4, T9AR.20-F1.
- **Done in lane SC** (from `bb3ac29a`), evidence `ee37e3b4`:
  - **T9AR.18-D1** `b49ff547`:
    - Red: both B9.5 fit cases ("span 616 px of 588.9"), and the new position case (860 px: the sentence at y 139.8, the charts end at 631.6).
    - Fix: in `replay-frame.css`, at 860 px and below, `.replay-card` becomes a flex column; the sentence gets `order: 1` and everything after the chart box `order: 2`.
    - Green: all three pass.
    - New `e2e/d9ar/crossing-position.spec.ts` (AXIO; 1280 and 861 px after the status line; 860 and 375 px after the charts).
    - **Note for the final report:** a screen reader follows the page's order, not the CSS order, so on a phone it still hears the sentence after the status line, which is the same order as on a wide screen. Matching the seen order would need the sentence rendered twice, or JS. That was not done; the brief's "reading order follows what is seen" is not met.
  - **T9AR.18-B1** `5f074418`, structural (no case can go red; the producer always fills `terms`):
    - `terms` is now required in `ReplayPlan` (`replay-series.ts`) and in `ReplayPlanColumn` (`replay-view.ts`, lane DM, idle; outside the brief's list but in its "domain and view types").
    - `NO_TERMS` added to `view-doubles.props.ts` (not listed; it holds the shared plan doubles).
    - Typecheck passes; 931 tests green.
  - **T9AR.18-F1** `9805e4a5`, structural: plain if/else, same sentences; 211 replay tests green.
  - **T9AR.23-S4** `40d132af`:
    - Red: the e2e case with its `test.fail` removed, rgb(85, 82, 75) against rgb(28, 27, 25).
    - Fix: the `.replay-stake` muted colour removed. Green.
  - **T9AR.20-F1** `12c9b1f9`, structural: `pastLineRow` calls `pastLineWords`. Tests unchanged and green.
  - No first-run pass.
  - Browser: `e2e/d9` `gaps`, `replay`, `states`, `session-cards` and `responsive-a11y`, plus `e2e/d9ar` `readout`, `responsive-a11y` and `crossing-position`: 45 passed (other lanes' `test.fail` cases counted).
  - Lane tier `T9AR.18-fixes`: unit 2440, integration 286, checks 14 of 14.
  - **ocr** on `bb3ac29a..12c9b1f9` (`ocr/T9AR.18-fixes-12c9b1f9.json`): 9 files, **no findings**.
    - Reviewer's notes, not findings: the flex-column lines are inert, because `.replay-overlay .replay-card { display: grid }` wins, so only `order` takes effect (on grid items) and the relative order is kept; the `:not(.replay-crossing)` is redundant. Both are left for the final report.
  - **Merged:** rebased onto `237a717f` (evidence only since its base, so no rerun) and fast-forwarded. Main is at `a3e91cd3`. T9AR.18 is now `b52cfe8f`; D1 `55aa3561`, B1 `6a0106ce`, F1 `e2ea1776`, T9AR.23-S4 `6a8d7f0e`, T9AR.20-F1 `cc983980`.
  - Lanes OV and PL will bring this code in on their rebase and rerun their lane tiers. Lane BR was fast-forwarded to `a3e91cd3` for T9AR.23 part 2.

## T9AR.23 Browser suite

Lane BR (`d09ar/br`), base `70ce0f74`.

- **Part 1** (B9AR.1, B9AR.2, B9AR.3, B9AR.5, B9AR.7) was started before T9AR.18 finished, as a scheduling choice: it is tests only and does not depend on the Plan block, and it surfaces layout defects early. B9AR.4, B9AR.6 and B9AR.3's Position-group words come in part 2, after T9AR.18 merges.
- The brief names the suspected overlay grid defect (B9AR.1, "readout beside the charts at 1280").
- A case the product fails is kept as written and reported, not weakened.
- **Part 1** `9bce9630`, tests only.
  - `e2e/d9ar/support.ts`, plus `overlay.spec.ts`, `review.spec.ts`, `readout.spec.ts`, `chart.spec.ts` and `responsive-a11y.spec.ts`.
  - `e2e/d1/support.ts` gains a `touch` option.
  - `package.json`'s `test:e2e:3` adds `e2e/d9ar`. Part 1 takes 1.6m, so browser-3 should take about 6.6m, under 8.
  - `npx playwright test e2e/d9ar`: 35 passed, **9 of them `test.fail()`** where the product disagrees with the plan.
  - Lane tier `T9AR.23-1`: unit 2426, integration 286, checks 14 of 14.
  - Merged by fast-forward (main had not moved).
- **The disagreements, routed as suite-failure tasks.** Each task removes its own `test.fail` line, which is its red.
  - **T9AR.23-S1** (lane OV; `overlay.spec.ts:79` and `readout.spec.ts:179`): at 1280 the readout sits below the charts. `replay-overlay.css` places `.replay-plot-frame`, but the grid child is `.replay-chart-box`; figures also wrap onto two lines in the narrow column. This confirms the main session's earlier check.
  - **T9AR.23-S2** (lane OV; `responsive-a11y.spec.ts:112`): at 320 by 667 the overlay's header, headline and charts span 708 px (measured before T9AR.18). Fit the overlay's own chrome, or report options.
  - **T9AR.23-S3** (lane OV; `responsive-a11y.spec.ts:229`): the Close button is 21 px high on a phone, under the 44 px minimum.
  - **T9AR.23-S4** (lane SC; `readout.spec.ts:77`): the "From here" sentence is muted grey, not the status line's colour.
  - **T9AR.23-S5** (lane PL; `responsive-a11y.spec.ts:264`): a tap leaves the hover box.
  - **T9AR.23-S6** (lane PL; `chart.spec.ts:125`): the key does not list "No Mark" when the P&L chart shades the put's missing Mark. This rests on W66, "lists what is drawn".
- **T9AR.23-S6** `60fbad9e` (lane PL): unit case "should list No Mark in the key for a session whose result is missing though the Underlying has a Mark (W66)".
  - Red: `expected [ 'Mark', 'Break-even', 'Strike' ] to include 'No Mark'`; then green.
  - `chart.spec.ts`'s case passes with its `test.fail` removed.
- **T9AR.23-S5** `a40db82d` (lane PL): two unit cases, both red then green.
  - "touch or pen pointer reports no hover": red `expected [ 1, null, 1, null ] to deeply equal []`.
  - "the focus a tap gives its button is not reported": red `expected [ 1 ] to deeply equal []`.
  - The pointer fix alone left the e2e failing (`Expected: 0, Received: 1`). The real second cause was the focus a tap gives the session button.
  - The e2e passes with its `test.fail` removed.
- No first-run pass. Evidence `94afc000`.
- Browser: `e2e/d9ar/chart.spec.ts`, `e2e/d9ar/responsive-a11y.spec.ts` and `e2e/d9/responsive-a11y.spec.ts` 25 passed. The ✘ on the Close-button case is its `test.fail` (an expected failure, lane OV's S3), not a flake.
- Lane tier `T9AR.23-S-PL`: unit 2429, integration 286, checks 14 of 14.
- **ocr** on `9bce9630..a40db82d` (`ocr/T9AR.23-S5-S6-a40db82d.json`): 6 files, 1 comment, in `a40db82d`.
  - **T9AR.23-S5-B1** (Valid, `corridor.tsx:40`): `tapped` is cleared only by a focus event. A tap on the focused button, or a touch that turns into a scroll, leaves it set, and the next keyboard focus reports no hover. Briefed in lane PL.
  - The reviewer confirmed S6 lists "No Mark" exactly when a column is drawn.
- **T9AR.23-S5-B1** `b3225e82` (lane PL), rebased onto `9b908473` as `7f62fec6`:
  - Case: "should report keyboard focus after a tap that gave no focus, a tap on the focused button or a touch that became a scroll". The parentheses were dropped from the name because `-t` could not filter them, so the first run matched 0 cases and does not count.
  - Red: `expected [] to deeply equal [ 2 ]`, then green; `corridor.test.tsx` 61 of 61.
  - Fix: `tapped` is also cleared on `pointercancel`, `keydown` and `click`. Clearing on `pointerup` broke S5's e2e, because in Chromium a touch's focus comes after `pointerup`.
  - `e2e/d9ar/responsive-a11y.spec.ts` 13 of 13. Lane tier `T9AR.23-S5-B1`: unit 2430, integration 286, checks 14 of 14.
  - **ocr** on `7f62fec6` (`ocr/T9AR.23-S5-B1-7f62fec6.json`): **no findings**.
    - Reviewer's notes, not findings: a long-press with no `pointercancel`, or a non-scrolling drag off the button, could still leave the flag stale. Both are doubtful in practice, and the reviewer found no such area in the file.
    - No test covers the `keydown` reset.
    - Both notes are for the final report.
- Lane PL was rebased onto `9b908473`, which brings in T9AR.18 and lane SC's fixes. Lane tier rerun `T9AR.23-S-PL-r`: unit 2444, integration 286, checks 14 of 14. Run complete.
- **Merged** by fast-forward; main is at `7f62fec6`. After the rebase: T9AR.23-S6 `85ef2c57`, S5 `54bc7766`, S5-B1 `7f62fec6`.
- **Lane OV** (from `9bce9630`): S1 `c4e56a07`, S3 `706cca7d`, S2 `bd86c24e`, test and evidence `96dfb359`. Rebased onto `e339e847` as `3faba47b`, `6ffb41c6`, `6606e5fd` and `46d1f526`. The two screenshots that conflicted (`B9AR.3-from-here-colour.png`, `B9AR.7-tap-hover-box.png`) keep main's copies, which come from the lanes that fixed those cases.
  - **T9AR.23-S1:**
    - Red: the readout at x 770, below the charts. With only the chart box moved, the one-line cases still failed: "+$988.00 · 3.05R" was 41 px high, because the app-wide two-column `dl` in `app.css` halved each row.
    - Fix (`replay-overlay.css`): `.replay-chart-box` takes column 1; from 861 px up the readout's `dl` is one column; the grid is `minmax(0,1fr) minmax(0,340px)`. A 3fr/2fr split made the P&L chart 715 px, under the 800 minimum; it is now about 853 at 1280.
    - Green: `overlay.spec.ts` and the five one-line cases pass.
    - `overlay.test.tsx`'s A275 selector constant changed to `.replay-chart-box`; its expectations are unchanged.
  - **T9AR.23-S3:** red, Close 21 px high. Fix: on a phone the header has no vertical padding and `[data-close]` gets `min-height: 44px`. Green.
  - **T9AR.23-S2:** the span went from 708 px to 688 after S3, and to 665 of 667 now (2 px margin). The phone title is `0.9rem` with line-height 1.2, and the body's and the card's top padding are 4 px. No chart was shortened, no word cut, no figure hidden. Green.
  - Browser: `e2e/d9ar` and `e2e/d9/responsive-a11y.spec.ts` gave 40 passed, 1 failed: `chart.spec.ts:42`, where `text.axis-start` "Mon Nov 2" was missing at Mon 11-02.
    - Cause: `corridor-pnl.tsx` drops the start label when the cursor's name overlaps it, and at about 853 px it does.
    - The agent offered three options. Changing the label rule meets W67 as written (both the left date and the cursor's name), and the end label already keeps its place with the cursor's name stepping aside. So it is a fix within the plan, **not a pending decision**: **T9AR.23-S7** in lane PL.
  - Lane tier `T9AR.23-S-OV` (on the old base): unit 2426, integration 286, checks 14 of 14.
  - **ocr** on `e339e847..46d1f526` (`ocr/T9AR.23-S1-S2-S3-46d1f526.json`): 5 files, **no findings**.
  - **Reviewer's notes, not findings (for the final report and the gate critic):**
    - On a phone (860 px and below) the app-wide two-column `dl` still applies to the readout, so its rows alternate between half-width and full-width cells. The 320 screenshot does not show the readout, so check it before calling A275 done.
    - Between 860 and 861 px (fractional, under zoom) the override is off.
    - The phone title can wrap to two lines. It still fits under the 44 px Close button, but the CSS comment says "one line".
    - The readout column is a fixed 340 px with `nowrap` stake cells. Four-digit stake figures could overflow it at 1280 and wider; no test covers that.
    - The file ends with `}}` on one line.
  - Lane PL was fast-forwarded to `46d1f526`, so S7 builds on lane OV. The two merge together, and S7's lane tier stands for both on main's latest code.
- **Part 2** `c0792f4b` (lane BR, from `9b908473`), tests only. **Every case passes against the product; none disagrees, no `test.fail`.**
  - `cards.spec.ts` (B9AR.4): 3 cases.
    - R-AXIO-D through all 11 sessions: the Plan block, the cards, paging, the headings move the slider, and W63 and W64 on the sale.
    - R-BREN-U.
    - R-CORV-D's crossing from Fri 11-06 on.
  - `states.spec.ts` (B9AR.6): 4 cases.
    - K-sale.
    - R-DALE-U's Settlement Due, then its Expiration and Final result.
    - A Planned Trade has no Replay button.
    - R-CORV-D's missing Mark, then acknowledged unavailable.
  - `readout.spec.ts`: 2 Position-group cases.
  - Wording the agent narrowed or filled in, for the gate critic:
    - The figures check covers the P&L chart's labelled figures only.
    - The price chart's Stop and Target lines are checked against the Plan block.
    - R-CORV-D's Plan rows are taken from the product, since the plan gives no W62 words for them.
    - The acknowledged top line is matched loosely: it contains "acknowledged unavailable" and "Tue Nov 10", and not "No Mark for". The product writes "Acknowledged unavailable: …".
  - The first run had 5 failures, all mistakes in the tests, fixed there and logged.
  - Timing: `e2e/d9ar` 2.0m with 45 cases. browser-3 is estimated at about 7.0m, under 8, so no `browser-4`.
  - Lane tier `T9AR.23-2`: unit 2440, integration 286, checks 14 of 14.
  - **ocr** on `c0792f4b` (`ocr/T9AR.23-2-c0792f4b.json`): 4 files, 3 comments, all Valid. Each became a task, briefed in lane BR (rebased onto `e339e847`, so part 2 is now `9618d87b`):
    - **T9AR.23-B1** (`cards.spec.ts:25`): the readout's and the card's figures are merged into one set and matched by bare number.
    - **T9AR.23-B2** (`cards.spec.ts:27`, `cards.spec.ts:30`, `cards.spec.ts:31`): the loops can run zero times, and the price chart's Mark is promised but never checked.
    - **T9AR.23-B3** (`cards.spec.ts:126`, `cards.spec.ts:127`): R-BREN-U is checked only at sessions 1 and 9.
  - **Done in lane BR** (from `9618d87b`), tests only, no case disagreeing with the product:
    - **T9AR.23-B1** `f7e72247`: each drawn P&L figure is checked on its own row, by label and figure, in the readout and on the card. Bite: the Stop result mapped to "at Worst case" failed (expected −600, received [9940, −10000]).
    - **T9AR.23-B2** `e843b82b`:
      - Each Trade names the price lines it must draw (AXIO Stop and Target; BREN and CORV Strike), matched to the Plan block's rows.
      - The price chart's Mark is checked on the "<symbol> Mark" row of both surfaces.
      - Each P&L label must yield a figure, and at least one must be compared.
      - Bites: an expected "Strike" on AXIO failed; a wrong Mark row label failed (received []).
    - **T9AR.23-B3** `c2b50bb6`: R-BREN-U steps through every session. Bite: expecting session 5 at session 6 failed. The new screenshots are `B9AR.4-BREN-session-2.png` to `-11.png`; the old `B9AR.4-BREN-Thu-11-12.png` is left in place.
    - `e2e/d9ar --workers=1` 45 passed in 2.0m. Lane tier `T9AR.23-B` (`cc663d5d`): unit 2444, integration 286, checks 14 of 14.
    - **ocr** on `9618d87b..c2b50bb6` (`ocr/T9AR.23-B-c2b50bb6.json`): **no findings**.
    - Reviewer's notes, not findings, for the gate critic:
      - Labels still not compared: Max reward, the slider's value, and markers.
      - The stake tag and the result share the "at Stop" row, so a swap would pass.
      - Requiring the price lines on every session is brittle, because a line without room for its label is not drawn.
      - The check ties to the readout's row words, and "Past the Stop's amount by" is not mapped.
      - The stale `B9AR.4-BREN-Thu-11-12.png` is left in place.
    - **Merged** by fast-forward, since lane BR's base `e339e847` was main's head. Main is at `cc663d5d`. T9AR.23 part 2 is `9618d87b`; B1 `f7e72247`, B2 `e843b82b`, B3 `c2b50bb6`.
  - Reviewer's notes, not findings, for the gate critic:
    - The figure filter leaves out `slider-value`, `max-reward-label`, `break-even-label` and `marker-label`.
    - The acknowledged-unavailable check could be an exact match of `calculation-words.ts`'s words.
- **T9AR.23-S7** `dd6a4dd7` (lane PL, on lane OV's `46d1f526`):
  - The start label is always drawn, and the cursor's name steps between it and the end label.
  - On the first session the cursor's name is the start label, so it is drawn once. The existing "not drawn twice" case is unchanged.
  - On a chart too narrow for all three labels, the cursor's name is left out.
  - Cases in `corridor.test.tsx`:
    - 560 px, session 2: red, `axis-start` null; then green.
    - 850 px, first session: red, `['cursor-label']` against `['axis-start']`; then green.
    - 280 px: a **first-run pass**, flagged. It was written with the fix. Mutation: always draw the cursor's name; it failed, was restored, and is green.
  - A first draft of case 1 at 850 px passed on the old code. Its red row in the log is invalid and noted there; the agent's deletion was denied and not retried.
  - Browser: `e2e/d9ar` 47 passed, including `chart.spec.ts:42` and lane OV's 320 fit cases on main's T9AR.18 code. `e2e/d9/responsive-a11y.spec.ts` and `replay.spec.ts` 11 passed.
  - Lane tier `T9AR.23-S7` (stands for lane OV too): unit 2447, integration 286, checks 14 of 14.
  - **ocr** on `dd6a4dd7` (`ocr/T9AR.23-S7-dd6a4dd7.json`): 2 files, 1 comment.
    - **T9AR.23-S7-B1** (Valid, `corridor-pnl.tsx:313-316`): both edge labels are always drawn, so at widths 200 to 222 the start label and "Expires Fri Nov 20" overlap, by 8 px at 215 and 23 px at 200. The Review card's chart at 320 px is 215 to 226 wide. Briefed in lane PL: fix by placement, or by a P137 shortening used only when narrow; stop and report if neither works.
    - Reviewer's notes, not findings, for the gate critic and the final report:
      - The cursor's name is clamped between the edge labels with no tie to its column, so on a narrow chart with many sessions it can sit about 5 columns from its session. The left-hand clamp is new.
      - On the first session of a wide chart, the date is drawn once at the far left, about 1.5 columns from the cursor.
      - The slider's `aria-valuetext`, the card and the hit buttons still name the session when the cursor's name is left out.
- **T9AR.23-S7-B1** `8ef228d8` (lane PL):
  - Case: "should draw both edge labels without overlap at width %i on an option Trade", run at 200, 215, 223 and 240.
  - Red: 2 failed, 2 passed. At 200 it reported "expected 105 to be <= 82", and at 215 "expected 105 to be <= 97". Then green: 4 passed, and the 222 replay tests pass.
  - Fix: P137 shortening, nothing hidden and no height added. The end label takes the first form that clears the start label by 4 px:
    - "Expires Fri Nov 20";
    - "Expires Nov 20";
    - "Exp Nov 20".
  - The cursor's room uses the label drawn. Recorded in `words-changed.md`.
  - Browser: `e2e/d9ar` and `e2e/d9/responsive-a11y.spec.ts` 42 passed.
  - Lane tier `T9AR.23-S7-B1`: unit 2451, integration 286, checks 14 of 14.
  - **ocr** on `8ef228d8` (`ocr/T9AR.23-S7-B1-8ef228d8.json`): 2 files, 1 comment.
    - **T9AR.23-S7-B2** (Valid, latent; `corridor-pnl.tsx:310`): the unanchored weekday regex turns an `endLabel` of another shape ("Fri Nov 20") into "Fri 20". Deriving words in the component also goes against ADR 0001. Briefed in lane PL: `plot.props.ts` supplies the three finished forms and the component only picks one.
    - Reviewer's notes: the narrowest form clears down to about 185 px (the minimum is 200), and the shortened label is visual only (the chart's accessible name carries no expiry).
- **T9AR.23-S7-B2** `443fe39c` (lane PL):
  - Fix: `plot.props.ts`'s new `expiresLabels` builds `axis.endLabels` (the three finished forms) from the date. `corridor-pnl.tsx` has no regex; it draws the first form that clears the start label, and none if none clears, so a label is never drawn over another (A280).
  - The type: `ReplayPlotProps['axis']` drops `endLabel` and gains `endLabels`.
  - Cases:
    - "supply the option end label as three finished forms, longest first": red `expected undefined to deeply equal …`, then green.
    - "draw the first end label form that clears the first date, unchanged, whatever shape": red TypeError, then green.
    - **First-run passes, flagged:**
      - "no end label forms on a stock Trade". Mutation: `endLabels: []` failed.
      - "no end label when even the shortest cannot clear". Mutation: fall back to the last form failed.
  - Existing lines changed (input or prop name only): `corridor.test.tsx` 8; `plot.props.test.ts` 2 expected `axis` values; `price-strip.test.tsx` 4; `frame.test.tsx` 1. The last two files were outside the brief but built the old prop.
  - Browser: `e2e/d9ar`, `e2e/d9/responsive-a11y.spec.ts` and `replay.spec.ts` 47 passed. Lane tier `T9AR.23-S7-B2`: unit 2455, integration 286, checks 14 of 14.
- **Lanes OV and PL** were rebased together onto `d93d6de8`:
  - S1 `d80b9f00`, S3 `91d99766`, S2 `30f73488`, test `a4ed6c9d`;
  - S7 `c7fd6f2c`, S7-B1 `998ee90f`, S7-B2 `206c4e0c`.
  - Lane tier rerun `T9AR.23-OVPL-r`.
  - **ocr** on `206c4e0c` (`ocr/T9AR.23-S7-B2-206c4e0c.json`): 7 files, **no findings**.
    - Reviewer's notes:
      - The date formatting matches `shortDate`, in UTC.
      - No reader of the old `endLabel` is left.
      - "No end label" cannot happen at 200 px or wider.
      - The "trading days" comment in `plot.props.ts` now sits above `expiresLabels`.
    - The frozen plan's lookup rows (the time-axis row in section 1.5, and the index) still name `endLabel`. That is a lookup miss to record, not a revision.
  - Lane tier rerun `T9AR.23-OVPL-r`: unit 2455, integration 286, checks 14 of 14. Run complete.
  - **Merged** by fast-forward; main is at `206c4e0c`. **T9AR.23 is Done.** Next: the merge run `merge6`, then `acceptance-commands.sh` (T9AR.22's four browser rows now have their specs), then the full tier and the gate T9AR.24.

## Merge run merge6 (full tier, `dbafc601`)

- Unit 2455, integration 286, checks 14 of 14. browser-1: 126 passed (5.0m). browser-2: 79 passed (4.7m).
- **browser-3: 124 passed, 1 failed (7.0m)**, so it stays under 8 minutes.
  - The failure: `e2e/d9/gaps.spec.ts:94` (B9.2), "the grid fits" at 1280 on R-DALE-D Fri 11-13. `.replay-stake-grid` runs past the viewport.
  - Likely cause: T9AR.23-S1's 340 px readout column, as its ocr reviewer predicted.
- The suite-runner's final report was refused by the harness (one report per agent), so these results were read from the run files.
- **merge6-S1** `1538b776` (lane OV, from `dbafc601`):
  - The wide readout column is `fit-content(480px)`, and from 861 px up the body's side padding is 8 px.
  - Red: `gaps.spec.ts:94` "the grid fits" on R-DALE-D. Green: it passes.
  - Measured: R-DALE-D's grid is 402 px and R-BREN-U Mon 11-02's is 438.
  - Browser: `e2e/d9ar` and `e2e/d9` `gaps`, `responsive-a11y` and `replay`: 61 passed. Lane tier `merge6-S1`: unit 2455, integration 286, checks 14 of 14.
  - **Sent back, not accepted:**
    - By the agent's own estimate the P&L chart at R-BREN-U Mon 11-02 is about 771 px. B9AR.7 expects at least 800 at 1280, and the test passed only because it measures Mon 11-16.
    - The `fit-content` column also changes the chart's width as the slider moves.
    - The agent continues in lane OV with a follow-up: one column width at every session, every grid fitting it, the chart at 800 or more at every session. If that can't be done, it stops and reports for a user decision.
  - **Follow-up** `87555266`, measured on every session of the five Trades at 1280:
    - Red against `1538b776`: the widest grid was 473 px (AXIO Mon 11-09) and the narrowest chart 736 px. Under `fit-content` the "Past the Stop by …" sentence counted at its unwrapped width.
    - Each grid's real minimum with figures on one line: BREN 310, CORV 324, AXIO 327, DALE 367.3 px.
    - Fix: the readout column is a fixed 372 px. From 861 px up only (`replay-readout.css`, lane RO, idle, allowed by the brief): the stake grid's cell left padding is 6 px and the stake group's right padding 0.
    - Green: on every session the grid is 372 px with no overflow and the P&L chart 837 px; neither moves with the slider.
    - The throwaway measuring spec was deleted, because lane OV owns no e2e file. **No permanent case measures the chart's width at every session**; noted for the gate critic.
    - Browser: 61 passed. Lane tier `merge6-S1b`: unit 2455, integration 286, checks 14 of 14.
    - Agent's note: between 861 and about 1100 px the fixed column leaves the chart narrower than before; no case measures it.
  - **ocr** on `dbafc601..87555266` (`ocr/merge6-S1-87555266.json`): 2 files, **no findings**.
    - Reviewer's notes, for the gate critic:
      - The breakpoints match at 860/861.
      - `padding-right: 0` on the stake group changes nothing.
      - Only about 5 px of headroom over the grid's minimum, which depends on the font, with no committed guard.
      - The "(Plan …)" and other rows wrap and cannot overflow.
      - From 861 to 1100 px the chart is about 418 to 657 px, which is untested.
      - The 6 px cell gap matches the phone rule.
  - **Merged:** rebased onto `668819de` (evidence only, so no rerun) and fast-forwarded. merge6-S1 is `2882fee8`, its follow-up `c614cd64`.
  - **merge6-S1-D1** briefed in lane BR (re-pointed to main `c614cd64`; its old commits were all on main): a committed case stepping all five Trades at 1280 that guards the chart width, the stable layout and the grid fitting its column.
  - **merge6-S1-D1** `409113f9` (lane BR):
    - The case "should keep the P&L chart 800 wide and still, and each stake grid inside the readout, at every session of …" runs as two tests: R-BREN-U, R-AXIO-D, R-CORV-D and R-DALE-D in one Review, and R-DALE-U held, alone. Two DALE Trades can't share a Review, because the builder finds Marks panels by symbol.
    - Not covered: R-DALE-D with its Expiration recorded. The Review builder records only partial sales.
    - A **first-run pass, flagged** (the fix was already merged). Bite: the readout column at 480 px failed both tests, "the P&L chart is 729 wide … Expected: >= 800". Restored, and `git diff -- src` is empty.
    - Time: 9.6s for both tests. `e2e/d9ar` 47 passed in 2.0m. Lane tier `merge6-S1-D1`: unit 2455, integration 286, checks 14 of 14.
    - **ocr** on `409113f9` (`ocr/merge6-S1-D1-409113f9.json`): **no findings**.
      - Reviewer's notes, for the gate critic:
        - The session count comes from the slider's `max`, but the expected count is never asserted.
        - The dialog's name is not checked against the Trade.
        - The stake-grid loop would pass on zero grids.
        - There is a stray whitespace edit on `INTENT`.
    - **Merged:** rebased onto `18cd5aae` (evidence only) and fast-forwarded. Next is the full run `merge7` before the gate.

## Full run merge7 (full tier, `3e92c98f`)

- Unit 2455, integration 286, browser-1 126 (5.0m), browser-2 79 (4.7m), browser-3 127 (7.1m), checks 14 of 14. **No failures**, no flaky case. Run complete.
- The run rewrote the `e2e/d9ar` screenshots, which are committed as this run's.
- `acceptance-commands.sh plan/D09A-R-stage-a-refactor.md`: **7 commands checked, 0 failed.** T9AR.22's four browser rows now name their specs.

## T9AR.24 Gate

- In progress from `3e92c98f`. Critic-1 is briefed from `.claude/docs/critic-brief.md`, with section 8's flows C9AR.1, C9AR.2, C9AR.3, C9AR.4, C9AR.5, C9AR.6 and C9AR.7.
- P151: if three critics leave only moderate or lower defects, the gate closes with tech debt items.

| Critic | Brief | Tokens | Tool calls | Duration | Defects |
|---|---|---|---|---|---|
| critic-1 | `critic-brief.md`, section 8's flows, coach review 1's 15 points to recheck, `words-changed.md` and `new-words.md` named | 284,147 | 98 | 16 min 21 s | yes (5 high, 2 moderate, 2 low) |

- **critic-1** (`critic-1.md`), at `38978773`: **FAIL**.
  - Passed: C9AR.1, C9AR.4 and C9AR.6. Failed: C9AR.2, C9AR.3, C9AR.5 and C9AR.7.
  - Coach points: fixed except 1 (figures broken), 12 (No Mark said twice) and a gap in 3 (the key). Critic-2's carried defect 2 is not fixed.
  - Every defect becomes a bug task, run one at a time, failing test first:
    - **T9AR.24-B1** (high): the session cards break figures and part minus signs from their numbers. At 1280 DALE's narrow two-column cards read "hit –" / "$33,936.00"; the same at 1440 and 320. Lane SC.
    - **T9AR.24-B2** (high): the readout's past-a-line row parts the sign ("· at Stop –" / "$1,536.00" at 1280, 1440 and 1920), and so does the overlay header at 320 ("DALE · TRADE P&L –" / "$2,088.00").
    - **T9AR.24-B3** (high): on a Review card a started Action (Exit plus an Intent) is lost after Replay, Price History, then "Back to the Review". Save then stores Hold with "Unanswered".
    - **T9AR.24-B4** (high): a missing Mark is said twice. The top line says it, and the readout's Trade P&L row repeats "Mark missing: …" in italics instead of the dash (W61, A281).
    - **T9AR.24-B5** (high): on a phone, opening Replay from a Review card shows a stale hover box ("Mon Nov 9 · …") that a tap does not clear. At 320 a grey hover band covers the slider's value on DALE.
    - **T9AR.24-B6** (moderate): AXIO's P&L chart at 1280 and 1440 draws the stake bar and the past-the-Stop hatch without their labels, and the key never names the hatch or the bar on any Trade (A280, W66).
    - **T9AR.24-B7** (moderate): AXIO's "Stop breached" flag shows only on Mon Nov 9, not on later sessions (T9AR.19's case, W64).
    - **T9AR.24-B8** (low): the key wraps at 1280 on BREN. "No Mark" has a line swatch for a shaded column. DALE-U after expiry lists "Execution" where only "Expired" is drawn.
    - **T9AR.24-B9** (low): the Review overlay's "Price History" link is 23 px high on a phone; Trade Detail's is a 46 px button.
  - **T9AR.24-B1** `e1f276da` (lane SC, from `69cb4360`). Two causes:
    - a minus sign broke from its `$`;
    - the app-wide `dl` grid put each card's rows in two columns of about 87 px. The cards themselves were 265 px at 1280.
    - Fix:
      - `figureParts(text)` in `cards.props.ts` splits the worded text into word and figure parts;
      - `session-cards.tsx` draws each figure in a nowrap `card-figure` span;
      - `.replay-session-card dl { display: block }`.
    - Unit case "split a card text into words and figures …". The first red was a TypeError, which is not valid, so a stub gave the red `expected [ Array(1) ] to deeply equal …`; then green.
    - E2e "keep every figure on a session card on one line … at 1280, 1440, 375 and 320", run for DALE-hold, AXIO and BREN: red, 3 failed; green, 3 passed.
    - Line changed: `session-cards.test.tsx:136` reads the Past line's `textContent`, with the same expected text.
    - Browser: 62 passed. Lane tier `T9AR.24-B1`: unit 2456, integration 286, checks 14 of 14. Sent to ocr.
    - Agent's note: the readout and the Plan block still use breakable text. That is B2's part for the readout.
    - **ocr** on `e1f276da` (`ocr/T9AR.24-B1-e1f276da.json`): 6 files, 1 comment.
      - **T9AR.24-B1-B1** (Valid, `cards.props.ts:19`): the percentage pattern misses W60's edge odds, "under 1% : over 99%". The e2e check copies the same pattern, so it cannot catch the miss. Briefed in lane SC.
      - Reviewer's notes:
        - A screen reader still reads each row as one sentence.
        - The `dl` override is scoped to the cards.
        - Re-parsing finished text has to mirror every formatter (typed parts, or glue in the formatters, would hold longer).
        - 1920 and CORV are not covered by the e2e case.
    - **T9AR.24-B1-B1** `a916ebc1` (lane SC):
      - Case "keep each edge odds pair … as one figure part": red, then green. Fix: the edge pairs are added to `figureParts`'s pattern; reading the formatters found no other form missed.
      - The e2e check no longer copies the code's pattern. It measures every `.card-figure`, and flags text outside one that holds a stray figure mark (its own loose pattern). Bite: breaking the percent-pair pattern failed 3 of 3 ("unmarked figure in "about 8% : 92%"").
      - No fixture shows edge odds in the browser, so the unit case is the proof for them.
      - Browser: 7 passed. Lane tier `T9AR.24-B1-B1`: unit 2457, integration 286, checks 14 of 14.
      - **ocr** on `a916ebc1` (`ocr/T9AR.24-B1-B1-a916ebc1.json`): **no findings**.
        - Reviewer's notes: the loose pattern gave no false failures on card words and catches a parted sign; a plain pair cannot swallow the edge pair.
        - Watch item: "63% of the way" in the status line would fail the check if it ever reached a card.
      - **Merged** B1 and B1-B1 by fast-forward (lane SC's base `69cb4360` was main's head). The quick run is folded into the full run after the last fix, since each fix's lane tier and browser files already ran.
  - **T9AR.24-B2** `85c8f95c` (lane RO, from `b443b4c3`):
    - `figureParts` moved to `figure-parts.ts` (`cards.props.ts` re-exports it).
    - A shared `Words` component (`figure-words.tsx`) draws each figure in a nowrap `card-figure` span. It is used by:
      - the session cards;
      - the readout's past-a-line row and its rows (ratio, odds, change line);
      - the overlay's header.
    - Stake-grid cells stay plain; their CSS already keeps each cell whole.
    - Cases:
      - "draw every figure of the past-a-line row, the rows and the change line as one unbreakable piece with its sign": red `$552.00: expected [] to include '$552.00'`, then green. It was renamed after the red.
      - "keep the header's figure as one unbreakable piece with its sign": red `expected [] to deeply equal [ '−$2,088.00' ]`, then green.
      - E2e "keep every figure in the readout and the header on one line … at 1280, 1440, 1920, 375 and 320", run on DALE-hold Mon Nov 16, AXIO Mon Nov 16 and DALE-hold Thu Nov 12, with an independent loose pattern: red, 3 failed ("unmarked figure in "down $1.10 since Fri Nov 13""); green, 3 passed.
    - The red was taken with the fix stashed. The shared stash list holds no entry from this session afterwards.
    - No existing expected value changed.
    - Browser: `e2e/d9ar` plus `e2e/d9` `gaps`, `replay` and `responsive-a11y`: 69 passed, with the 320 fit holding. Lane tier `T9AR.24-B2`: unit 2459, integration 286, checks 14 of 14.
    - **ocr** on `85c8f95c` (`ocr/T9AR.24-B2-85c8f95c.json`): 9 files, 1 comment.
      - **T9AR.24-B2-F1** (Valid, maintainability, `readout.tsx:11`): a nested ternary. Done as `096c855b`:
        - three early returns with the same output;
        - replay tests 230 green and unchanged;
        - lane tier unit 2459, integration 286, checks 14 of 14;
        - ocr (`ocr/T9AR.24-B2-F1-096c855b.json`): **no findings**.
      - **Merged:** rebased onto `bc683ada` (evidence and plan only) and fast-forwarded. B2 is `825dd738`, F1 `c354ff33`.
  - **T9AR.24-B3** `53ba488a` (lane RW, from `18d54158`):
    - **Cause:** the Action form's values lived only in its own state. The Price History link leaves `/review`, so the Review unmounts and "Back to the Review" reads it afresh.
    - **Fix:**
      - a new in-memory holder, `src/ui/screens/action-draft.ts`;
      - `ActionForm.tsx` reports its draft, and starts from a set-aside draft for the same Review date and Trade;
      - `ReviewCard.tsx`'s Price History link sets drafts aside on click;
      - `ReviewView.tsx` discards a set-aside draft when the address lacks `replay=open`.
      - The trip itself records nothing.
    - **Cases:**
      - E2e "restore a started Action on each card after the Price History round trip, and save exactly it with one press" (BREN, then AXIO): red, Exit unchecked; then green.
      - Unit "keep a started Action when the Review is left for Price History …": red, then green.
      - Unit "not bring a started Action back when the Review was left some other way": a **first-run pass, flagged**. Mutation: set aside on every report, with the discard disabled; it failed. Restored.
    - **Lines changed:** `ActionForm.tsx`'s five `useState` initialisers read the started draft first, and a reporting effect is added.
    - **Limit:** a full reload on the way back loses the draft (in memory).
    - **Browser:**
      - `e2e/d9ar/review.spec.ts`: 3 passed.
      - Review specs in `e2e/d9`, `e2e/d7` and `e2e/d4`: 14 passed.
      - Not run: the other `e2e/d7` and `e2e/d4` Review specs. The full run after the last fix covers them.
    - **Lane tier** `T9AR.24-B3`: unit 2461, integration 286, checks 14 of 14.
    - **ocr** on `53ba488a` (`ocr/T9AR.24-B3-53ba488a.json`): 6 files, 3 comments. All three became tasks, briefed in lane RW:
      - **T9AR.24-B3-B1** (Valid, `ReviewCard.tsx:406`): a Ctrl or Cmd click on Price History sets drafts aside while the Review stays mounted, so a stale snapshot can return after a Save.
      - **T9AR.24-B3-B2** (Valid, `ActionForm.tsx:93`): after a round trip, Forward then Back loses the started Action, because only the click makes a snapshot.
      - **T9AR.24-B3-F1** (Valid, maintainability, `ReviewView.tsx:269`): a module-level map is cleared during render.
    - Reviewer's notes:
      - No leak to the wrong card, Trade or date.
      - One card at a time still holds.
      - No reporting loop.
      - The holder has no test reset, so order dependence between tests is possible.
    - **T9AR.24-B3-B1 and B2** `3fc56da6`, one change:
      - The click handler is gone. A form that unmounts while the location is the Review's Price History page (`drawer=price-history` and `from=review`, read from the router's `UNSAFE_NavigationContext`) sets its draft aside.
      - A form takes the snapshot only on a `replay=open` address. `resetDrafts()` is called in `ReviewCard.test.tsx`'s `beforeEach`.
      - B1's case, "show the saved Action, not an earlier draft, after a Ctrl click on Price History, a Save, and a switch to another card and back": the first red was a test fault, then a valid red (the stale draft's textarea present), then green.
      - B2's e2e case, "keep a started Action when the browser goes Forward to Price History and Back again after a round trip": a **first-run pass, flagged**, since B1's change covers it. Mutation: `from === 'review'` changed to `'nope'` failed ("after the round trip: Exit"). Restored.
    - **T9AR.24-B3-F1** `c0b48dad`: the clear runs in a mount effect keyed on a constant read from `replay=open`. Tests are unchanged.
    - Browser: `e2e/d9ar/review.spec.ts` and `e2e/d9/review.spec.ts` 6 passed; `e2e/d7/review-expiration` and `e2e/d4/review` 2 passed.
    - Lane tier `T9AR.24-B3-fixes`: unit 2462, integration 286, checks 14 of 14.
    - **ocr** on `53ba488a..c0b48dad` (`ocr/T9AR.24-B3-fixes-c0b48dad.json`): 6 files, 1 comment. This is round 2 of B3's bug tasks.
      - **T9AR.24-B3-B3** (Valid, low, test; `review.spec.ts:129-131`): the Forward-and-Back case does Back, then Forward, so the leg its title names is not exercised. Briefed in lane RW.
      - Reviewer's notes, for the final report:
        - `UNSAFE_NavigationContext.navigator.location` works with `BrowserRouter` and `MemoryRouter`. Under a data router (`createBrowserRouter`) it is undefined, and the draft's survival would stop silently. Nothing uses data mode today.
        - Cleanup order is safe.
        - No wrong restore was found; drafts are keyed by date and Trade.
        - The mount effect cannot clear a draft the same mount reads.
    - **T9AR.24-B3-B3** `50ba4feb` (test only; `git diff -- src` empty):
      - The case now goes: round trip by the links; browser Back twice to the first Review entry; Forward to Price History; Back to the Review; then asserts.
      - Bite: `'review'` changed to `'reviewX'` in `setDraftAsideOnTrip`. It failed at the first check, after the link round trip. One check serves both paths, so the new leg cannot fail alone. Restored.
      - Case: 1 passed. Lane tier `T9AR.24-B3-B3`: unit 2462, integration 286, checks 14 of 14.
      - **ocr** on `50ba4feb` (`ocr/T9AR.24-B3-B3-50ba4feb.json`, round 3 of B3's chain): **no findings**.
        - Reviewer's notes, for the final report:
          - The steps match the title, and the waits are right.
          - The bite fails before the new steps. Only a mutant that breaks the browser's Forward alone would prove those steps.
          - No choice-and-Intent check sits between the second Back and the Forward.
    - **Merged** B3, B3-B1 and B3-B2 (one commit), B3-F1 and B3-B3 by fast-forward. Lane RW's base `18d54158` was main's head.
  - **T9AR.24-B4** (lane RO, from `41423503`), first commit `ab9ff604`:
    - **Cause:** `goingGroup` in `readout.props.ts` gave the Trade P&L row the headline's reason ("Mark missing: CORV Nov 20 $80 Put, Tue Nov 10"). The top line already says "No Mark for the put on Tue Nov 10.", and that one is kept. The row now takes `NO_MARK`, the dash named "No Mark".
    - Cases, red then green:
      - unit, "show the dash named No Mark in the Trade P&L row, and say no Mark missing anywhere in the readout, R-CORV-D Tue 11-10";
      - e2e on R-CORV-D Tue Nov 10: the missing Mark is said once on the replay.
    - **Existing expected values changed:** these lines held the defect itself, and the main session accepted the change:
      - one line in `readout.props.test.ts` ("Mark missing: BREN …" became "No Mark");
      - `e2e/d9/gaps.spec.ts:40`, which failed after the fix.
    - The task was sent back to change `gaps.spec.ts:40` to the dash named "No Mark", correct a stale comment in `session-words.props.ts`, and amend the commit.
    - **Amended as `a7fe9d08`** (it replaces `ab9ff604`):
      - `gaps.spec.ts:40` now checks the img named "No Mark" holding "—". Its red was the earlier failing run, and it is now green.
      - The comment is corrected.
      - Browser: `e2e/d9ar` plus `e2e/d9` `replay`, `gaps` and `responsive-a11y`: 72 passed.
      - Lane tier `T9AR.24-B4`: unit 2463, integration 286, checks 14 of 14.
    - **ocr** on `a7fe9d08` (`ocr/T9AR.24-B4-a7fe9d08.json`): 5 files, 1 comment.
      - **T9AR.24-B4-B1** (Doubtful, `readout.props.ts:66`): every non-value reason gets the dash named "No Mark", so an AwaitingClose or SettlementDue session would be named wrongly. It is unreachable on the replay today. Briefed in lane RO.
      - Reviewer's notes, for the final report:
        - The top line words every reason once.
        - The Review card summary (`CardFigures.tsx`) is unaffected.
        - The new cases cover only an option's missing Mark. Nothing asserts the readout row for Acknowledged unavailable.
        - The Journal drawer's session card titles a no-Mark session "Mark missing: …" (`journal.props.ts:174`). That is a separate surface, outside this deliverable's fix.
    - **T9AR.24-B4-B1** `a242cc63`:
      - The dash named "No Mark" is shown only when `isMarkLacking` holds or the Mark is Acknowledged unavailable. Other reasons keep their pre-B4 words. A direct reason-code comparison was rejected by `verify:wording`, so the code uses the existing helper.
      - Cases:
        - "keep the reason words, not the dash named No Mark … AwaitingClose": red, then green.
        - "show the dash named No Mark … Acknowledged unavailable": a **first-run pass, flagged**. Mutation: the Acknowledged clause was removed, and the case failed. Restored.
      - Lane tier `T9AR.24-B4-B1`: unit 2465, integration 286, checks 14 of 14.
      - **ocr** on `a242cc63` (`ocr/T9AR.24-B4-B1-a242cc63.json`): 2 files, 1 comment.
        - **T9AR.24-B4-B1-F1** (Valid, maintainability, `readout.props.ts:70`): a nested ternary. Done as `bcc2a893`:
          - a local `tradePnlValue()` with early returns, giving the same output;
          - replay tests: 233 green, none changed;
          - lane tier: unit 2465, integration 286, checks 14 of 14;
          - main's checkout was untouched;
          - ocr (`ocr/T9AR.24-B4-B1-F1-bcc2a893.json`): **no findings**.
    - **Merged** B4, B4-B1 and B4-B1-F1 by fast-forward. Lane RO's base `41423503` was main's head.
  - **T9AR.24-B5** `da8dcb7e` (lane PL, from `b65d25be`):
    - **Cause:** confirmed by logging pointer events.
      - The tap on the Review card's "Replay" opens the chart under the finger.
      - Chromium then sends a mouse-type `pointerenter` to the session button there ("Mon Nov 2" at 320). The handler ignored only touch and pen, so this became a hover, drawing the box and the band.
      - Taps then never cleared it, because no mouse leave arrives. The `tapped` ref was not involved.
    - **Fix:** `corridor.tsx` records touch and pen `pointerdown` times in a document listener installed at module load. A mouse `pointerenter` within 1000 ms of one is not a hover.
    - **Cases:**
      - Unit, "not report the mouse pointerenter a browser sends under a finger just after a touch": red, then green.
      - E2e at 320 from the Review card, no box or band on open or after two taps: red ("Expected: 0, Received: 1"), then green.
      - The 375 case and the DALE-from-Detail case at 320 are **first-run passes, flagged**. Neither could be reproduced, and a never-blocking mutation left both passing. They are kept as guards and do not detect the defect.
    - **Lines changed:** one `onPointerEnter` condition. No expected values changed.
    - **Browser:** `e2e/d9ar` plus `e2e/d9/replay.spec.ts`: 64 passed, including the 320 fit and the mouse hover cases.
    - **Lane tier** `T9AR.24-B5`: unit 2466, integration 286, checks 14 of 14.
    - **Agent's notes:**
      - The 1000 ms window is a heuristic. A real mouse within 1 s of a touch, on a hybrid device, is ignored until it re-enters.
      - A hover set some other way is still not cleared by a tap.
    - **ocr** on `da8dcb7e` (`ocr/T9AR.24-B5-da8dcb7e.json`): **no findings**.
      - Reviewer's notes:
        - The module-load listener is safe for server rendering and sees every tap.
        - A held hover is never cleared by a tap.
        - The 1000 ms window fails if the chart appears over 1 s after the tap.
        - The DALE case's title implies more than it checks.
        - The timestamp is shared between tests.
        - The unit case has no boundary.
    - **Sent back as B5 part 2** by the main session. This is not a bug task from the notes. B5 did not yet meet its own defect's expected behaviour (C9AR.7, "A tap … leaves no hover box behind"), and the critic saw taps fail to clear the box. The brief:
      - a tap clears any held hover;
      - a gate against the synthetic enter that does not depend on a delay, if a simple one holds;
      - boundary cases;
      - the DALE case renamed;
      - a test reset.
    - **B5 part 2** `0f1f4935`:
      - A probe showed Chromium's synthetic hover sends `pointerover` and `pointerenter` with no `pointermove`. So a mouse now hovers only from its first real `pointermove`. The 1000 ms window and its module timestamp are removed, so no test reset is needed.
      - A touch or pen `pointerdown` on a session clears a held hover. It does so only when one is held, because clearing every time broke two existing cases.
      - Cases, red then green:
        - "clear a mouse hover when a touch or pen taps a session";
        - "report a mouse hover only from a real pointermove, not from the pointerenter alone, at any time after a touch".
        - No first-run passes.
      - Lines changed:
        - one existing unit case now fires a `pointerMove` after the enter, with its expected `[2]` unchanged;
        - the DALE case is renamed to "leave the slider's value uncovered by any chart element for DALE from Trade Detail at 320". The tdd-log notes the critic's band did not reproduce.
      - The tap-clears path has no e2e case (a touch context has no mouse); the unit case covers it.
      - Browser: 64 passed. Lane tier `T9AR.24-B5-part2`: unit 2467, integration 286, checks 14 of 14.
      - **ocr** on `0f1f4935` (`ocr/T9AR.24-B5-part2-0f1f4935.json`): **no findings**.
        - Reviewer's notes, for the final report:
          - Wide-screen mouse hover works through `pointermove`.
          - A mouse resting on a session when the chart opens shows no hover until it moves.
          - A touch outside the session columns does not clear a mouse hover, which can only happen on a hybrid device.
          - The rule rests on the Chromium probe. Firefox and WebKit are unverified.
    - **Merged** B5's two commits by fast-forward. Lane PL's base `b65d25be` was main's head.
  - **T9AR.24-B6** `74294bbe` (lane PL, from `14982570`):
    - **Cause:**
      - The stake bar and the hatch at the cursor were drawn whether or not their label fitted.
      - At the last session the centred "past" label ran off the right edge.
      - The key had no entries for the hatch or the bar.
    - **Fix:**
      - The "past" label gets two spots ending at the cursor on the last session, so AXIO Mon Nov 16 shows "$300 past the Stop" at 1280 and 1440.
      - A bar or hatch at the cursor is drawn only with its label. On a phone its label goes to the strip.
      - The key names "Past the Stop", "Past the Target" and "At stake" (W66) while each is drawn, on every Trade.
      - On AXIO Mon Nov 16 the "Remaining Reward $1,200" bar has no room and is dropped. The readout keeps both figures (P148), and the e2e asserts them.
    - **Cases**, all red then green:
      - unit: three, covering drawing only with its label and the key, "Past the Stop" in the key, and the past label at the right edge;
      - e2e: AXIO at 1280 and 1440, and BREN's key.
      - No first-run passes. No expected values changed.
    - **Files outside the brief's list**, accepted: `replay.types.ts` (the key's `PlotKeyEntry` union gains three kinds) and `replay-plot.css` (key swatches). Both are lane PL's chart and key files.
    - **New words:** none. The key entries are W66's.
    - **Defect 8:** the key gains up to two short entries and was not measured at 1280. B8 takes it.
    - Browser: 72 passed, with the 320 fit holding. Lane tier `T9AR.24-B6`: unit 2470, integration 286, checks 14 of 14.
    - **ocr** on `74294bbe` (`ocr/T9AR.24-B6-74294bbe.json`): **no findings**.
      - Reviewer's notes, for the final report:
        - The key and the drawing come from one set, so they agree.
        - A cursor session's hatch with no room for its label is dropped while the slider is on it, and drawn once the slider moves on. This is intended, but visible while dragging.
        - Earlier sessions' hatches are unlabelled areas, and the key names them. A280 speaks of lines.
        - The three key words are hardcoded in `corridor.tsx`'s `DRAWN_AREAS`, not in `plot.props.ts` like the other key entries.
    - **Merged** by fast-forward. Lane PL's base `14982570` was main's head.
        - Reviewer's notes:
          - `isMarkLacking` is exactly MarkMissing or AcknowledgedUnavailable.
          - The Trade P&L row's figure is the contract's own, so the Underlying's Mark cannot reach it.
          - No reason falls to the wrong branch.
          - The `reason ?? ''` fallback cannot run.
      - Reviewer's notes:
        - `card-figure` is a global rule, loaded app-wide, so it holds in the overlay. Its name ties it to the cards' stylesheet.
        - The dialog's name and the header's text are unchanged.
        - The No Mark dash and the odds keep their `role="img"` labels.
        - The change line and the Plan comparison read the same.
  - Minor observations, for the final report:
    - A final session's headline has no R.
    - "up $0.00 since Thu Nov 19" on the expired DALE-U.
    - Focus lands on `<body>` after the Review's Price History.
    - Each hit button is its own tab stop.
    - The cursor crosses "Stop breached" and "No Mark" on non-entry sessions.
    - DALE's Max reward label sits far from its segment.
    - At 320 the cursor's date is dropped.
    - Some wraps keep each figure whole.
    - The header is in uppercase.
    - The Review summary reads "+3.05R" where the replay reads "3.05R".
- **merge6-S1** briefed in lane OV. The branch `d09ar/ov` was re-pointed to main `dbafc601` first: its old pre-rebase commits were all on main under their new hashes (`git cherry`). The case's red is the run itself.
- **Part 1 notes:**
  - The Detail overlay's slider session does not survive a reload (the address holds only `replay=open`; the plan does not ask that it survive).
  - The Review card reopens on its last session.
  - `expectClearOfCursor` leaves out the cursor's own labels.
  - The card's Trade P&L reads "+$988.00 · +3.05R".

## T9AR.20 Review card: the summary in the replay's words

Lane RW (`d09ar/rw`), base `3cb51638`, commit `50ef6d4a`.

- **Cases:** all 6 planned cases in `CardFigures.test.tsx` went red then green. The A287 `title` had been written ahead of red; it was backed out for a genuine red, then restored. No first-run pass. Titles dropped quotes, `$` and `%`.
- **Lines changed (section 1.5's last two Texts rows):** `CardFigures.test.tsx` (the three older cases); `ReviewCard.test.tsx` 174-176, 201-208, 229-234, 247-248; `ReviewCards.test.tsx` 330, 640; `e2e/d4/review.spec.ts` 46-49; `e2e/d5r/review.spec.ts` 27-28; `e2e/d7sp/review-dated-line.spec.ts` 33.
- **`CardMarks.test.tsx` 270 and 287** were also changed: "Current Marked Trade P&L" became "Trade P&L". Section 1.5 lists this file under Stays, but these two lines assert the card's own summary, so W70 renames them. Accepted as a lookup miss in section 1.5 (the approved word applied, nothing else changed).
- **API in `stake-words.props.ts` (lane RO idle):**
  - `ratioWordsOf(now, odds, planColumn)`; `ratioWords` delegates to it, with its tests unchanged.
  - `pastLineWords(role, pastBy)`. `readout.props.ts`'s `pastLineRow` still has its own copy of the sentence; lane SC owns that file during T9AR.17.
- **Choices:**
  - The Remote weight is an inline style plus `data-weight` (no stylesheet in the lane).
  - The past-a-line row's label is the group heading ("Current Risk" or "Remaining Reward"), with the Overrun term as its title.
  - With no current ratio, the row reads "<reason> (Plan 2.40 to 1)", so the Plan's ratio stays on the card (P148).
  - No odds note on the card.
- **Words:** W56, W59, W60 and W70 as written; none shortened. Uncovered: the past-a-line row's heading-only labels, and the "(Plan …)" suffix after a reason (in `new-words.md`).
- **Tests:** checks exit 0. Lane tier `T9AR.20`: unit 2416, integration 286, checks 14 of 14.
- **Browser:** `e2e/d7sp/review-dated-line.spec.ts` passed. `e2e/d4/review.spec.ts` and the first case of `e2e/d5r/review.spec.ts` **failed against a stale `dist-releases/current`**: the agent's `npm run build:releases` was **denied by the permission classifier**. The main session does not rerun a denied command for an agent. These specs are left to the next merge run's browser tier, and the denial is reported to the user.
- **ocr** on `50ef6d4a` (`ocr/T9AR.20-50ef6d4a.json`): 9 files (5 excluded), 1 comment, Valid (maintainability).
  - **T9AR.20-F1**: `readout.props.ts:77`'s `pastLineRow` builds its own copy of the "Past the … by" sentence instead of calling `pastLineWords`, so a wording change would not reach the card.
  - `readout.props.ts` is in use by T9AR.17 (lane SC), so F1 goes to lane SC after T9AR.17, once lane RW has merged.
- **Reviewer's notes, not findings (for the final report):**
  - The card drops Reward to risk only past a line, while the replay also drops it when a condition is crossed but the dollar amount is not passed. The two can differ.
  - The card keeps the row as "<reason> (Plan …)" where the replay hides it.
  - The Remote weight is an inline style: a stylesheet rule on `[data-weight='Remote']` would keep the two screens' looks together.
  - `RewardToRisk` splits the built string at " · ", like T9AR.15-B1.
  - No odds note on the card.
- Rebased onto `4926687a`: `c20b4c28`. Lane tier rerun `T9AR.20-rebased`: unit 2416, integration 286, checks 14 of 14; `run-complete.sh`: run complete. Merged by fast-forward to `c20b4c28`.

## T9AR.19 Chart: a first crossing

Lane PL (`d09ar/pl`), base `c2882ae0`, commit `e11d5fb9`. Case 1 in two files under its planned name: `corridor.test.tsx` (red `slider 4: expected [] to have a length of 1 but got +0`) and `plot.props.test.ts` (red `expected [ undefined, undefined, undefined ] to deeply equal [ undefined, …(2) ]`); case 2 red `expected [ 'Target reached' ] to deeply equal []` (the key named a flag not drawn). All green; no first-run pass.

- The flag's session is the view's `crossings.<role>.first.date` (ADR 0001); a pole and pennant on the P&L chart at that session's At Stop or At Target level; it shows from its session on (P145). The key names it only when drawn; on a phone its words go to the strip through `put()`. W64's and W66's words; none shortened or uncovered. A session whose Stop and Target are both first crossed would get only the Stop flag (judged impossible for one Position). The price chart draws no flag.
- No existing test or `e2e` line changed; no browser run (no spec changed). The flag can add one line to the phone strip on a flagged session: B9.5's fit check and the strip lines of `e2e/d9/responsive-a11y.spec.ts` are for the next merge run.
- Lane tier `T9AR.19`: integration 280, checks 14 of 14, **unit 1 failed of 2382**: `src/ui/screens/TradeList.test.tsx` (the Open list's Ready state, `marks('tj:open-list-ready')` expected 2, got 1), tech debt item 11's **known flaky case** (P138); it passed alone (36 of 36). Logged as a flake in this run; the lane's rerun at merge is the tier of record.
- ocr on `e11d5fb9` (`ocr/T9AR.19-e11d5fb9.json`): 6 files (5 excluded), 3 comments, all **Valid**, made bug tasks:
  - **T9AR.19-B1** (`plot.props.ts:60`): a Stop and a Target first crossed on the same session keep only the Stop's flag.
  - **T9AR.19-B2** (`corridor-pnl.tsx:327`): the key names both flags when only one was placed (W66).
  - **T9AR.19-B3** (`corridor-pnl.tsx:228`): a first crossing on a session with no Trade P&L draws no flag, strip words or key entry, and never returns.
  - Briefed together in lane PL, one commit each.
    - `cec3a469`: T9AR.19's own checks log, committed separately.
    - **B2** `b96ebcd0`: "should name in the key only the flags that are drawn, each by its own words".
      - Red: `expected ['Stop breached'], got ['Target reached','Stop breached']`; then green.
      - `DrawnChart.crossingLabels`; `keyOf` takes a flag only when its label was drawn.
    - **B3** `7c792801`: "should still flag a first crossing on a session with no Trade P&L, at the line's own level or at the top of the plot, and name it in the key and the phone's strip".
      - Red: `expected [] to have a length of 1 but got +0`; then green.
      - The flag stands at the line's level, or at the plot's top, with nothing joined across the gap.
      - The test does not check that the flag stays on later sessions.
    - `aa3e0019`: lane tier evidence `T9AR.19-B` (unit 2384, integration 280, checks 14 of 14).
    - No first-run pass.
    - **B1 stopped:** it needs `PlotSession.firstCrossing` in `replay.types.ts` (lane TY) to hold two flags. Lane TY is idle and fully merged, so the main session routed that one field to lane PL for B1; this is ownership routing, not a plan deviation. Briefed again at `aa3e0019`. B2 and B3 sent to ocr meanwhile.
    - ocr on `cec3a469..7c792801` (`ocr/T9AR.19-B2-B3-7c792801.json`): 4 files (2 excluded), 0 comments, **no findings**. Reviewer's note, not a finding: B3's test checks the flag's height only loosely (not that its pole stands on the Stop line, nor that the top-of-plot flag clears the title row).
    - **B1** `728d3279`: "should flag both the Stop and the Target on a session where both were first crossed, and name both in the key".
      - `plot.props.test.ts`: red was an assertion failure (`expected { Object (line, label) } to deeply equal [ … ]`); then green.
      - `corridor.test.tsx`: red was a runtime TypeError (`Cannot read properties of undefined (reading 'toLowerCase')`); then green.
      - No first-run pass.
      - `PlotSession.firstCrossing` (in `replay.types.ts`, routed from lane TY) is now a list: the Stop first, then the Target; it is absent when nothing was crossed. Label keys are now `crossing-<slot>-<line>`.
      - Existing lines changed shape only: 2 in `plot.props.test.ts` and 4 doubles in `corridor.test.tsx`, each wrapped in an array.
      - Lane tier `T9AR.19-B1`: unit 2386, integration 280, checks 14 of 14.
      - ocr on `728d3279` (`ocr/T9AR.19-B1-728d3279.json`): 5 files (5 excluded), 0 comments, **no findings**. Lane PL is ready; it merges after `merge4` finishes.
- **Merged.** Rebased onto `4179346d`:
  - `fdbfba3f` (T9AR.19);
  - `d8721c93` (the checks log);
  - `c406aab9` (B2);
  - `92933bb9` (B3);
  - `0cd03ba5` (the B lane tier);
  - `bd746e92` (B1).

  Lane tier rerun `T9AR.19-rebased`: unit 2403, integration 280, checks 14 of 14; `run-complete.sh`: run complete. Fast-forwarded to `bd746e92`. Lane IN was then rebased onto it and its tier rerun as `T9AR.22-rebased`.

## T9AR.22 Node integration suite

Lane IN (`d09ar/in`), base `7f095ba3`, commit `c487a1ed`. Tests only (structural). `tests/integration/d9ar/`:
- `support.ts`: re-exports D9's helpers.
- `plan-comparison.test.ts`: I9AR.1.
- `odds.test.ts`: I9AR.2.
- `capabilities.test.ts`: I9AR.3.
- `query-count.test.ts`: I9AR.4, equal to I9.6's tallies.
- `final.test.ts`: I9AR.5, two cases (K-sale; R-DALE-U Expired).

No case disagreed with the product; no `src/` or `tests/support/` change.

- `npm run test:integration`: 135 files, 286 tests passed.
- `acceptance-commands.sh plan/D09A-R-stage-a-refactor.md`: 7 commands checked, 4 failed. All 4 are browser rows whose specs T9AR.23 writes: `e2e/d9ar/states.spec.ts`, `review.spec.ts`, and `responsive-a11y.spec.ts` (twice), each "playwright --list exited 1, no tests". They are expected at this point, so this is not a pending decision; the script is rerun after T9AR.23. The node rows pass.
- Lane tier `T9AR.22`: unit 2377, integration 286, checks 14 of 14.
- ocr on `c487a1ed` (`ocr/T9AR.22-c487a1ed.json`): 6 files, 2 comments, both **Valid**, made bug tasks:
  - **T9AR.22-B1** (`odds.test.ts:40`): the loop over each session checks only odds that are a Value, so a session that lost its odds passes.
  - **T9AR.22-B2** (`final.test.ts:49-50`): the Expiration case compares the Plan column without checking its odds exist, and omits `atStop` and `atTarget` NotApplicable.
  - Briefed together in lane IN.
    - **B1** `250a3065`: every session of R-DALE-D (Mon 11-02 to Wed 11-11) and R-BREN-U (Mon 11-02 to Mon 11-16) asserted a Value with pinned whole percents summing to 100. R-AXIO-D Mon 11-09 to Mon 11-16 asserted `NotApplicable:NoOngoingRisk`. Check: the test's own reading of DALE Fri 11-06 made `undefined` failed with `dale 2026-11-06 odds kind: expected undefined to be 'Value'`.
      - The percents for sessions not in section 5's table come from the product's output; they agree with every session the table lists. R-BREN-U Thu 11-12 to Mon 11-16 read 100:0. Both points were put to ocr.
    - **B2** `90349135`: the Plan odds are asserted on both sides; `atStop` and `atTarget` are asserted `NotApplicable:NoRemainingPosition`. Check: Plan odds made `undefined` failed with `Error: no Plan odds`; `atStop`/`atTarget` were not checked separately.
    - Lane tier `T9AR.22-B`: unit 2377, integration 286, checks 14 of 14; run complete (files moved to main).
    - ocr on `c487a1ed..90349135` (`ocr/T9AR.22-B1-B2-90349135.json`): 2 files (2 excluded), 0 comments, **no findings**.
      - The reviewer recomputed every pinned percent by hand from the series Marks with A267's formula, and all match. DALE: (3.50 − put Mark) / 3.30. BREN: (call Mark − 0.80) / 3.20.
      - R-BREN-U's 100:0 on Thu 11-12, Fri 11-13 and Mon 11-16 follows from A267: risk is positive and reward to Target is $0 with an Overrun, so the ratio is the Value 0. The plan does not state this case.
      - **For the final report's open questions:** past the Target, the odds read "100% : 0%" rather than no odds. That is the plan's formula, not a deviation, so it is not a pending decision.
    - Lane IN is ready; it merges after `merge4` finishes.
- **Merged.** Rebased onto `bd746e92`; lane tier rerun `T9AR.22-rebased`: unit 2403, integration 286, checks 14 of 14; `run-complete.sh`: run complete. Rebased over the evidence-only `b44ecb4c` (no code between). Fast-forwarded: `eac257eb` (T9AR.22), `fc179b08` (B1), `b9eb87f9` (B2). Lane RO was then rebased onto it: `fde70be5` (T9AR.15) and `3cb51638` (B1), with its tier rerun as `T9AR.15-rebased`.
  - Reviewer's notes, not findings: I9AR.4's counts are copied from I9.6 rather than imported; I9AR.4 omits I9.6's read-order and no-narrative-store checks.

## T9AR.21 Remove the stake rows' change fields

Lane DM (`d09ar/dm`), base `bcab74c4`, commit `c414265f`. Verification: `grep -rnE "riskChange|rewardChange" tools src e2e tests .claude`: nothing; typecheck, tsc6, `lint:deps` exit 0, lint 0 errors (2 existing warnings); `npx vitest run src/domain/trade-analysis src/coordinators src/ui/cockpit/replay`: 876 passed (the query-count proofs included, no request list changed); `npm run test:integration -- d9/gaps`: 1 passed; `npm run verify:fixtures`: exit 0. Lane tier `T9AR.21`: unit 2371, integration 280, checks 14 of 14.

- Removed: the two fields, their last-figure trackers and `changeOf` with `LastFigure` (`replay-series.ts`); the two view-type fields (`replay-view.ts`).
- **Deleted cases** (`replay-series.test.ts`): "should give the change in Risk to stop since the previous session with the figure (R-BREN-U Mon 11-16: down 150.00 since 11-13)"; "should measure a change across a gap from the last session that had the figure (R-CORV-D Wed 11-11: since 11-09)".
- **Changed cases:** `replay-trade.test.ts` (the Bren replay's session figures case: two lines reading `sessions[10].riskChange` dropped, no new expected value); `tests/integration/d9/gaps.test.ts` (the gap case: the lines reading either field removed; Wednesday from Monday still asserted through `change`, 11-09, 261; two comments reworded); outside the listed hits, line-only: `view-doubles.props.ts` (two lines in `brenWed1111`), `readout.props.test.ts:245` (the two fields dropped from a spread object).
- ocr on `c414265f` (`ocr/T9AR.21-c414265f.json`): 7 files, 0 comments. **No findings.** Merge waits for lane TY's (its lane tier is running), then lane DM rebases once.
- Rebased onto `c2882ae0`: `cf79c748`. Lane tier rerun `T9AR.21-rebased`: unit 2377, integration 280, checks 14 of 14; `run-complete.sh`: run complete. Merged by fast-forward to `cf79c748`. Lane RO then rebased onto it (T9AR.14 cleanly; rerun as `T9AR.14-rebased`).

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
  - D1 done: `b5412945`; red `expected 136 to be 124`, green. **12 px was half a pixel short** in the browser (the Review card replay at 320: 589.42 against 588.92), so the phone price chart takes the least more: 123 high, 13 px shorter than 136 (the brief allowed the least more needed; the P&L chart stays 200; the wide price chart stays 136). The case's expected value moved from 124 to 123 before its commit; its title still says "12 px" (a nit, left). No existing case pinned the phone height. `e2e/d9/responsive-a11y.spec.ts`: 6 of 6 (4 and 2 failed at 124).
  - B1 done: `d4324a1b`; red `slider 14, right edge: expected 345.2 to be less than or equal to 340`, green. Four more spots (start- and end-anchored at the cursor ± 6, above and below the dot) after the two centred ones. The spec 6 of 6 again.
  - No first-run pass. Lane tier `T9AR.12-DB`: unit 2355, integration 280, checks 14 of 14.
  - ocr on `b5412945` (`ocr/T9AR.12-D1-b5412945.json`): 0 comments, **no findings**. ocr on `d4324a1b` (`ocr/T9AR.12-B1-d4324a1b.json`): 1 comment.

| Severity | Location | Finding | Verdict |
|---|---|---|---|
| low | `corridor.test.tsx:1149` | The test helper `extent` picks the anchor offset with a nested ternary | Doubtful (readability; this branch removed nested ternaries in T9AR.10-F1 and T9AR.8-F1): T9AR.12-F1 |

- **T9AR.12-F1** Structural: explicit branches in the test helper.
  - Done: `404fd3c3`, `corridor.test.tsx` only. `corridor.test.tsx` 53 of 53; typecheck, lint exit 0. ocr on `404fd3c3` (`ocr/T9AR.12-F1-404fd3c3.json`): 0 comments, **no findings**. Lane PL's merge waits for lane RO's (its lane tier rerun is in progress), so lane PL rebases once.

## T9AR.9 Review card: the Replay button

Lane OV (`d09ar/ov`), base `e526637e`, commit `52838a3a`. 8 planned cases: 3 red then green, 5 first-run passes, each mutation-checked (the unsaved choice and Intent: `key={String(replayOpen)}` on `ActionForm`, "expected radio to have property checked true"; Save Marks: a replay captured at first mount, "expected 'Thu Oct 8 · 1 of 1. $0.00' to be 'Mon Oct 12 · 2 of 2. +$582.00'"; Price History: `from=trades`, 1 failed; reopen on the named session: `sessionX`, "expected 'Mon Oct 12 …' to be 'Thu Oct 8 · 1 of 2. $0.00'"; no button: the `trade.replay &&` guard dropped, 1 failed). Lane tier `T9AR.9`: unit 2358, integration 280, checks 14 of 14. Browser: `e2e/d9/review.spec.ts` with `e2e/d5r/durability.spec.ts` 5 passed; `e2e/d9/responsive-a11y.spec.ts` 6 passed.

- Lines changed (section 1.5's "The Review card's inline replay" row): `ReviewCard.test.tsx` (the 7 inline-replay cases replaced by the 8 planned); `e2e/d9/support.ts` (`cardReplay` replaced by `cardReplayButton` and `openCardReplay`); `e2e/d9/review.spec.ts` (two cases open the overlay; the address now names the card and `replay=open`); `e2e/d9/responsive-a11y.spec.ts` (three Review-card cases open the overlay; the bottom-navigation focus case tabs from Close, "hidden" now means covered at the control's centre); `e2e/d5r/durability.spec.ts:98` (`input, textarea`, count still 0); `app.css` (the `h5` rule removed).
- **Outside `linkedCard` in `ReviewView.tsx`:** the search-change effect compares the search without `replay` and `session` (`searchOf`), and `CardBody` skips the panel focus while `replay=open`, so opening the overlay is not read as a new card link. Accepted as implementation-level (the same file, needed by A274).
- No words shortened; none uncovered.
- ocr on `52838a3a` (`ocr/T9AR.9-52838a3a.json`): 8 files (5 excluded), 3 comments.

| Severity | Location | Finding | Verdict |
|---|---|---|---|
| medium | `ReviewCard.tsx:273-275` | Opening copies the query, which can still hold `instrument`, so `linkedCard` opens Marks under the overlay and the Replay button is hidden after Close | Valid: T9AR.9-B1 |
| medium | `ReviewView.tsx:476-477` | `searchOf` strips only `replay` and `session`, so closing back to an older address swaps the card the trader opened by its header | Valid: T9AR.9-B2 |
| medium | `ReviewCard.tsx:282-283` | `closeReplay` clears `pushed` before going back, so Replay, Close, Forward, Close replaces instead of going back; `TradeDetail.tsx:73-74` has the same pattern | Valid: T9AR.9-B3, and T9AR.8-B4 for Trade Detail |

- **T9AR.9-B1** Case: it should open the overlay over the Action panel even when the address still names an Instrument.
- **T9AR.9-B2** Case: it should keep the card the trader opened by its header when the overlay closes back to an older address.
- **T9AR.9-B3** Case: it should go back one entry on the second Close after Replay, Close, Forward (Review card).
- **T9AR.8-B4** Case: the same on Trade Detail.
  - Done, one commit each: B1 `04ebce05` (red: the Action panel's `aria-expanded` 'false'; a first fix deleting `instrument` was not enough and was reverted, one extra `green exit=1` row in the log; the fix is in `ReviewView.tsx`'s search-change effect: a change of the `replay` param is recorded as applied and opens no card); B2 `595ee9d3` (test only; first-run pass, B1's fix covers it; mutation, the check made inert, failed with `Unable to find an accessible element with the role "region" and name "ABC review"`); B3 `15e2891f` (red `expected '/review?trade=t1&panel=Action' to be '/review'`); T9AR.8-B4 `5946c86c` (red `expected 'REPLACE' to be 'POP'`). typecheck, tsc6, lint, `lint:deps` exit 0.
  - Lane tier `T9AR.9-B`: integration 280, checks 14 of 14, **unit 2 failed of 2362**: `src/app/bench-generator.test.ts` and `tools/wording-rules.test.ts`, each at about 5.4 s against the 5 s timeout while two lane tiers ran at once. Reproduced alone by the main session (`npx vitest run --project unit src/app/bench-generator.test.ts tools/wording-rules.test.ts`): 62 of 62 passed. Not reproduced: load timeouts, not a defect; the lane's rerun after its rebase is the tier of record.
  - ocr, one run per commit: `595ee9d3`, `15e2891f`, `5946c86c` (`ocr/T9AR.9-B2-595ee9d3.json`, `ocr/T9AR.9-B3-15e2891f.json`, `ocr/T9AR.8-B4-5946c86c.json`): 0 comments each, **no findings**. `04ebce05` (`ocr/T9AR.9-B1-04ebce05.json`): 1 comment.

| Severity | Location | Finding | Verdict |
|---|---|---|---|
| medium | `ReviewView.tsx:488` | `overlayMoved` swallows any address change that also changes `replay`: a history jump that changes both `trade` and `replay` (from `trade=t1&replay=open` back past the overlay's entry to a `trade=t2` entry) leaves the old card showing | Valid (narrow; a plain Back from the overlay is fine): T9AR.9-B4 |

  - **T9AR.9-B4** Case: it should open the card the address names when a history move changes both the card and the overlay.
    - First attempt stopped, no commit: red (`Unable to find role=dialog name 'Replay, XYZ'` at the forward step); removing `overlayMoved` turned it green but failed B1 and B2, because a card opened by its header writes no address, so the overlay's older entry names another card, indistinguishable from a genuine move. Reverted.
    - **Implementation-level decision (main session):** on Replay, first replace the current entry with the card actually open (`trade=<card>&panel=Action`, `instrument` dropped), then push `replay=open`; the entry Close returns to then names the open card, and a history move that changes `trade` resolves through `linkedCard`. Header opening is unchanged. Second attempt briefed.
    - Done: `4944f049`; red `Unable to find role="region" and name "ABC review"`, green; `ReviewCard.test.tsx` 69 of 69 (B1, B2, B3 unchanged). `overlayMoved` and `appliedReplay` removed. **Narrowed from the decision:** the replace happens only when the current entry names something other than this card (another card, an Instrument or another panel); an unconditional replace broke two existing cases that open the card by its header at a bare `/review` and expect `/review` after Close. Accepted (it keeps their expected values). `e2e/d9/review.spec.ts` 2 of 2. Lane tier `T9AR.9-B4`: unit 2363, integration 280, checks 14 of 14. ocr on `4944f049` (`ocr/T9AR.9-B4-4944f049.json`): 3 files (5 excluded), 0 comments, **no findings**. Merge after lane RO's (rerun in progress).

## T9AR.13 Readout: the stake grid, a Trade past a line, the change line

Lane RO (`d09ar/ro`), base `e526637e`, commit `aa047c46`. Planned cases red then green, except 3 first-run passes, each mutation-checked: the change line (a change line attached to the Reward to risk row: `expected '{"title":"At stake from here, whole P…' not to contain 'since'`); the critic-2 carry's unit half (a "P&L " prefix in the cell: `expected 'P&L −$543.00' not to match /\s/`); the canonical terms' props half (a term renamed: `expected [ [ 'At Stop', …(1) ], …(3) ] to deeply equal …`). Code written ahead of red (the unbounded branch, the "'s amount" branch, the no-ratio omission) was backed out for real reds. Lane tier `T9AR.13`: unit 2370, integration 280, checks 14 of 14. Browser: `gaps.spec.ts` with `replay.spec.ts` 10 passed; `states.spec.ts` 4 passed.

- Lines changed, by section 1.5 row: `readout.props.test.ts` and `readout.test.tsx` (the readout's own seam: the overrun and planned-amount cases now assert the past-a-line row; the No Mark, Worst case, Max reward and T9.19-B4 cases read grid cells; the change line no longer under a stake row; T9.19-B4 and B14 replaced by one grid case); `replay.props.test.ts` (Reward to risk values: four assertions now "no Reward to risk row", one case renamed; No Mark as a readout value); `e2e/d9/support.ts` (`readoutValue`, `readoutPnl` find `[data-row=…]`; new `readoutR`, `pastLine`, `noMarkDash`); `e2e/d9/gaps.spec.ts` (Tue 11-10 dashes; Mon 11-09 past-a-line; two new width cases for critic-2's defect 2); `e2e/d9/replay.spec.ts` (Mon 11-16). `frame.test.tsx`, `states.spec.ts` and `format.ts` unchanged. Phone CSS added after the 320 width case found the grid overflowing.
- Words shortened (P137) and uncovered: recorded in `words-changed.md` and `new-words.md` by the task.
- For later tasks: `riskChange` and `rewardChange` now have no reader (T9AR.21; `view-doubles.props.ts` still sets them); `responsive-a11y.spec.ts:48` reads `.replay-readout-row .replay-value`, which no longer includes the stake values (B9AR.3 should read the grid's cells); `stakeRow`, `maxRewardRow`, `pastLineRow` in `readout.props.ts` are module-private (export when T9AR.17 needs them).
- ocr on `aa047c46` (`ocr/T9AR.13-aa047c46.json`): 9 files (7 excluded), 1 comment.

| Severity | Location | Finding | Verdict |
|---|---|---|---|
| low | `readout.tsx:51` | A static `style={UNBREAKABLE}` duplicates the stylesheet's `nowrap`, and the unit test checks the inline copy | Doubtful (readability): T9AR.13-F1 |

- **T9AR.13-F1** Structural: the stylesheet rule is the one source; the case checks the rule.
  - Done: `06741b51`. `UNBREAKABLE` and the three inline styles removed from `readout.tsx`; the "unbreakable cells" case reads `replay-readout.css` with postcss (as `corridor.test.tsx` does) and checks each figure cell is a `td` in `.replay-stake-grid`. `readout.test.tsx` 8 of 8; typecheck, lint exit 0. Mutation (the `nowrap` line deleted): `expected undefined to be 'nowrap'`, restored. Lane tier `T9AR.13-F1`: unit 2370, integration 280, checks 14 of 14. ocr on `06741b51` (`ocr/T9AR.13-F1-06741b51.json`): 0 comments, **no findings**.
- Lane RO rebased onto `bc7444e2` (it brought in T9AR.6 and T9AR.11; `new-words.md` conflicted and was resolved by keeping both tasks' rows): `e7c42f5d` (T9AR.13), `a086218b` (F1). Lane tier rerun as `T9AR.13-rebased`: unit 2373, integration 280, checks 14 of 14; `run-complete.sh`: run complete. Merged by fast-forward to `a086218b`.
- Lane PL then rebased onto `a086218b` (`DECISIONS-PENDING.md` conflicted; main's answered version kept): `8bf78d34` (T9AR.12), `94ea7114` (D1), `373f41dc` (B1), `912e01db` (F1). Lane tier rerun as `T9AR.12-rebased`: unit 2379, integration 280, checks 14 of 14; `run-complete.sh`: run complete. Rebased again over the evidence-only `bcab74c4` (no code between, no rerun): `9c501b86`, `c2b1f641`, `33146bfe`, `199c0216`. Merged by fast-forward to `199c0216`.

## T9AR.16 The top of the replay, a session with no Mark, the hover box

Lane SC (`d09ar/sc`), base `b75e4597`, commit `0ba39920` (four of five planned cases). Red then green: the date beside the headline figure; the no-Mark line in `calculation-words.test.ts` (a new `line` length) and in `session-words.props.test.ts` (an existing case rewritten) and in the frame (normal size); the hover box over the chart. First-run pass: the acknowledgment case (the `line` length already sent every other reason to its figure words); mutation (AcknowledgedUnavailable no longer sent to its figure words) failed with `expected { …(2) } to deeply equal { …(2) }`. Lane tier `T9AR.16`: unit 2362, integration 280, checks 14 of 14. Browser: `gaps.spec.ts` with `states.spec.ts` 7 passed.

- **Not built: "Add the Mark".** `ReplayFrameSession` carries no link target and the frame cannot tell an Open Trade. Routed to lane TY as **T9AR.2-B1** (an optional `addMarkTo?` on `ReplayFrameSession`, set by the adapter only on an Open Trade, A281); T9AR.16's last case follows in lane SC once it merges.
- Lines changed (section 1.5's "headline on a session with no Mark" row): `e2e/d9/gaps.spec.ts` (2) and `e2e/d9/states.spec.ts` (2): the headline reads "No Mark for the put on …", the going line count 0. The row's `replay.props.test.ts` "Mark missing" lines now live in `session-words.props.test.ts` (T9AR.2's split); changed there. Hover row: the existing `frame.test.tsx` hover cases unchanged.
- Words: W61's line replaces "Mark missing: CORV Nov 20 $80 Put, Tue Nov 10" (largest type) and the "No Mark." sentence; the acknowledgment's words unchanged, now at normal size. Uncovered: the session's date beside the headline (muted, smaller); "the call" for a call (the plan names the put).
- Types: `WordLength` gains `'line'`; `topLineOf` added beside `headlineOf`.
- **Layout note:** the frame now wraps the plot and the hover box in `div.replay-chart-box` (the overlay grid's child). The task reports that `.replay-overlay .replay-plot-frame` (column 1, T9AR.7-B2) never matched the plot, which was `.replay-corridor`. To check at T9AR.16's merge, and route to lane OV if the overlay's two columns are not in effect.
- ocr on `0ba39920` (`ocr/T9AR.16-0ba39920.json`): 9 files (5 excluded), 0 comments. **No findings.**
- **Last case, "Add the Mark"**, after T9AR.2-B1 merged and lane SC rebased (first part now `1ce8e839`): `3447ef61`, split in two. Adapter (`replay.props.test.ts`): red `expected [ undefined, undefined ] to deeply equal [ undefined, …(1) ]`, green; `addMarkLinkOf` sets `/review?trade=<id>&instrument=<symbol>` when `view.pending !== null` and `isMarkLacking(tradePnl)`. Frame (`frame.test.tsx`, under `MemoryRouter`): a first run failed on importing `react-router-dom` (not a valid red, discarded); red `Unable to find an accessible element with the role "link" and name "Add the Mark"`, green. No first-run pass; no CSS change; no browser run. Lane tier `T9AR.16-L`: unit 2386, integration 280, checks 14 of 14.
- ocr on `3447ef61` (`ocr/T9AR.16-3447ef61.json`): 4 files (5 excluded), 2 comments, made bug tasks:
  - **T9AR.16-B1** (Valid, `replay.props.ts:78`): the link names the option's listing symbol, not the contract key the Review's Marks rows use, so on an option Trade it misses the row.
  - **T9AR.16-B2** (Doubtful, `frame.tsx:60`): "Add the Mark" written in the component; briefed to check the convention for link labels and change only if it differs.
  - Briefed together in lane SC.
    - **B1** `86b33a7d`: `addMarkTo` uses `instrumentKey(tradePnl.instrument)`. The case "should link an option Trade to the Review row by the contract key the Marks rows use, not the listing symbol" uses the put's double on Tue 11-10 and asserts that a stock still links by its symbol. Red: `expected '/review?trade=T-1&instrument=DALE' to be '…instrument=DALE261120P00057500'`; then green.
    - B1 changed one expected value: the earlier "Add the Mark" adapter case (same task, `3447ef61`) used an option double (BREN call), so its `instrument=BREN` encoded the bug. It now expects the contract key. Accepted.
    - Lane tier `T9AR.16-B`: unit 2387, integration 280, checks 14 of 14.
    - ocr on `86b33a7d` (`ocr/T9AR.16-B1-86b33a7d.json`): 2 files (5 excluded), 0 comments, **no findings**. Lane SC is ready; it merges after `merge4` finishes, since that run uses the main checkout.
- **Merged.** Rebased onto `a959e862`: `f1188678` (first four cases), `c04fb5d0` (Add the Mark), `4179346d` (B1). Lane tier rerun `T9AR.16-rebased`: unit 2396, integration 280, checks 14 of 14; `run-complete.sh`: run complete. Fast-forwarded to `4179346d`.
- **Overlay grid check (from T9AR.16's report), confirmed by reading the code.** `replay-overlay.css:64` places `.replay-overlay .replay-plot-frame` in column 1. Since T9AR.16 the card's grid child is `div.replay-chart-box` (`frame.tsx:79`), which wraps the plot frame, so the rule matches no grid item. The chart box spans both columns, and the readout takes column 2 on a row of its own, so A275's "readout beside the charts at 1280" likely no longer holds.
  - This came from a task report, not an ocr finding, so it is not a bug task. It is a stated check of B9AR.1 (T9AR.23), so T9AR.23's brief names it, and a failure there becomes an S task for lane OV (`replay-overlay.css`).
    - **B2: no change.** Link and button labels live in the components: `ReviewCard.tsx:343` and `Cockpit.tsx:250` ("Price History"); "Add the Mark" matches them.
  - Reviewer's note, not a finding: `needs-you.props.ts:58` and `TradeList.tsx:294` use the same `.symbol` for their Marks links. That is outside D9A-R, so it is recorded for the final report.
- **T9AR.2-B1** (lane TY) done: `7f6618fc`, `replay.types.ts` only: `ReplayFrameSession.addMarkTo?` after `headline`, naming A281. typecheck, tsc6, lint exit 0; `src/ui/cockpit/replay` 156 passed. Lane TY rebased onto `df012a47`: B1 is now `d88001ac`. ocr on `7f6618fc` (`ocr/T9AR.2-B1-7f6618fc.json`): 0 comments, **no findings**.
- **T9AR.2-F1** (lane TY, held until lane PL was idle) done: `c2882ae0`: `pnlShortTitle?` removed from `replay.types.ts` (comment now "The P&L chart's title."), and its one assertion from `plot.props.test.ts`'s "should title the P&L chart Trade P&L at every width" (the case stays). `grep -rn pnlShortTitle src e2e tests tools`: nothing; typecheck, tsc6, lint exit 0; `src/ui/cockpit/replay` 162 passed. ocr on `c2882ae0` (`ocr/T9AR.2-F1-c2882ae0.json`): 0 comments, **no findings**. Lane tier run by the main session as `T9AR.2-BF`: unit 2379, integration 280, checks 14 of 14; `run-complete.sh`: run complete. Merged by fast-forward: `d88001ac` (B1), `c2882ae0` (F1).
- Lane SC rebased onto `c2882ae0`: T9AR.16's first part is now `1ce8e839`; its last case briefed. Lane DM rebased onto `c2882ae0`: T9AR.21 is now `cf79c748`, lane tier rerun as `T9AR.21-rebased`.

## Suite runs

| Run | Commit | Tier | Result |
|---|---|---|---|
| `merge3` (after T9AR.5, T9AR.11 with B1 and T9AR.10-S1, T9AR.8 with B1, B2, B3, F1) | `e526637e` | full (`browser-auto 72ece0c8`) | unit 2357 (208 files), integration 280, browser-1 126, browser-2 79, browser-3 77, checks 14 of 14, all exit 0; `run-complete.sh`: run complete |
| `merge5` (after T9AR.15 with B1, T9AR.16 with B1, T9AR.19 with B1, B2, B3, T9AR.20, T9AR.22 with B1, B2, merge4-S1) | `f287a68a` | full (`browser-auto c394ce6a`) | unit 2416 (209 files), integration 286, browser-1 126, browser-2 79, browser-3 79, checks 14 of 14, all exit 0; no flake. The two Review specs T9AR.20 could not run (`e2e/d4/review.spec.ts`, `e2e/d5r/review.spec.ts`) pass, and so does B9.5's phone fit with T9AR.19's flags. `run-complete.sh`: run complete |
| `merge4` (after T9AR.6, T9AR.12, T9AR.13, T9AR.2-B1, F1, T9AR.21, T9AR.14, T9AR.9 with B1, B2, B3, B4, T9AR.8-B4) | `c394ce6a` | full (`browser-auto e526637e`) | unit 2388 (209 files), integration 280, browser-1 126, browser-2 79, checks 14 of 14 exit 0; **browser-3 1 failed, 78 passed**. The failure: `e2e/d8/restore.spec.ts:31` (B8.3, line 84). After relaunch, the Trade Detail "Today" view lacked its Marks block and "Wed Oct 14" labels. Rerun alone by the main session: the file 6 of 6, then the case 3 of 3 (`--repeat-each=3`), so it looks like a load-timing race in `viewsOf` (it reads the view before the Marks block renders). Not a known flaky case, so it went to **merge4-S1**: settle whether the helper races or D9A-R slowed that view, and fix whichever it is. `run-complete.sh`: run complete. **merge4-S1** (lane S4, `1875b36d`, evidence `0cc227b3`) found a race in the test helper, not a regression. The Detail shows Ready with its replay Pending and fills in the Marks block after, and this order is the same at tag `claude-opus-5.5-d9a`. The fix makes `viewsOf` also wait until no `[role="status"]` reads "Loading the Trade". Under 20x CPU throttling the old helper failed (1) and the new one passed 3 of 3; the file passed 6 of 6 unthrottled. Lane tier `merge4-S1`: unit 2388, integration 280, checks 14 of 14. ocr on `1875b36d` (`ocr/merge4-S1-1875b36d.json`): **no findings**. The reviewer confirmed the wait cannot pass vacuously: the heading and the Loading elements render in the same commit, and Today is covered through the same `setState`. Rebased onto `3cb51638`; lane tier rerun `merge4-S1-rebased`: unit 2410, integration 286, checks 14 of 14; run complete. Merged: `83fea156`, `fa2025a4`. |
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
