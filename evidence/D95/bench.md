# D9.5 benchmark (decision 114)

Run once after the T95.67 gate closed, alone, on port 4175, in this worktree, at `c7240f91`. Logs: the session scratchpad's `bench/` folder (not committed).

| Step | Exit | Result |
|---|---|---|
| `npm run build:bench` | 0 | built |
| `npm run bench:generate` | 0 | cached dataset reused |
| `npm run bench:setup` | 0 | |
| `npm run measure:capacity` | 0 | restored usage 216,612,189 bytes = 0.277 × the projection 781,961,664; second Restore prepare 99.1 s, apply 8.9 s, peak 469,501,262 bytes |
| `npm run bench:verify-capacity` | 0 | usage 0.277 × projection (limit 1.10); second Restore peak 0.515 × M (limit below 3); usage 1.164 × the baseline 186,166,742 (limit 1.50); required quota 2,737,548,396 = 3 × M, schema 7 |
| `npm run bench:run` | **1** | Open list (200 rows) and first Closed page (50 rows) equal their expected rows; then `compareDueReflections` (`tools/bench-run.ts:283`) timed out after 60 s waiting for the region "Review status", which D9.5 removed (T95.10; `ReviewView.test.tsx:243` asserts it is gone). `tools/bench-run.ts` reads that block at 282, 346 and 429. No Review-open figure was measured (AC-PERF-001, A326). |

**Result: failed** (the benchmark tool, not a budget). Per decision 114, no fix was started; asked of the user as Q18.
