# D09 final report: Trade replay, option estimates and the Stop-to-Target meter

D9 is **complete**: all 40 planned tasks are done, across stage A, D9A-R, stage B and stage C, each stage's gate closed, and the benchmark passed. Tag `claude-opus-5.5-d9` (`10a4689e`); earlier tags `claude-opus-5.5-d9a`, D9A-R's tag and `claude-opus-5.5-d9b`. Nothing was pushed.

## Stages

| Stage | Report | Gate |
|---|---|---|
| A, the replay chart (T9.1 to T9.19) | `evidence/D09/stage-a-report.md` | Closed 2026-11-18 by the user's decision, critic-2's four defects carried into D9A-R |
| D9A-R, the stage A refactor | `evidence/D09AR/` (its own final report) | Closed |
| B, the option estimates (T9.20 to T9.28) | `evidence/D09/stage-b-report.md` | Closed 2026-11-20, critic-b2 PASS, no defects |
| C, the meter and the Open list's order (T9.29 to T9.40) | `evidence/D09/stage-c-report.md` | Closed 2026-11-20, critic-c1 PASS, no defects |

Tasks, commits and each task's fix rounds are in each stage's report and in the breakdown's Progress section (section 15).

## Last runs

- **Full run `gate-c1`** (`evidence/D09/suite-runs/gate-c1-*.txt`): unit 224 files, 2,592 tests; integration 137 files, 294 tests; browser 126, 79, 57 and 118 passed, 4 skipped; 14 of 14 checks; all passed.
- **Acceptance script:** 9 commands, 0 failed. Section 13's rows are marked covered.
- **Benchmark** (`evidence/D09/bench.md`): pass. Cold p95 197.4 ms of 2,500; warm p95 99.7 ms of 1,500; capacity within every limit.

## Flaky tests seen

- `e2e/d8/responsive-a11y.spec.ts:299` (B8.16): once in run `t9.24` (tech debt item 3).
- `ReviewCards.test.tsx:671`: once in run `t9.29`; fixed by T9.29-D1.
- P138's `TradeList.test.tsx` Ready-state case: once in run `t9.34`.

## Decisions

All answered; **none pending**. Stage C's: SC-Q1 (a), SC-Q2 (a). Stage B's: SB-Q1 (a), SB-Q2 (c), SB-Q3. Stage A's and D9A-R's are in their reports and `plan/D09A-R-decisions.md`.

## Critics and cost

| Critic | Result | Tokens | Tool calls | Time |
|---|---|---|---|---|
| critic-1 (stage A) | FAIL: 1 high, 6 moderate, 1 low | 246,675 | 77 | 12 min 20 s |
| critic-2 (stage A) | FAIL: 1 high, 1 moderate, 2 low (carried into D9A-R) | 191,064 | 74 | 11 min 6 s |
| critic-b1 | PASS: 1 moderate (fixed), 1 low | 131,578 | 167 | 10 min 44 s |
| critic-b2 | PASS, no defects | 166,629 | 157 | 9 min 35 s |
| critic-c1 | PASS, no defects | 155,523 | 98 | 5 min 35 s |

D9A-R's critics are in its own report.

## For the user's review

- **Tech debt** (`evidence/D09/tech-debt.md`): items 1, 2, 3, 5, 6, 8, 9, 10 and 11 stay as tech debt (the user, 2026-11-20); item 4 was decided (T9.28-D2) and item 7 fixed (T9.29-D1).
- **New words:** stages A and B were reviewed on 2026-11-20 (approved, with the two changes carried out as T9.28-D1 and T9.28-D2). Stage C's four entries were approved on 2026-11-20 (the D9 Stage C Words Review page). No new words await approval.
- **Text shortened under P137** (`words-changed.md`): stage A's six entries (T9.14, T9.10, T9.19-B2, three under T9.19-B4), approved 2026-11-20; stage B's T9.28-D2; none in stage C.

## Handoff open questions

None left: SC-Q1 and SC-Q2 answered; the first-run passes and flakes are listed above and in `structural.md`.

## Time

Stage C took about 6 h 30 min against the breakdown's 9 hours serial; stage B about 5 h 30 min against 7; stage A's is in its report (estimate about 7 hours as a swarm).
