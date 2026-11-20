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
