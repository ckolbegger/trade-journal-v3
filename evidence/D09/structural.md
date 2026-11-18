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

## Merge runs

- None yet.
