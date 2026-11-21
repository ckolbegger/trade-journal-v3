# D09R2 structural evidence and run records

D9R2 runs one task at a time (P162; decision 100). Each task's heading holds its level, its ocr table, its bug tasks and its run.

## Spec sections read beyond plan/spec-reading/D09.md

- None yet.

## Session reading (main session)

- Read in full: `plan/D09R2-handoff.md`, `plan/kickoff.md`, `.claude/docs/implementing.md`, `plan/D09R2-review-marks-grid.md` (sections 1 to 14; the appendix's lookup output is pulled into briefs as needed), and every range in `plan/spec-reading/D09.md`.
- `plan/implementation-plan.md`: the rules and cumulative obligations, the deliverable summary, the D9R2 definition, and decisions 98 to 123 in full; earlier decisions are carried by the docs and tooling that apply them. Earlier breakdowns' sections (D5R A150 to A163, D5R2 A171 and A172, D08P A210, A214, A216, D4 A57, D9 P133) are read when a brief needs them.
- `plan/D07-approved-words.md`: conventions C1 to C8 and the D8R note.

## Before T9R2.1: the wording-rules test (location check fix)

- Commit `ceefd574` (`chore(retro-D09C)`), `tools/wording-rules.test.ts` only; see `provenance.md`. Asked and approved by the user, 2026-11-20 (option 1). Light (decision 122): no ocr, no suite run. Ran `tools/wording-rules.test.ts` (38 of 38) and the unit project (224 files, 2592 tests, all passing); `npm run lint` 0 errors.

## T9R2.1 The Review card's dated heading

- Base `ceefd574`, commit `ebe553a6`. Light (decision 122): no ocr, no suite run.
- Tests the subagent ran: the new case red ("Unable to find … group … At the Fri Oct 9 Marks"), then green; `CardFigures.test.tsx` and `ReviewCard.test.tsx` 85 passed; `tools/wording-rules.test.ts` 38 of 38; typecheck, `tsc6`, lint and `lint:deps` exit 0 (two existing `react-hooks/exhaustive-deps` warnings in `OwedDebtItem.tsx`); browser `e2e/d7sp/review-dated-line.spec.ts` 1 passed under the lock.
- Expectations changed: `CardFigures.test.tsx` 74, 115, 150; `ReviewCard.test.tsx` 205; `e2e/d7sp/review-dated-line.spec.ts` 31, as section 1.6 lists. `eslint-suppressions.json` pruned of `CardFigures.tsx`'s `no-restricted-syntax` entry.
- First-run passes: none. Words: W79 as approved; no P137 shortening; no new words.
- Note (subagent): the spec's title at line 11 reads "a Mon Oct 12 close group", not "Monday Mark" as section 1.6 says; left as is (titles are not screen words, and section 1.6 says the title stays).

## T9R2.2 Price History: acknowledged sessions

- Base `ebe553a6`, commit `8d3e8c0d`. Standard (decision 122).
- Cases: 4, each red by assertion, then green (`tdd-log/T9R2.2.md`); case 1's first green run failed on the subagent's own fixture (an unavailable Trade P&L kept "No Mark" in the P&L cell), fixed in the fixture. `price-history.props.test.tsx` 18 of 18; the listed existing expectations unchanged. First-run passes: none.
- Browser: `e2e/d8p/history.spec.ts` 3 of 3 under the lock (no spec edited).
- Assumptions (subagent): a session with both a Missing and an acknowledged Mark counts as Missing only; the acknowledged count covers sessions holding a Position with no Missing Mark and at least one acknowledged Mark; a session that held nothing keeps its plain "—". `verify:wording` refused the literals, so the cell and the line use `acknowledgedUnavailableStatusLabel()` from `calculation-words.ts` (lowercased in the line); the text matches W78 and W81.
- Public types: `PriceHistoryProps` gains `acknowledgedCount`; `missingCount` and `priceHistoryTabCount` count Missing only. T9R2.8 carries both.
- Words: W78 and W81 as approved; no P137 change; no new words.
- ocr (`ocr/T9R2.2-8d3e8c0d.json`): **No findings.** 4 files reviewed.
- Run `T9R2.2` (browser-task): unit 224 files, 2597 tests; integration 137 files, 294 tests; browser task tier 5 passed (12.9 s); checks 14 of 14. Ports free before and after. No flaky case failed. `run-complete.sh`: run complete.

## T9R2.3 Journal cards: acknowledged sessions

- Base `8d3e8c0d`, commit `4f3d6a76`. Standard (decision 122).
- Cases: 2, each red by assertion, then green (`tdd-log/T9R2.3.md`); names rephrased without quotes or the dash for `tdd.sh`'s filter, meaning unchanged. `src/ui/cockpit` 437 tests pass; `journal-cards.props.test.tsx` 138 and 277 unchanged. First-run passes: none.
- Implementation-level assumption (subagent, recorded rather than asked): the merge rule lives in `journal.props.ts` (`withoutMarks`; `journal-cards.ts` does not exist) and now merges a session only when every Mark is Missing, so a session mixing Missing and acknowledged Marks keeps its own card. This follows A214's amendment ("a session whose Marks are acknowledged is not merged"). The Mark wording moved into a `valueOf` helper (a nested ternary failed lint) and uses `acknowledgedUnavailableStatusLabel()`.
- Browser: 7 `e2e/d8p` spec files (cockpit, history, journal-final-session, states, settlement-due-replay, planned, responsive-a11y), 14 tests, all passed under the lock; no spec edited.
- Words: W78 as approved; no P137 change; no new words.
- ocr (`ocr/T9R2.3-4f3d6a76.json`): **No findings.** 2 files reviewed.
- Run `T9R2.3` (browser-task): unit 224 files, 2599 tests; integration 137 files, 294 tests; browser task tier 5 passed (13.1 s); checks 14 of 14. Ports free before and after. No flaky case failed. `run-complete.sh`: run complete.

## T9R2.4 Price History gain and loss colours

- Light (decision 122); styles only, no case. `src/ui/cockpit/styles/history.css` gains `.price-history td.gain { color: var(--target) }` and `.price-history td.loss { color: var(--stop) }`. `price-history.tsx` (in `drawers/`) already puts `cell.tone` ('gain' or 'loss') on the td, so its markup is unchanged. The sign stays in the text.
- `.claude/scripts/with-browser-lock.sh npm run test:e2e:specs -- e2e/d8p/history.spec.ts` (with a scratch spec, since deleted): history.spec.ts 3 passed.
- Computed style, scratch spec: Trade P&L gain cell "$218.05" is rgb(29, 107, 52) = --target #1d6b34; a cell given the loss class is rgb(163, 38, 27) = --stop #a3261b. Both are the existing tokens used on the pnl card; contrast against the card background was not re-measured here (B9R2.1 later).
- `npm run lint`: 0 errors, 2 pre-existing warnings in OwedDebtItem.tsx.
- Base `4f3d6a76`, commit `7b1d9eed` (the subagent wrote the lines above into this file in its own commit). Light (decision 122): no ocr, no suite run. The pre-commit hook ran typecheck and lint; `tsc6` and `lint:deps` were not run by the subagent and are covered by the next run (T9R2.5's). First-run passes: none (no case). Words: none.

## T9R2.5 Series points carry the resolution revision

- Base `7b1d9eed`, commit `5212dedb`. Full (decision 122).
- Cases: 2, each red by assertion (no `resolutionRevision` on the point) before any production code, then green (`tdd-log/T9R2.5.md`); 40 market-data cases pass. First-run passes: none.
- Strict expectations given exactly the new field (A290): `market-data.test.ts` 646 (`price: '10.5', revisionNumber: 1, source: 'Manual'` → adds `resolutionRevision: 1`; listed as 648 in section 1.6) and 722 (`price: '9', revisionNumber: 1, source: 'Manual'` → adds `resolutionRevision: 1`; listed as 700). Nothing else changed in them.
- Deviation (subagent, recorded): `src/ui/cockpit/drawers/today.props.test.ts` 337, a `point` builder feeding `settlementUnderlying` (not an expectation, missed by section 1.6's consumer list), gained `resolutionRevision: 1` because typecheck failed once the field was required; its 28 cases pass.
- No fixture view changed; `trade-views.ts`, `assemble-replay.ts`, `daily-review.test.ts` and `replay-trade.test.ts` needed no edit. Every query-count proof passes with its request list unchanged.
- Types: `SeriesPoint`'s Available kind gains `readonly resolutionRevision: number`; the internal `seriesPoint` takes it as a fourth parameter (from the stored record in `historicalGaps`, from the session date's read record in `series`).
- ocr (`ocr/T9R2.5-5212dedb.json`): **No findings.** 3 files reviewed.
- Run `T9R2.5` (browser-auto 7b1d9eed): tier **task**, reason "no changed path since 7b1d9eed is on the full-tier list". Unit 224 files, 2601 tests; integration 137 files, 294 tests; browser task tier 5 passed; checks 14 of 14. Ports free before and after. No flaky case failed. `run-complete.sh`: run complete.

## T9R2.6 The Review open's earlier Marks

- Base `5212dedb`, commit `460f1594`; bug task T9R2.6-B1 `d5e48854`. Full (decision 122).
- Cases: 8 (`tdd-log/T9R2.6.md`); names drop apostrophes for `-t` filtering. Red then green: 1, 3, 4, 7. **First-run passes, each mutation-checked by assertion (flagged):** case 2 (mutation: always carry `previousSession`, falling back to the Review Date), case 5 (keep every series point), case 6 (every Trade's `from` is the previous session), case 8 (the `series` call starts at 2026-10-01, before the cached scan: 28 requests against 25, an added `observations.getAll`). Case 2's first two logged runs were a fixture error and a pass with nothing built, neither a valid red.
- **Changed existing case** (anticipated by case 8's "counted as `daily-review.test.ts` 1316 counts series reads"): `daily-review.test.ts` 1310, "should read no series in open: the replay is read by getTrade alone" → "should read series in open only to the previous session for the earlier Marks: the replay is read by getTrade alone". Before: `expect(read).toEqual([])` after the open, then `toHaveLength(2)` after `getTrade`. After: the open's calls equal `['BREN to 2026-11-13', '<call key> to 2026-11-13']`; `read` is reset; `getTrade` adds 2 calls ending `to 2026-11-16`. The store request lists are unchanged.
- No other existing case or fixture changed. Every request-list proof passes unchanged: `tests/integration/d4`, `d5`, `d5r`, `d6`, `d7`, `d9`, `d9ar` `query-count.test.ts`, `d7sp/review-query-count.test.ts`, and `meter.test.ts`. `verify:fixtures` OK; no file under `tests/fixtures` changed.
- Implementation-level decisions (recorded, not asked):
  - `from` per Trade is `firstRelevantGapDate` over a per-Trade session map: the previous session (with `recovered.previousCloseInstant`) plus every date the gap groups of that Trade's Instruments list, each with the gap groups' own close. A literal `firstRelevantGapDate(g.closes, …) ?? reviewDate` would give a fully marked Trade `from = reviewDate` (dropping its previous-session Mark) and never fetch the session on which only the Call is Missing. No added read.
  - `earlierMarks` is optional in the type (`earlierMarks?`) though `open` always sets it, because making it required breaks typecheck in 10 UI test builders. The main session gives T9R2.7 the change to required, with `earlierMarks: []` in those builders (type-only).
- Types: the Marks family gains `previousSession?: string` and `earlierMarks?: readonly EarlierMarksGroup[]`; `EarlierMarksGroup = { instrumentKey, instrument, trades: { tradeId, from }[], marks: Record<date, EarlierMark> }`; `EarlierMark = { resolution (Available), resolutionRevision }`; sorted by `instrumentKey`; not exported from `daily-review/index.ts`.
- Subagent note (not a bug task): a Trade whose Review Date is the first covered session (2024-01-02) appears to crash `valueTrade` in `observationFrame` ("Cannot read properties of undefined (reading 'instrumentKey')"). Existing behaviour, not touched; for the final report.
- ocr (`ocr/T9R2.6-460f1594.json`): 1 finding.

| Severity | Category | Location | Claim | Verdict |
|---|---|---|---|---|
| medium | test | `daily-review.test.ts:1474` | The "leave out an Instrument whose Trades all opened on the Review Date" case checks only its absence from `earlierMarks`, not that `series` is never called for it (A289); the no-request case's fixture has no such Instrument. | Valid: the code is correct (`assemble` returns early), but a regression calling `series` then dropping the group would pass. Bug task **T9R2.6-B1**. |

### T9R2.6-B1 No series call for a Review-Date-only Instrument

- The defect: A289's "no call" for an Instrument whose Trades all opened on the Review Date was untested, so a call that starts a scan could return unnoticed.
- Case: "it should make no series call for an Instrument whose Trades all opened on the Review Date". Commit `d5e48854` (test only). **First-run pass** (the behaviour was built by T9R2.6), mutation-checked: `assemble` calling `read.series(key, reviewDate, previousSession)` for that Instrument then dropping the group failed with "expected [ 'CORV', 'CORV261120P00080000', …(1) ] to not include 'NEWX'"; restored. `daily-review.test.ts` 83 of 83; query-count integration 20 of 20 in 10 files.
- ocr (`ocr/T9R2.6-B1-d5e48854.json`): **No findings.**
- Run `T9R2.6` (browser-auto 5212dedb; after the bug task's clean ocr): tier **task**, reason "no changed path since 5212dedb is on the full-tier list". Unit 224 files, 2610 tests; integration 137 files, 294 tests; browser task tier 5 passed (12.0 s); checks 14 of 14. Ports free before and after. No flaky case failed. `run-complete.sh`: run complete.

## T9R2.7 The held Review's earlier Marks, and the drafts module

- Base `d5e48854`, commit `a5886612`. Full (decision 122).
- Cases: 9 (`tdd-log/T9R2.7.md`); names drop parentheses and the apostrophe. Red then green: 1 (`listedStanding` also reads `earlierMarks`), 3, 5, 6, 7, 8, 9 (each a runtime TypeError for the missing function, or an assertion). **First-run passes, mutation-checked by assertion (flagged):** case 2 (A172; mutation: `standing()` always returns the listed standing → "expected … revision: 2 to deeply equal … revision: 3"), case 4 (`setDraft` already replaces; mutation: the existing draft wins). The two task files: 24 tests; `src/ui` and `src/coordinators/daily-review`: 96 files, 1354 tests.
- `earlierMarks` made required in `daily-review/types.ts` (the main session's decision after T9R2.6); `earlierMarks: []` added, type-only, to `CardMarks`, `ReviewCard`, `ReviewCardMeter`, `ReviewCards`, `ReviewExpiration`, `ReviewOptionMarks`, `ReviewOwed`, `ReviewSettlement` and `ReviewView` tests; `held-review.test.ts`'s builder gains an optional override. No expectation changed.
- Types (`review-drafts.ts`): `DraftValue` (`Price` with `price`, or `CantGetPrice` with `reason`), `Draft = { key, value, tradeId }`, `Drafts` keyed `instrumentKey:tradingDate`, `SaveEntries` (`Entries` with `MarketDataPrepareEntry[]`, or `TooMany` with `entered`, `limit`, `over`); `emptyDrafts`, `draftAt`, `setDraft`, `moveDraft`, `saveEntries(drafts, revisionOf)`, `keepOnly(drafts, isListed)` → `{ kept, dropped }`, `discardAll`. W76's words stay in the view.
- Subagent notes (not bug tasks; carried to the handoff's notes for T9R2.11, T9R2.13, T9R2.14): no draft list or count, no "newest draft's Trade", no exported "listed in the Review" helper; entries in first-entered order; an unknown standing binds at `'None'`.
- ocr (`ocr/T9R2.7-a5886612.json`): 1 finding.

| Severity | Category | Location | Claim | Verdict |
|---|---|---|---|---|
| medium | bug | `src/ui/screens/review-drafts.ts:60` | A292 names a per-key clear, but the module has only `setDraft` and `discardAll`; an empty price would stay a draft and `saveEntries` would send it. | Valid (A292 lists "set, clear, discard all"; W76 says "Clear 12, then save"); nothing imports the module yet. Bug task **T9R2.7-B1**. |

### T9R2.7-B1 Clear one draft

- The defect: no per-key clear in the drafts module (A292), so a cleared cell could only become an empty-price draft that Save Marks would send.
- Case: "it should clear one key's draft, leaving the others, and build no save entry for it".
- Commit `bbf1fb26`: red `TypeError: clearDraft is not a function`, then green; adds an immutable `clearDraft(drafts, key)` (returns the same object when the key has no draft). `review-drafts.test.ts` and `held-review.test.ts`: 25 tests. First-run passes: none.
- ocr (`ocr/T9R2.7-B1-bbf1fb26.json`): **No findings.**
- Run `T9R2.7` (browser-auto d5e48854; after the bug task's clean ocr): tier **full** (the task's commits touch `src/ui/`). Unit 225 files, 2620 tests; integration 137 files, 294 tests; `browser-1` 126 passed (5.2 min), `browser-2` 79 (5.1 min), `browser-3` 57 (4.2 min), `browser-4` 118 (6.0 min); checks 14 of 14. No flaky case failed. The runner's first hand-back was a "placeholder" sent while `browser-1` ran (`run-complete.sh`: INCOMPLETE); the main session asked it to finish and read the stage files once `run-complete.sh` printed "run complete".


## T9R2.8 The shared session grid

- What moved: `PriceHistoryTable`'s frame (region, table, header row, row labels, cells with tone, provenance and Corrected) is now `SessionGrid` in `src/ui/cockpit/session-grid.tsx` (props `SessionGridProps` in `session-grid.types.ts`: `rowLabels`, `columns`; plain props, A216). `PriceHistoryProps` extends it and adds `missingCount`, `acknowledgedCount`, `onOpenReview`. `PriceHistoryTable` stays (empty-state sentence, the gaps line and its Review link) and renders `SessionGrid`. Class names and `history.css` unchanged (`.price-history td.gain` and `td.loss` still apply).
- `price-history.props.test.tsx` not edited (`git diff` empty). Case titles before and after (identical):
  - Price History (W9, P99): should show sessions as columns, newest on the left, with rows for each Instrument's Mark and Trade P&L; should give a stock Trade's Mark a dollar sign and an option Trade's Underlying Mark none; should open the Review from Enter Marks in the Review; should scroll a long history inside the drawer, not the page; should keep the pinned row labels opaque over scrolled values; should show the replay the shell passes, and nothing without one; should render a 500-session history in one table; should say "No sessions yet" before the first session ends; should show a gap as "—" named "No Mark", count sessions without Marks on the tab, and link to the Review; should show an acknowledged session's cell as "Acknowledged Unavailable", not "—" named "No Mark" (W78); should count only Missing sessions in the line under the table when another session is acknowledged; should count only Missing sessions on the Price History tab; should say how many sessions are acknowledged under the table, without the link when none is Missing (W81); should not count the final session of a Closed Trade, flat at its close, as a session without Marks.
  - Price History: Mark provenance (W33): should give each Mark cell "Manual · saved 2026-10-14 17:00" as hover text and in its accessible name; should add Corrected and its reason after the saved time on a corrected Mark; should show a visible Corrected marker in a corrected Mark cell, and none in an uncorrected one; should give a gap no provenance.
  - Run: 18 passed.
- `e2e/d8p/history.spec.ts` unchanged: `.claude/scripts/with-browser-lock.sh npm run test:e2e:specs -- e2e/d8p/history.spec.ts` on 5175: 3 passed. Ports 5175, 9341, 9342 free before and after.
- Screenshots of `#drawer-panel-price-history` (the seeded O-C3 Trade, clock Thu 2026-10-15 18:00, Wednesday's XYZ Mark corrected to 57.45, so tones, a gap, Corrected and the gaps line show) in `evidence/D09R2/screenshots/T9R2.8/`: `before-1280.png` and `before-390.png` taken on HEAD `bbf1fb26` (after T9R2.2 and T9R2.4, before the extraction), `after-1280.png` and `after-390.png` after it. `cmp` of each pair: byte-identical (exit 0; sha1 450548612f0e... for 1280 and db47ac90205c... for 390), so 0 differing pixels. The capture spec was a temporary file under e2e/, deleted after use.
- `npm run typecheck`, `npx tsc6 --noEmit`, `npm run lint` (0 errors, 2 existing warnings), `npm run lint:deps`: exit 0.
- (main session) Base `bbf1fb26`, commit `8debfb01`. Standard (decision 122). New `SessionGrid({ rowLabels, columns })` (`src/ui/cockpit/session-grid.tsx`, `session-grid.types.ts`); `PriceHistoryProps` = `SessionGridProps` plus `missingCount`, `acknowledgedCount`, `onOpenReview`. The grid still renders `table.price-history` in a region labelled "Price History"; T9R2.9 makes the label and class props. The screenshots don't include an acknowledged cell (the seeded Trade has none).
- ocr (`ocr/T9R2.8-8debfb01.json`): **No findings.** 4 files reviewed.
- Run `T9R2.8` (browser-task): unit 225 files, 2620 tests; integration 137 files, 294 tests; browser task tier 5 passed (12.9 s); checks 14 of 14. Ports free before and after. No flaky case failed. `run-complete.sh`: run complete.

## T9R2.9 The shared grid's editable cells and turned layout

- Base `8debfb01`, commit `7363ed21`. Standard (decision 122).
- Cases: 8, each red then green (`tdd-log/T9R2.9.md`); case 5's first green run failed on the test (no `afterEach(cleanup)`), fixed in the test. Cockpit unit tests 445 pass; `typecheck`, `tsc6`, `lint`, `lint:deps`, `verify:wording` pass. First-run passes: none.
- Browser: `e2e/d8p/history.spec.ts` 3 passed; a deleted scratch spec proved the 44 px floor on touch (controls 29.6 and 42.6 px with a mouse). The measured turn under 40rem is proved only with a stubbed `ResizeObserver` (case 7); T9R2.11 checks it in a real browser (handoff note).
- Words: W71, W73, W74, W77 as approved, literal in the component (`verify:wording` accepts them); no P137 change; no new words.
- Types: `SessionGridFrame { label, tableClass }` (Price History passes "Price History", "price-history"); `SessionGridProps` gains `chosen?`, `layout?`, `onPressCell?`; column `role?`; `GridCell = GridValueCell | GridInputCell | GridNotHeldCell`.
- Subagent notes (to the handoff's notes, not bug tasks): no "needed" look on the Review Date's inputs; choosing an input cell not wired; Enter order left to T9R2.11.
- ocr (`ocr/T9R2.9-7363ed21.json`): 2 findings.

| Severity | Category | Location | Claim | Verdict |
|---|---|---|---|---|
| medium | bug | `session-grid.css:51` | The 44 px touch floor applies only to `.session-grid-control`, so cells with no control (Not held, plain values) can stay shorter on touch. | Valid (case 8 says cells). Bug task **T9R2.9-B1**; scoped by the main session to grids with interactive cells, so Price History (read-only, T9R2.8) is unchanged. |
| medium | bug | `session-grid.css:22` | A pressable cell with a gain or loss tone loses its colour (the button sets `color: var(--ink)`). | Valid, latent (nothing sets both today). Bug task **T9R2.9-B2**. |

### T9R2.9-B1 44 px for every cell of an editable grid on touch

- Case: "it should give every cell of an editable grid, including a Not held cell in a row with no control, at least 44 px of height on a touch screen". Commit `64cc2033`: red ("expected false to be true": no editable marker), then green. The grid sets `data-editable` on its table (both layouts) when any cell is an input or pressable; `@media (pointer: coarse)` gives `.price-history[data-editable] td { height: 44px }`; the case also asserts a read-only grid has no `data-editable`. `src/ui/cockpit` 35 files, 446 tests; `e2e/d8p/history.spec.ts` 3 passed. First-run passes: none. Proved by the CSS text and the attribute, as case 8 is (no touch measurement in a browser).
- ocr (`ocr/T9R2.9-B1-64cc2033.json`): **No findings.**

### T9R2.9-B2 A pressable cell keeps its gain or loss colour

- Case: "it should keep a pressable cell's gain or loss colour". Commit `d45f5fab`: red (no `color: inherit` on the press button), then green (`button.session-grid-press { color: inherit }`, more specific than `.session-grid-control`'s ink); the draft chip keeps its own ink. `src/ui/cockpit` 35 files, 447 tests; `e2e/d8p/history.spec.ts` 3 passed. First-run passes: none.
- ocr (`ocr/T9R2.9-B2-d45f5fab.json`): **No findings.**
- Run `T9R2.9` (browser-task; after both bug tasks' clean ocr): unit 226 files, 2630 tests; integration 137 files, 294 tests; browser task tier 5 passed (13.0 s); checks 14 of 14. Ports free before and after. No flaky case failed. `run-complete.sh`: run complete.


## T9R2.10 The browser helpers move first (markRow, markCell)

- Structural, Light (decision 122): tests only, `e2e/`. `markRow(page, card, date)` (`e2e/d4/support.ts`) reaches the Marks panel, and when it holds the grid's cell named "<symbol> Mark, <date>" (an input or a button; a button is pressed to choose it) it chooses it; it returns the region of that name (the cell editor, or on the old layout the row). New `markCell(page, card, date)` returns the grid's input of that name, else the row's Price input. The grid is not on the Review until T9R2.11, so only the old-layout path ran. `enterMark` uses `markCell` on cards.
- Verification, `.claude/scripts/with-browser-lock.sh npm run test:e2e:specs -- <folder>`, one call per folder, exit 0 each, no expectation changed: d4 26 passed; d5r 15 passed; d7 33 passed; d8p 20 passed; d9ar 79 passed, 4 skipped (as before). Ports 5175, 9341, 9342 free before and after. `typecheck`, `tsc6`, `lint` (no errors), `lint:deps` exit 0.
- Helper-only diffs (file, line in the new file, old call, new call):

| File | Line | Old | New |
|---|---|---|---|
| e2e/d4/support.ts | 282 | `markRow` returned the row region | `markRow` (grid-aware, same signature); `gridCell` and `markCell` added |
| e2e/d4/support.ts | enterMark | `entry.getByLabel('Price').fill(price)` | `(await markCell(page, card, date)).fill(price)` |
| e2e/d4/responsive-a11y.spec.ts | 133 | `(await markRow(page, 'XYZ', DATE)).getByLabel('Price').fill('1')` | `(await markCell(page, 'XYZ', DATE)).fill('1')` |
| e2e/d4/card-helpers.spec.ts | 65-66, 74 | `row = markRow(XYZ)`; `row.getByLabel('Price')` | `markCell(page, 'XYZ', DATE)` |
| e2e/d4/card-helpers.spec.ts | 83, 86 | `row = markRow(XYZ)`; `row.getByLabel('Price')` | `markCell(page, 'XYZ', DATE)` |
| e2e/d4/card-helpers.spec.ts | 146, 155 | `row = markRow(tA)`; `row.getByLabel('Price')` | `markCell(page, tA, DATE)` |
| e2e/d5r/marks.spec.ts | 47-49 | `monday/friday/thursday.getByLabel('Price').fill` | `(await markCell(page, tA, MONDAY/FRIDAY/THURSDAY)).fill` (the unused `thursday` row dropped) |
| e2e/d5r/marks.spec.ts | 57-59, 65 | `monday/friday/thursday.getByLabel('Price')` (value checks, fix) | `markCell(...)` |
| e2e/d5r/marks.spec.ts | 81 | `(await markRow(page, tA, MONDAY)).getByLabel('Price').fill` | `(await markCell(page, tA, MONDAY)).fill` |
| e2e/d5r/marks.spec.ts | 110, 115 | `row.getByLabel('Price')` | `(await markCell(page, tA, MONDAY))` |
| e2e/d5r/responsive-a11y.spec.ts | 27, 66 | `monday.getByLabel('Price').fill`; `(await markRow(...)).getByLabel('Price')` | `markCell(page, tA, MONDAY)` |

- Kept on `markRow` or raw (decided per line): `e2e/d4/no-save.spec.ts` 51, 62 and `e2e/d4/correct-mark.spec.ts` 14, `e2e/d8p/support.ts` 100 (the Correct form's Price inside the editor); `e2e/d4/responsive-a11y.spec.ts` 144 (Cancel of the Correct form); `e2e/d5r/marks.spec.ts` 56 (`toBeFocused`, rule 4); `e2e/d4/responsive-a11y.spec.ts` 270, `e2e/d5r/responsive-a11y.spec.ts` 83, `e2e/d5r/sliders.spec.ts` 22, 45 (keyboard and focus steps, raw locators, rule 4); `e2e/d4/runtime-failure.spec.ts` 33, `e2e/d5r/review.spec.ts` 96-98 (card-wide `getByLabel('Price')` counts, not a row's); `e2e/d7/support.ts` 122 (`saveMarkPrice` takes a row Locator from its callers); `e2e/d9ar/support.ts` 59, 63 (regions named by option contract, not by the card's symbol: `markCell` takes the card's symbol). T9R2.11 must move or re-point these when the old row goes.
- (main session) Base `d45f5fab`, commit `4051e4d1`. Light (decision 122): no ocr, no suite run. Browser by folder: d4 26, d5r 15, d7 33, d8p 20, d9ar 79 passed (4 skipped); no expectation changed. Only the old-layout path ran; the grid path of `markRow`/`markCell` is first exercised by T9R2.11. The reaches left on the old row's Price (`e2e/d7/support.ts` 122; `e2e/d9ar/support.ts` 59, 63; `e2e/d5r/sliders.spec.ts` 22, 45; the keyboard steps at `e2e/d4/responsive-a11y.spec.ts` 270 and `e2e/d5r/responsive-a11y.spec.ts` 83; the focus check at `e2e/d5r/marks.spec.ts` 56) go to T9R2.11's brief.

## T9R2.11 The Review's grid in the Marks panel

- Base `4051e4d1`, commit `b3fd296d`. Standard (decision 122). 8 cases (`tdd-log/T9R2.11.md`); case 7 gained a third scenario after its first green (red, then green).
- First-run passes: case 5 (mutation: Next page cleared typed prices, "expected '' to be '52.00'") and case 8 (mutation: save keys read only the first session, the `SaveReviewMarks` call assertion failed). Both restored and re-run green.
- Checks: typecheck, `tsc6`, lint (2 existing warnings), `lint:deps`, `verify:wording` pass. `src` plus `tests/integration` 350 files, 2810 tests (before the last refactor); `src/ui` and `src/ui/cockpit` 76 files, 1043 tests on the final code.
- Browser (final code): d4 26, d5 29, d5r 15, d6 17, d7 33, d8p 20, d8r 15, d9 118 (4 skipped), d9ar 79 (4 skipped). Real-browser turn (deleted scratch spec): the Marks region turned at 39.6rem (700 px viewport) and stayed wide at 52.1rem (900 px); 390, 600, 640, 660 px turned; no sideways scroll. Touch height not measured in a browser.
- New: `src/ui/screens/marks-grid.ts` (pure cell decisions: `gridModel`, `NOT_HELD`, `CANT_GET_A_PRICE`), `src/ui/screens/MarksGrid.tsx` (adapter; `SESSIONS_PER_PAGE` 20, pager, Enter order; imports only `SessionGrid` and its props, A216). `held-review.ts` gains `earlierMarksOf(held, tradeId)`. `GridInputCell.input` gains `onEnter?`, `onFocus?`, `id?`, `invalid?`. `CardMarksProps` gains `link?`. `e2e/d4/support.ts` exports `chooseCell`; `markRow` clicks input cells too. `GapList`, `GAPS_PER_PAGE`, `withNewest`, `TodayRow` removed.
- Pairing table (A299), the 17 old `CardMarks.test.tsx` cases: drafts; Save Marks one command; Save Marks rendering; pending (two); refused (now: issue and focus on the first refused key, `aria-invalid` on the others); conflicted; changed during assembly (two); rows with a Mark; two quick row saves; earlier sessions after a save (page away and back); earlier sessions after Refresh; not written; read only: all migrated. Keyboard: retired, covered by case 6. Rows (A153): retired, covered by cases 1, 2, 3 and 7 and a new "the cell editor (A153)" case. `ReviewView.test.tsx`'s "should not page away … while a Mark holds an unsaved value" retired, covered by case 5; its two list tests rewritten for the grid.
- Expectations changed beyond section 1.6 (the subagent's report; recorded here, not bug tasks): focus after a link lands on the Review Date cell (`ReviewCards.test.tsx` five assertions, `ReviewOptionMarks.test.tsx` contract-row focus; the e2e focus checks at `e2e/d5r/sliders.spec.ts` 22, 45 and `e2e/d5r/marks.spec.ts` 56) — A161's T9R2.14 behaviour arriving early, so T9R2.14 case 1 may pass first run; `ReviewOptionMarks.test.tsx` h4 headings became row headers ("Put Mark", "MNO Mark", "XYZ Mark"); `e2e/d4/gaps.spec.ts`: Friday stays as the Previous column after it is entered, the "count 0" check became `toContainText('Manual')`; `e2e/d5r/review.spec.ts` 96 to 98 read the grid input. Mechanical locator moves: `e2e/d9/support.ts`, `d9ar/support.ts` 59, 63, `d9ar/states.spec.ts`, `d7/support.ts` (`saveMarkPrice` takes the cell name from the row's `aria-label`), `d5r/responsive-a11y.spec.ts` 36, 37, 83.
- Implementation decisions (recorded, not asked): focusing an input chooses its cell; no "needed" look yet (T9R2.12); W72 shows whenever any earlier column (including the previous session) lacks a Mark; an Instrument with earlier gaps only gets a row with Not held on the Review Date; an acknowledged cell is a chip whose Price input is in the editor; the stand-in `CellEditor` (the old row, for the chosen cell only) keeps Correct, Withdraw (Review Date only), "Can't get a price", the zero hint, "Needed only while settlement is due" and "also held by" until T9R2.12; a Conflict chooses the first moved key, a refusal the first refused key; paging held by a Correct in progress with W80 (no case; T9R2.13 case 11 may pass first run).
- Words not in an approved row: region label "Marks by session" (nearest W9 "Price History"); a draft "Can't get a price" cell reads "Can't get a price"; a read-only Missing cell reads "Missing" (existing words). No P137 change.
- ocr (`ocr/T9R2.11-b3fd296d.json`): 3 findings.

| Severity | Category | Location | Claim | Verdict |
|---|---|---|---|---|
| high | bug | `CardMarks.tsx:324` | Choosing another cell while a Correct is in progress swaps the keyed editor, losing the typed price and reason. | Valid. Carried by T9R2.12 case 9 ("refuse another cell while a Correct is in progress"), not a bug task: a B task would build that case early (main session's decision). T9R2.12's brief names this finding. |
| medium | bug | `CardMarks.tsx:287` | A refused draft on another page is chosen but the grid's page doesn't move, so focus does nothing. | Valid. Carried by T9R2.14 case 2 ("open the first refused key's card, page and editor after a refused save"); its brief names this finding. |
| medium | bug | `CardMarks.tsx:242` | Over 100 drafts: Save Marks does nothing and says nothing. | Doubtful (interim). Carried by T9R2.13 case 9 (W76); its brief names this finding. |
- Run `T9R2.11` (browser-task): unit 226 files, 2636 tests; integration 137 files, 294 tests; browser task tier 5 passed (12.9 s); checks 14 of 14. Ports free before and after. No flaky case failed. `run-complete.sh`: run complete.

## T9R2.12 The cell editor

- Base `b3fd296d`, commit `7bc99e1a`. Standard (decision 122). 9 cases in `CardMarks.test.tsx` under "the cell editor (P160)" (`tdd-log/T9R2.12.md`). Case names drop apostrophes for `-t` filtering.
- Case 9 ("refuse another cell while a Correct is in progress"): real red, then green. It closes T9R2.11's ocr finding (`CardMarks.tsx:324`): `CardMarks` has its own `choose` (passed to `MarksGrid` as `onChoose`); while a Correct holds typed values it refuses another cell, keeps focus in the correction and says "Save or cancel the correction to choose another cell." until the correction ends. Covered routes: focusing an input cell, pressing a button cell, paging (already held with W80). Price and Reason survive; Cancel frees the grid.
- First-run passes, cases 1 to 8, each mutation-checked: case 1 (editor never opens), 2 (Cancel does nothing), 3 (saves bind at 'None'), 4 (Withdraw on every cell), 5 (own Trade not filtered from "also held by"), 6 (settlement note on any cell), 7 (`MarkEntry` never sets its conflict), 8 (choosing discards every draft). Reason: T9R2.11's stand-in `CellEditor` already was the planned editor; only its comment changed. Case 7's first run failed on the test (two "$52.25" texts); assertion fixed.
- Not built: the "needed" look on the Review Date's inputs (no case in T9R2.12 or section 1.2 calls for it).
- New words not in an approved row: "Save or cancel the correction to choose another cell." (Marks grid; nearest W80). No P137 change.
- Checks: typecheck, `tsc6`, lint, `lint:deps` pass; `src/ui` 87 files, 1220 tests. Browser: `e2e/d4/gaps`, `d4/review`, `d5r/marks`, `d5r/responsive-a11y` 9 passed; d7 and d4 folders 59; d9ar 79 (4 skipped). No spec edited.
- ocr (`ocr/T9R2.12-7bc99e1a.json`): 2 findings.

| Severity | Category | Location | Claim | Verdict |
|---|---|---|---|---|
| medium | bug | `CardMarks.tsx:336` | The Instrument-link branch calls `setChosen` directly, so a link into the open card during a Correct loses the typed price and reason. | Valid. Bug task **T9R2.12-B1**. |
| medium | bug | `CardMarks.tsx:210` | An open Correct with nothing typed doesn't refuse another cell; the empty form closes. | Doubtful (a product call; matches the card hold). Asked as Q1 in `DECISIONS-PENDING.md`; parks only this finding. |

### T9R2.12-B1 A link is refused while a Correct is in progress

- Case: "it should refuse a link to another Instrument of the open card while a Correct is in progress". Commit `451b95b0`: red (the link replaced the correction's editor), then green; a focus assertion added and re-run green. `correctionHolds` and `focusCorrection` pulled out of `choose`; the link branch uses them (state flag `linkRefused`). Refused and conflicted saves' `setChosen` untouched (T9R2.14). First-run passes: none. `src/ui` 87 files, 1221 tests; `d5r/marks`, `d5r/sliders`, `d4/review` 8 passed.
- ocr (`ocr/T9R2.12-B1-451b95b0.json`): **No findings.**
- Run `T9R2.12` (browser-task; after B1's clean ocr): unit 226 files, 2646 tests; integration 137 files, 294 tests; browser task tier 5 passed (13.1 s); checks 14 of 14. Ports free before and after. No flaky case failed. `run-complete.sh`: run complete.

## T9R2.13 Drafts belong to the Review

- Base `451b95b0`, commit `2fabe68c`. Standard (decision 122). 11 cases plus helper unit cases (`draftCount`, `newestTrade` in `review-drafts.ts`; `instrumentOf` in `held-review.ts`), each red then green (`tdd-log/T9R2.13.md`). Case 3 ran before case 1 (case 1 needs a second card open while a draft exists).
- Coded ahead of red (the subagent's own report): the production code for cases 2, 6, 7, 8 and 9 was written with the first lift of the drafts; for each it removed only that code, got a genuine red, and restored it. Recorded against the "never code ahead of red" rule; the reds are genuine.
- First-run passes, mutation-checked: case 4 (the old unsaved-work case renamed; mutation `if (false && held)`), case 5 and its next-Trade variant (mutation: the after-Action hold counts Mark drafts), case 10 (`draftsHeld` false), case 11 (`pagingHeld` with `|| count > 0`).
- Closes T9R2.11's ocr finding (`CardMarks.tsx:242`): the silent TooMany return is gone; `useMarkDrafts` remembers a Save pressed over the limit and shows W76 ("Save Marks takes up to 100 at once; 112 are entered. Clear 12, then save.") in the status header and under the open card's grid, following the live count.
- New: `src/ui/screens/useMarkDrafts.ts` (`useMarkDrafts({ latest, onResult, onSave })` returning `MarkDrafts`). `CardMarksProps`: `onSaveMarks` replaced by `markDrafts`, `tradeName` added; `ReviewCard`: `markDrafts`, `nameOf`; `MarksGrid` gains required `typedIn(key)`. Save Marks' Trade: the open card's, else the newest draft's (P157).
- Changed beyond the listed lines: `e2e/d4/card-helpers.spec.ts` 142 moved to an Action value (it held with a Mark draft), like 56 and 87; five `ReviewView.test.tsx` cases and one `CardMarks.test.tsx` case look inside the Marks panel (the header adds a second Save Marks and Discard). Dirty reporting: forms report synchronously; drafts from an effect that skips the first run (an effect-only version made a ReviewCard case flaky).
- For T9R2.14 (the subagent's note): drafts of a Trade a refresh removes are no longer dropped and no "not kept" notice fires (nothing calls `keepOnly`); the first refused key is revealed only if it is in the open card's grid.
- Words: W75 as approved; "Unsaved Marks" (group name), "Save Marks (n)", "Discard" in the header (existing words). No P137 change.
- Checks: typecheck, `tsc6`, lint, `lint:deps` pass; `src/ui` and `src/app` green. Browser: d4 card-helpers and d5r 25 (one failure, line 142, fixed); d4 card-helpers, review, no-save, gaps 12; d7 (with d7p, d7s, d7sp) and d9ar 112; after the dirty-reporting change d5r/marks, d4 card-helpers, update, no-save 15.
- ocr (`ocr/T9R2.13-2fabe68c.json`): 8 findings (rows 4 and 5 are one defect, rows 7 and 8 one defect).

| Severity | Category | Location | Claim | Verdict |
|---|---|---|---|---|
| high | bug | `CardMarks.tsx:231` | The reveal after a refused save or Conflict skips `correctionHolds`, so a Correct in progress loses its values. | Valid. Bug task **T9R2.13-B1**. |
| medium | bug | `ReviewView.tsx:571` | Header Save Marks with an owed card open passes that Trade to `postMarksReview` (ChangedDuringAssembly); Marks commit but the Review never refreshes. | Valid. Bug task **T9R2.13-B2** (scope: an owed card is not P157's open card; use the newest draft's Trade). |
| medium | bug | `ReviewView.tsx:170` | With no walked card open, a failed header save shows nothing and offers no Refresh. | Valid. Bug task **T9R2.13-B3**. |
| medium | bug | `ReviewView.tsx:284` | A refused key in a closed Trade isn't revealed (the owning card isn't opened). | Valid, planned: T9R2.14 case 2 (A294). Not a bug task. |
| medium | bug | `CardMarks.tsx:228` | A card that mounts after the reveal skips it. | Same defect as the row above; T9R2.14 case 2. |
| medium | bug | `CardMarks.tsx:232` | A refused key shown here as a mirrored chip can't take focus (the draft belongs to another Trade). | Valid, planned: T9R2.14 case 2. |
| medium | bug | `useMarkDrafts.ts:56` | Drafts aren't reconciled on refresh (`keepOnly` uncalled): orphan keys stay in the count, the hold and Save Marks. | Valid, planned: T9R2.14 cases 3 and 4 (the gap predates this commit). |
| medium | bug | `ReviewView.tsx:284` | An Empty refresh removes the status header, leaving orphan drafts holding the page with no Save or Discard. | Same defect; T9R2.14 cases 3 and 4. T9R2.14's brief asks for the Empty-refresh scenario. |

### T9R2.13-B1 A Save Marks reveal keeps a Correct in progress

- Commit 3cee0320. Case "it should keep a Correct in progress when a Save Marks result reveals another cell": red (the editor moved to the rejected key), then green. The reveal asks `correctionHolds(reveal.key)` first; when it holds, it doesn't choose the key or move focus, and a `revealHeld` state with an effect returns focus to the correction (`focusCorrection`, as `choose()` does). The trader sees: the Correct keeps its price, reason and cursor; the editor stays; the refused cell stays marked invalid with its draft kept; its issue shows once chosen. Conflict goes through the same reveal (not run separately). First-run passes: none. `src/ui` 87 files, 1233 tests; `d5r/marks`, `d4/review` 6 passed.
- ocr (`ocr/T9R2.13-B1-3cee0320.json`): **No findings.**

### T9R2.13-B2 Header Save Marks with an owed card open

- Commit 5159ff2a. Case "it should save Marks from the status header while an owed card is open and refresh the Review" (`ReviewOwed.test.tsx`): red (`DailyReview.save` got the owed card's Trade `t-x`, not the newest draft's `t-w`), then green. `saveMarks` in `ReviewView.tsx` uses the open card's Trade only for a walked card, else `newestTrade`. With an owed card open, the saved Review no longer swaps the open card or advances a panel; the held Review refreshes through `apply`. First-run passes: none. `src/ui` 87 files, 1234 tests; `e2e/d5r` and `d4/review` 17 passed.
- ocr (`ocr/T9R2.13-B2-5159ff2a.json`): 2 findings, both **Wrong** (dismissed): they read the fix backwards, expecting the owed card's Trade (`t-x`); that Trade returns ChangedDuringAssembly from `postMarksReview` (`daily-review.ts` 924 to 933), which is the defect B2 fixes.
- Reviewer note: P157's text still says "the open card's Trade"; this fix reads an owed card as not P157's open card. That reading is the main session's, queued for the user as Q2 in `DECISIONS-PENDING.md`. Also noted: with no newest draft the fallback is `openId`, unreachable since the header shows only while a draft exists.

### T9R2.13-B3 A failed header Save Marks shows with no walked card open

- Commit 8264ab91. Case "it should show a failed Save Marks and its Refresh in the status header when no walked card is open": red (no alert), then green. The failure shows in the open walked card's Marks panel as before, and in the status header only when no walked card is open (none, or an owed card); never both. Header Refresh: with an owed card open, `refreshTrade`; with none, `reopen` then `apply`. `SaveFailure({ drafts, onRefresh })` exported from `CardMarks.tsx`; `Status` and `UnsavedMarks` take `failureHere`, `onRefresh`. No new words. First-run passes: none. Not covered (subagent's note): a walked card open with its Marks panel collapsed shows the failure only in the hidden panel. The subagent added the case with `write()` instead of `edit()` (a working-rule slip, reported by it). `src/ui` 87 files, 1235 tests; `e2e/d5r` and `d4/review` 17 passed.
- ocr (`ocr/T9R2.13-B3-8264ab91.json`): 1 finding.

| Severity | Category | Location | Claim | Verdict |
|---|---|---|---|---|
| medium | bug | `ReviewView.tsx:585-587` | The header's no-card Refresh (`refreshHeld`) calls `reopen()` without the `refreshing` barrier `refreshTrade` uses, so a card opened while it is pending reads its Trade under the old binding (shown as Unavailable with Retry). | Valid. Bug task **T9R2.13-B4**. |

### T9R2.13-B4 The header's Refresh uses the refreshing barrier

- Commit 6580102d. Case "it should let a card opened during the status header's Refresh read its Trade from the refreshed Review": red (`getTrade` ran under the old binding while the header's Refresh was pending), then green. `reopenAndApply` extracted from `refreshTrade` (reopen, apply, registered in the `refreshing` barrier); `refreshTrade` and `refreshHeld` both call it (one barrier). First-run passes: none. `src/ui` 87 files, 1236 tests; `e2e/d5r` and `d4/review` 17 passed.
- ocr (`ocr/T9R2.13-B4-6580102d.json`): **No findings.**
- Run `T9R2.13` (browser-task; after B1, B2, B3 and B4): unit 226 files, 2661 tests; integration 137 files, 294 tests; browser task tier 5 passed (12.1 s); checks 14 of 14. Ports free before and after. No flaky case failed. `run-complete.sh`: run complete.

## T9R2.14 Links, focus after a refused save, kept drafts, resizing

- Base `6580102d`, commit `50b411d1`. Standard (decision 122). Cases in `CardMarks.test.tsx` under "links, refused saves, kept drafts and the turn (T9R2.14)": the 5 planned plus 2b (a refused key shown as a mirrored chip goes to the draft's own card, with focus), 4b (notice when the Trade stays but its key left) and 4c (an Empty refresh drops every draft and releases the page) (`tdd-log/T9R2.14.md`).
- Reds: case 2 (no Marks region), 3 (a chip, not an input), 4 (no status), 5 (focus fell to the body; the focus assertion was added after a real-browser measurement showed the loss, then green).
- First-run passes, mutation-checked: case 1 (built by T9R2.11; mutation on `linkedCell`'s date; a first mutation on the chosen key still passed because focusing the input chooses it), 2b (built by case 2; `revealCard` not opening a closed owner), 4b (wording written with case 3's reconcile; `stillHeld` inverted), 4c (built by the reconcile; keep test forced true).
- Closes the carried ocr findings: a refused key in a closed Trade (`useMarkDrafts` calls `onReveal(tradeId)`; `ReviewView.revealCard` opens the card on Marks via `openOnMarks` with `flushSync`, `Go.keepFocus`); a card mounting after the reveal (`Reveal` carries `tradeId`, `handledReveal` starts at 0, `settleReveal`); a key on another page (`MarksGrid` jumps to the chosen earlier cell's page); a mirrored chip (the key goes to the card of the Trade the draft was typed in, where it is an input; the draft isn't moved: the subagent's reading of A294's "its card opens", recorded); drafts not reconciled (`reopenAndApply` calls `markDrafts.reconcile`, using `keepOnly` with `listedStanding(...) !== undefined` and new `holdersOf`; an Empty refresh drops all, the header goes and `onDirtyChange` reports false). B1's hold kept: a reveal while a Correct or form holds the open card shows the hold message.
- Extra change: `SessionGrid` (T9R2.9) returns focus to the control that held it across a turn. Also touched beyond the list: `held-review.ts`, `ReviewCard.tsx`.
- Types: `Reveal.tradeId`; `MarkDrafts.settleReveal`, `reconcile`; `useMarkDrafts` option `onReveal`; `held-review.ts` exports `listedStanding` and `holdersOf(review, key)`; `Go.keepFocus`.
- Words: the approved "<Trade name> is no longer in this Review, so what you entered for it was not kept." verbatim when the Trade is gone. New, not in an approved row: "What you entered for <Trade name> was not kept, because the Review no longer lists it." (Trade still in the Review, key gone; nearest the approved "not kept" notice). No P137 change.
- Browser: d5r 16, d4 (review, gaps, card-helpers, no-save, update) 12, d7 33, d9ar 79 (4 skipped); no spec edited. Real-browser turn (deleted scratch spec, 1280 to 390 to 1280 px): drafts (52.00, 51.00), the Fri Oct 9 editor and "Save Marks (2)" survived; focus stays on the input after the fix (was the body before).
- ocr (`ocr/T9R2.14-50b411d1.json`): 1 finding.

| Severity | Category | Location | Claim | Verdict |
|---|---|---|---|---|
| medium | bug | `ReviewView.tsx:370` | After a refresh moves a draft from Trade A to B, a later drop's notice names B, not A where it was typed. | Wrong (dismissed, main session): the plan moves the draft to the other Trade (T9R2.14 case 3, "moving it to that Trade"; T9R2.13 case 2 moves the input on a press), after which it shows and is typed in B's grid; naming B matches where the trader sees it. |
- Run `T9R2.14` (browser-task): unit 226 files, 2669 tests; integration 137 files, 294 tests; browser task tier 5 passed (13.1 s); checks 14 of 14. Ports free before and after. No flaky case failed. `run-complete.sh`: run complete.

## T9R2.15 Node integration suite

- `tests/integration/d9r2/`: `open.test.ts` (I9R2.1), `save-many.test.ts` (I9R2.2, 3 cases), `correct-earlier.test.ts` (I9R2.3), `query-count.test.ts` (I9R2.4), `support.ts` (the shared book: R-CORV-D, a CORV stock Trade opened Thu 11-12 and a NEWX Trade opened on the Review Date, cloned from R-AXIO-U). Light: tests only, first-run passes, no mutation check required; each test's comments say what it would catch.
- `npm run test:integration -- d9r2`: 4 files, 6 tests passed.
- `acceptance-commands.sh`: the three integration rows (AC-RESP-001, AC-REV-005 with ADR 0011, AC-PERF-001) pass; the six rows for `e2e/d9r2` specs fail until T9R2.16 ("no tests").
- Checks: typecheck, tsc6, lint:deps exit 0; lint 0 errors (2 existing warnings in OwedDebtItem.tsx).
- (main session) Base `50b411d1`, commit `90e3605d`. Light (decision 122): no ocr, no suite run. `npm run test:integration -- d9r2`: 4 files, 6 tests pass, no production change. Acceptance: the three integration rows pass (AC-RESP-001, AC-REV-005 with ADR 0011, AC-PERF-001); the six e2e rows wait for T9R2.16.

## T9R2.16 Browser suite

- Structural, Light (decision 122): tests only, no ocr, no suite run. `e2e/d9r2/`: `support.ts` (adds only `createGapFixture`: XYZ shared by T-A, held since Mon Aug 31, and T-F, bought Mon Oct 12; at Wed Oct 7 17:00 T-A is Marked for Tue Oct 6 and its Review Date Mark is acknowledged; 27 earlier sessions without a Mark in the Mon Oct 12 Review; re-exports D9A-R's helpers, so `markRow`, `enterMark`, `acknowledgeMark`, `createCardFixture`, `saveMarksOf`, `optionMarkRow`, `saveMarkPrice`, `observationsOf`, `launchTouchAt` are the existing ones), `history.spec.ts` (B9R2.1), `grid.spec.ts` (B9R2.2), `drafts.spec.ts` (B9R2.3), `editor.spec.ts` (B9R2.4), `responsive-a11y.spec.ts` (B9R2.5). No production code, tooling or earlier spec changed.
- `.claude/scripts/with-browser-lock.sh npx playwright test e2e/d9r2` on 5175: 12 passed (history 1, grid 2, drafts 3, editor 3, responsive-a11y 3). Ports 5175, 9341, 9342 free before and after. `dist` was rebuilt by `test:e2e:specs` before the first run; no production file changed after.
- `.claude/scripts/acceptance-commands.sh plan/D09R2-review-marks-grid.md`: exit 0, 9 commands checked, 0 failed (every e2e/d9r2 row now runs its tests).
- Checks: typecheck, tsc6, lint:deps exit 0; lint 0 errors (2 existing warnings in OwedDebtItem.tsx).
- Test choices recorded: (1) "one `savedAt`" is proved with the store `revision` as well, because the pinned clock gives every save the same `savedAt`; (2) "leaving the page asks" is proved through the other-tab channel the app has (the Restore preview in a second tab says "Another tab has unsaved changes. They will be lost when the journal is replaced."); (3) a mixed column is the option Trade O-C with XYZ Marked and its Call not on Thu Oct 8, which also proves Enter's order across two rows; (4) the first-refused-cell step types the refused prices in grid order (see the finding below).
- Findings for the main session (no production code changed): (a) A294 says the first refused key "in the grid's order", but `useMarkDrafts` reveals `found[0]`, the first refused in the order the drafts were first entered: with Aug 31 typed before Thu Oct 8 and both refused, Aug 31 (page 2) opens, not Thu Oct 8. (b) At 390 px T-A's grid, which holds an "Acknowledged Unavailable" cell, scrolls sideways inside its own region (scroll width 359 px in a 324 px region: the session column 124 px and a 235 px cell); the page itself does not, and a grid without that cell (T-F's) fits. Neither is asserted as failing.
- (main session) Base `90e3605d`, commit `51ac08cd`. Light (decision 122): no ocr, no suite run. `e2e/d9r2` 12 passed (history 1, grid 2, drafts 3, editor 3, responsive-a11y 3), run twice; `acceptance-commands.sh`: 9 commands, 0 failed. No production change.
- Subagent notes (not bug tasks; for the final report and the critic gate to confirm or not): (1) A294 says the first refused key "in the grid's order", but `useMarkDrafts.ts` opens the first refused key in first-entered order (an Aug 31 draft typed before Thu Oct 8 opens on page 2); the spec types in grid order. (2) At 390 px a grid holding an "Acknowledged Unavailable" cell scrolls sideways inside its own region (359 px in 324 px); the page doesn't scroll. (3) The app has no `beforeunload` prompt; the spec covers "leaving the page asks" through the other tab's Restore warning. (4) The pinned clock gives every save one `savedAt`, so the drafts spec also checks one store revision. (5) The subagent appended this section with `write()` instead of Edit (a working-rule slip it reported).

## T9R2.17 The gate

- Run `T9R2.17` (browser-full, before critic-1; base `31d78fe4`): unit 226 files, 2669 tests; integration 141 files, 300 tests; browser-1 126 passed (5.4 m), browser-2 80 (5.2 m), browser-3 57 (4.5 m), browser-4 130 passed, 4 skipped (6.7 m); checks 14 of 14. Ports free before and after. No flaky case failed. `run-complete.sh`: run complete.
- `acceptance-commands.sh plan/D09R2-review-marks-grid.md`: exit 0.

### Critics

| Critic | Brief | Tokens | Tool calls | Time | Result |
|---|---|---|---|---|---|
| critic-1 (`critic-1.md`) | `critic-brief.md` template, D9R2 flows C9R2.1 to C9R2.6 | 185,462 | 178 | 11 min 53 s | FAIL: 1 high, 4 moderate, 1 low |

- critic-1 defects: 1 high (the cell editor unreachable by keyboard except the page's last cell) → **T9R2.17-B1**; 2 moderate (no focus after a conflict-refused save, A294) → **T9R2.17-B2**; 3 moderate (focus falls to the body when the pressed control disappears: "Can't get a price", Correct, Withdraw, Next page) → **T9R2.17-B3**; 4 moderate (a one-leg Trade's turned grid scrolls sideways and clips at 390, 375, 320 px; a 35 px chosen cell at 320; P161) → **T9R2.17-B4**; 5 moderate (the editor has no title or box naming its cell, and an off-page cell's editor stays open after paging) → **T9R2.17-B5**; 6 low → tech debt item 1. It confirms T9R2.16's note on the 390 px overflow (defect 4); the refused-save order was not tested.
- Scope decision for B1 (main session, recorded): each cell stays one tab stop (research page, section 6, option B); Tab from a chosen cell goes into its editor's controls, and Tab past the editor's last control goes to the next cell; Enter keeps A295's order. Recorded here for the user's review.

### T9R2.17-B1 The cell editor by keyboard (critic-1 defect 1, high)

- Commit f3f3c864. Three cases in `CardMarks.test.tsx` (Tab from a chosen Review Date cell to "Can't get a price", then the next cell, Shift+Tab back; Tab from a chosen earlier cell to Correct while later cells exist; Tab from a chosen acknowledged Review Date cell to Withdraw), each red then green; two first green runs failed on the tests' assumption about the editor's first control (a Trade link, or Price before Withdraw), fixed in the tests. A Tab handler on the Marks section sends Tab from the chosen cell into the editor (`data-cell-editor` wrapper) and from its last control to the next cell; Shift+Tab from the editor's first control returns to its cell. A saved (button) cell is chosen by pressing it, as before; Tab enters the editor only from the chosen cell. First-run passes: none. `src/ui/screens` 632 tests; e2e d9r2 12, d5r 15, d4 review 1, gaps 1.
- ocr (`ocr/T9R2.17-B1-f3f3c864.json`): 2 findings.

| Severity | Category | Location | Claim | Verdict |
|---|---|---|---|---|
| medium | bug | `CardMarks.tsx:327` | Tab from the editor's last control focuses the next cell, but a button cell isn't chosen on focus, so Tab loops between the old editor and that button. | Valid. Bug task **T9R2.17-B6**. |
| medium | bug | `CardMarks.tsx:327` | After paging away from the chosen cell, Tab from its editor's last control jumps to the first grid cell (`indexOf` -1). | Valid. Carried by **T9R2.17-B5** (an off-page cell's editor closes after paging, which removes the case); B5's brief asks for a Tab-after-paging check. |

### T9R2.17-B2 Focus after a conflict-refused save (critic-1 defect 2, moderate)

- Commit 91d98afb. The conflict reveal now focuses the first conflicted key's input (`show(moved[0].key, true)` in `useMarkDrafts.ts`, with a draft-input fallback in `CardMarks.tsx`).
- ocr (`ocr/T9R2.17-B2-91d98afb.json`): 1 finding, low, style only (a nested ternary at `CardMarks.tsx:268`) → tech debt item 2. The first two ocr runs stalled on ocr's usage limit (00:12 to 00:40) and were stopped by the user; the third run is complete.

### T9R2.17-B3 Focus when the pressed control disappears (critic-1 defect 3, moderate)

- Commit 0ed456f4. Four cases in `CardMarks.test.tsx` ("focus when the pressed control goes"): "Can't get a price" to Reason, Correct to the correction's Price, Withdraw to the cell, and Next page or Previous page going to the other page button. Each red (focus on the body), then green. `MarkEntry` focuses its first field when any of its forms opens; `CellEditor` focuses the cell after a Withdraw. First-run passes: none. e2e d9r2, d5r, d4 review, d4 gaps: 30 passed.
- Subagent note (not a bug task): Cancel on the draft reason form and on the Correct form also removes the pressed button, and focus still falls to the body there. Not in critic-1's report; left for critic-2 to confirm or not.
- ocr (`ocr/T9R2.17-B3-0ed456f4.json`): no findings (rerun after the usage limit).

### T9R2.17-B4 A one-leg Trade's grid at phone widths (critic-1 defect 4, moderate)

- Commit 51a03672. Browser case in `e2e/d9r2/responsive-a11y.spec.ts` at 390, 375 and 320 px (T-A, touch, the acknowledged cell chosen): no region overflow, nothing clipped, body cells at least 44 px. Red at 35, 50 and 105 px overflow (the critic's numbers), then green. The fix is CSS in `session-grid.css`, limited to the turned layout (text wraps; controls fill their cell). This also covers T9R2.16's 390 px note. First-run passes: none. e2e d9r2 33 passed; the run exited 0.
- ocr (`ocr/T9R2.17-B4-51a03672.json`): no findings.

### T9R2.17-B5 The editor's title and box; an off-page editor closes (critic-1 defect 5, moderate)

- Commit 7f121f43. Three cases in `CardMarks.test.tsx`: the editor's title "XYZ Mark, Mon Oct 12 · Missing" (and "· Can't get a price" once held); paging away closes the editor and keeps its draft (Save Marks (1) stays; the value is back after Previous page); and the ocr case on B1, Tab after paging away no longer goes to the first grid cell. Each red, then green. Paging now clears the chosen cell when its date isn't on the shown page, and `throughEditor` returns early with no editor, which closes ocr's finding on B1 (checked: the case is in the commit). The title is `aria-hidden`, so the region keeps its accessible name. Wording: an Available cell's title leaves out the price (`words-changed.md`). First-run passes: none. e2e d9r2, d5r, d4 review, d4 gaps: 33 passed.
- ocr (`ocr/T9R2.17-B5-7f121f43.json`): no findings.

### T9R2.17-B6 No Tab loop at a saved or acknowledged cell (ocr on T9R2.17-B1)

- Commit 6303688a. Case "should reach Save Marks by Tab past a saved cell that follows the chosen cell" (checked: the case is in the commit). Red (Tab never reached Save Marks in 25 presses), then green. Two earlier drafts of the case passed without the fix and were not counted as red. Fix: Tab from the editor's last control to a button cell focuses and presses it, so it becomes the chosen cell and the editor follows. First-run passes: none. e2e d9r2, d5r, d4 review, d4 gaps: 33 passed.
- ocr (`ocr/T9R2.17-B6-6303688a.json`): no findings.

### Runs after the gate fixes

- Main-session decision (recorded): the `browser-task` run each bug task would have is folded into one `browser-full` run after B6, since the full tier covers every browser-task spec and each subagent ran the Review's browser specs. That run then serves as the one full run before critic-2.
- Run `T9R2.17-fixes1` (browser-full, HEAD 7b297dad): unit 226 files, 2681 tests; integration 141 files, 300 tests; browser-1 1 failed, 125 passed (5.4 m); browser-2 1 failed, 79 passed (5.2 m); browser-3 57 passed (4.5 m); browser-4 1 failed, 132 passed, 4 skipped (6.8 m); checks 14 of 14. `run-complete.sh`: run complete. **Failed**: B4.13 (`e2e/d4/responsive-a11y.spec.ts:255`) and B7.6 (`e2e/d7/marks-zero.spec.ts:14`), strict-mode text matches on B5's editor title; B9.11 (`e2e/d9/meter-a11y.spec.ts:81`, "1280 px list: meter 1 width" 0). The runner's first hand-back was a placeholder sent by mistake; its full report followed.

### T9R2.17-F1 The run's three browser failures (follow-on from run T9R2.17-fixes1)

- Commit 66c370f5. The editor title is no longer page text: an empty `div.cell-editor-title` with `data-title`, shown by CSS `::before` with `content: attr(data-title) / ''` (visible, hidden from screen readers, as before). B4.13 and B7.6 pass with their locators unchanged (red: the fixes1 run). Changed case: B5's "should title the editor box with its cell name and status" reads `data-title` instead of `getByText`, with the same two strings. B9.11 did not reproduce (passed in two runs of its file); no code changed for it; recorded as an unexplained single failure for the final report, watched in the next run. Browser: 42 passed, then `e2e/d4` plus the meter file 29 passed.
- ocr (`ocr/T9R2.17-F1-66c370f5.json`): no findings. Reviewer note: the unit case checks `data-title`, not that the title renders; the critic's look at the editor covers that.
- Run `T9R2.17-fixes2` (browser-full, HEAD f4620535, the one full run after the last fix): unit 226 files, 2681 tests; integration 141 files, 300 tests; browser-1 126 passed (5.3 m), browser-2 80 (5.2 m), browser-3 57 (4.6 m), browser-4 133 passed, 4 skipped (6.9 m); checks 14 of 14. No flaky case failed; B9.11 passed. Ports free before and after. `run-complete.sh`: run complete.
- `acceptance-commands.sh plan/D09R2-review-marks-grid.md`: 9 commands, 0 failed, exit 0.
