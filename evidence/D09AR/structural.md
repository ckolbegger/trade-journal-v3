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
- **T9AR.7-B2** No wide layout. Case: it should place the charts on the left and the readout on the right inside the overlay at 1280 wide, and one column at 375 (A275).
- **T9AR.7-B3** The Tab case can pass with Tab swallowed. Case: the existing Tab case asserts the order (Close, the inside button, Close; and the reverse with Shift+Tab). A test-only change: it must fail against a trap that always refocuses Close.

## T9AR.10 Chart: the key, the dates, every line labelled

Lane PL (`d09ar/pl`), base `8245f6c6`, commits `07916b2e` (the task), `80c143ad` (its lane tier files). 7 planned cases, four split into a drawing test and a props test, so 11 red/green pairs; no first-run pass. One green row first exited 1 on the task's own wrong anchor expectation, fixed in the test and rerun green (noted in the log). Lane tier `T9AR.10`: unit 2299, integration 280, checks 14 of 14. Browser: `e2e/d9/replay.spec.ts` only, 5 passed.

- Notes from the task's summary (not ocr findings):
  - Existing expected values changed as consequences of planned cases, not listed in section 1.5's lookup: `corridor.test.tsx`'s "leave out a label that has no free spot" now expects 2 price lines, not 3 (A280: a line is drawn only with its label); its width at a 900 wide box expects '900', not '640', in two places (drawn at the box's own width). `plot.props.test.ts`'s expected objects gain `keyEntries`, `startLabel`, the "Expires …" end label, the single title and the stock axis. Accepted as implementation-level: each follows directly from a planned case.
  - `e2e/d9/responsive-a11y.spec.ts` line 69 (`not.toContain('dollars for the whole Position')`) left as it is: still true.
  - `pnlShortTitle` is no longer read but is still declared, optional, in `replay.types.ts` (lane TY's file). Routed to lane TY as **T9AR.2-F1** (delete the field; verified by typecheck and the same cases passing).
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
  - **T9AR.10-B2** The key's swatches don't match the drawing. Case: it should give each key entry the swatch of what it names: Open profit and Open loss their areas' colours, Banked and Realized loss their bands' colours.
  - **T9AR.10-B3** Worst case and Max reward labels can sit in the cursor's column. Case: it should keep the Worst case and Max reward labels out of the cursor's column at the last session (A280). T9AR.11's planned case covers the other level labels.
  - **T9AR.10-F1** (structural) The nested ternary in `span` replaced by explicit branches; verified by the same cases passing before and after.
  - `drawPnl` and `drawStrip` return `{ svg, drawn }` (`DrawnChart` in `geometry.ts`), so the key names Worst case, Max reward and Strike only when drawn. The key sits beside the hit-area frame in a new `div.replay-corridor`. An axis end label is hidden when it would sit under the cursor's date. `corridor.tsx` uses `props.cursorLabel ?? current.dateLabel`; nothing sets `cursorLabel` yet.

## Suite runs

| Run | Commit | Tier | Result |
|---|---|---|---|
| `wave0` (merge run after T9AR.1, T9AR.2) | `1018d618` | full (`browser-auto 1cc612ea`: first matching path `src/ui/cockpit/index.css`) | unit 2289 (203 files), integration 280 (130 files), browser-1 126, browser-2 79, browser-3 77, checks 14 of 14; all exit 0; `run-complete.sh`: run complete |

## Critics

| Critic | Result | Tokens | Tool calls | Time |
|---|---|---|---|---|
