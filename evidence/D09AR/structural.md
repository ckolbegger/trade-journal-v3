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

## Suite runs

| Run | Commit | Tier | Result |
|---|---|---|---|
| `wave0` (merge run after T9AR.1, T9AR.2) | `1018d618` | full (`browser-auto 1cc612ea`: first matching path `src/ui/cockpit/index.css`) | unit 2289 (203 files), integration 280 (130 files), browser-1 126, browser-2 79, browser-3 77, checks 14 of 14; all exit 0; `run-complete.sh`: run complete |

## Critics

| Critic | Result | Tokens | Tool calls | Time |
|---|---|---|---|---|
