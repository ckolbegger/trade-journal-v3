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
