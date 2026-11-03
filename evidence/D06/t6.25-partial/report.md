# T6.25 on the partial dataset: report

Written by the main session from the subagent's final report on 2026-11-03. The subagent's own Write of this file was refused ("subagents should return findings as text").

## Commits

All on `claude-opus-5.5`, not pushed.

| Commit | What it holds |
|---|---|
| `2120a29f` feat(bench): T6.25-P1 | `tools/bench/partial.ts` with the pure helpers `countStored`, `lastSessionOf` and `reviewMembersOf`. Three red/green cases in `tools/bench/compare.test.ts`. `tools/bench-partial.ts` (`npm run bench:partial -- <dir>`). `bench-run.ts --partial <dir>`. |
| `4e46b2e9` fix(bench): T6.25-P2 | Falls back to timing first Action saves when too few cards have a saved Action, and words the report for a partial dataset. |
| `cabe50e4` docs(plan): revision 33, decision 73 | Tagged `claude-opus-5.5-plan-r33`. |
| `ccb187b5` docs(evidence) | `bench.md`, `t6.25-partial/` and the generator logs. The logs were added with `git add -f`, because `*.log` is git-ignored. |

## Dataset

- **Last stored session:** session 784, 2027-02-17. The log's last line shows 775, because it prints only every 25 sessions.
- **That day's Review is part-way.** All 150 Marks and all its Position Changes are saved, but only 18 of its 99 Actions.
- **As-of instant:** 2027-02-17T21:35:00Z, which is the close plus 35 minutes (the generator's authoring rule).

The counts, against plan section 1.4:

| Record | Partial dataset | Planned |
|---|---|---|
| Trades | 15,743 | 25,000 |
| Closed Trades | 15,624 | 24,700 |
| Open Trades | 99 | 200 |
| Planned Trades | 20 | 100 |
| Position Changes | 62,683 | about 100,000 |
| Executions | 125,340 | about 200,000 |
| Marks | 118,776 | about 190,000 |
| Actions | 78,317 | about 126,000 |
| Debts | 15,485, of which 41 Outstanding | not counted |

## Results (run 4, clean)

The gated reads both pass:

| Read | p95 | Limit | D5 | D5R2 |
|---|---|---|---|---|
| Cold | 252.7 ms | 2,500 ms | 104.8 ms | 96.2 ms |
| Warm | 208.7 ms | 1,500 ms | 43.6 ms | 47.3 ms |

The ungated figures:

| Measure | Median | p95 |
|---|---|---|
| Closed tab to first page | 330.5 ms | 332.0 ms |
| Open the first card | 517.7 ms | 531.3 ms |
| Trade Action save, warm (5 edits) | 682.2 ms | 688.5 ms |
| Trade Action save, cold (3 first saves) | 692.2 ms | 694.5 ms |

The correctness comparisons were equal, read before and after the timed renders:
- the first Closed page;
- the walk (99 cards);
- the owed group (18 cards).

The Open rows' figures, the walk's attention order and the due reflections (19) are compared with the first render. They prove stability, not independent correctness.

There is no Save Marks timing, because no Instrument is missing its as-of Mark.

- **Host:** Apple M4 Max, 16 cores, 64 GiB.
- **Engine:** Chromium 153.0.8010.12, Playwright 1.63.0.

## Run history

| Run | Cold p95 | Warm p95 | Note |
|---|---|---|---|
| 1 | 256.0 ms | 211.2 ms | No cold saves: only 5 cards had a saved Action. |
| 2 | 252.7 ms | 209.6 ms | Added the first-save fallback. |
| 3 | 269.8 ms | 210.4 ms | Overlapped the main session's Chromium probe. Kept as `bench-run3-overlapped.*`. |
| 4 | 252.7 ms | 208.7 ms | Clean. This is the run of record. |

## Save growth (from `bench-generate-v5.log`)

| Sessions | `review.save` per save | `review.getTrade` per Action | `review.open` per session |
|---|---|---|---|
| 25–50 | 0.055 s | 3.6 ms | 0.04 s |
| 175–200 | 0.186 s | 13.1 ms | 0.04 s |
| 475–500 | 0.455 s | 30.7 ms | 0.16 s |
| 750–775 | 0.753 s | 54.2 ms | 0.28 s |

A save costs about 1 ms more for each session of history.

## Cause, verified by the main session the same day

Chromium's IndexedDB (LevelDB backend) leaves the old index entry behind when a record's index key changes. It deletes such stale entries only when a read-write transaction iterates over them, and the Review's reads are all read-only. So the Open range of `trades.byLifecycleActivity` accumulates one stale entry for every Position Change and every Trade that has left Open.

These were measured on a copy of this snapshot. The scripts are in the main session's scratchpad (`stale-index-probe.mjs` and `sweep-probe.mjs`).

| Query, same rows | Snapshot | Fresh copy of the same documents |
|---|---|---|
| `byLifecycleActivity` Open (99) | 168 ms | 1.6 ms |
| `byLifecycle` Open (99) | 75 ms | 1.6 ms |
| `byLifecycle` Planned (20) | 73 ms | 0.3 ms |
| `byLifecycleTerminal` Closed (51) | 1.0 ms | 1.2 ms |

- **Read-only reads don't clean up.** Seven read-only reads in a row stayed at 168 ms.
- **One read-write pass does.** It took 1,000 ms over the Open range, and afterwards read-only reads took 31–32 ms and stayed there.
- **This accounts for the save time.** A save scans the Open range about 3–4 times: the binding check, the post-save reassembly, and the next card. That is about 0.5–0.7 s, which matches the 0.73 s per save in the log.

The probe scripts are kept as `probes/*.mjs.txt` so lint skips them. To run one, copy it to a `.mjs` file outside the repository.
