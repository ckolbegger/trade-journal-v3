# D09R2 benchmark (decision 114)

Run once after the gate closed (critic-3 PASS), alone, on port 4175, in this worktree, HEAD de832d99, 2026-11-21. Logs: `evidence/D09R2/bench-logs/`.

| Step | Exit | Time | Result |
|---|---|---|---|
| `npm run build:bench` | 0 | under 0.1 min | built |
| `npm run bench:generate` | 0 | under 0.1 min | cached dataset reused |
| `npm run bench:setup` | 0 | 1.8 min | |
| `npm run measure:capacity` | 0 | 1.9 min | usage 0.244 of the projection; second Restore peak 0.499 × M (prepare 101.5 s, apply 8.9 s) |
| `npm run bench:verify-capacity` | 0 | under 0.1 min | restored usage 0.244 × projection (limit 1.10); peak 0.499 × M (limit below 3); 0.923 × baseline (limit 1.50); OK |
| `npm run bench:run` | **1** | 1.1 min | **Failed**: `tools/bench-run.ts:458` (`timeSaveMarks`) timed out after 30 s looking for the list "Today's Marks" in ADBE's Review card. D9R2 replaced that list with the Marks grid (T9R2.11), so the benchmark's own script can no longer find the Price input. |

Figures measured before the failure: the counts all equal their expected values (Open list 200 rows, first Closed page 50, as-of Review 487 due reflections, walk 200 cards, owed 99, settlement 4 items). Cold Open list: 30 runs, 174.9 to 496.3 ms (first run 496.3, the rest about 195 to 204). Warm: 30 runs, 84.0 to 103.3 ms. Open the first card: 10 runs, 505.1 to 547.5 ms. The Save Marks timing and everything after it did not run.

**Verdict: FAIL** (a command exited 1). Under the rule the session starts no fix; the user chooses (pending decision Q3).

## Second run, after T9R2.17-D1 (the user's answer to Q3), HEAD 3e4b2635

| Step | Exit | Time | Result |
|---|---|---|---|
| `npm run build:bench` | 0 | under 0.1 min | built |
| `npm run bench:generate` | 0 | under 0.1 min | cached dataset reused |
| `npm run bench:setup` | 0 | 1.7 min | |
| `npm run measure:capacity` | 0 | 1.8 min | |
| `npm run bench:verify-capacity` | 0 | under 0.1 min | OK (figures in `bench-logs-2/bench-verify-capacity.txt`) |
| `npm run bench:run` | 0 | 1.5 min | cold p95 199.3 ms (budget 2,500), warm p95 105.7 ms (budget 1,500); every equality check equal; Save Marks 222.0 to 292.0 ms (5 Instruments); Trade Action save 236.8 to 245.6 ms; cold Trade Action save 282.6 to 296.8 ms; one export 23.3 s, one verification 12.8 s; "bench:run OK" |

**Verdict: PASS.** Every command exited 0 and every budget and limit held. `bench:run` writes its report to `evidence/D08/bench.md` (its fixed path); that report is copied to `evidence/D09R2/bench-run-report.md` and the D8 file restored. Logs: `evidence/D09R2/bench-logs-2/`.
