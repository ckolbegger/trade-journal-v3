# D09AR TDD log, T9AR.3-B1

One file per task (decision 111), so parallel lanes never edit one file. Each row is one single-case run; see `../tdd-log.md` for the rules.

| T9AR.3-B1 | should carry the estimated odds and the extremes' weight in each replayed session's figures | red | `npx vitest run src/domain/trade-analysis/replay-series.test.ts -t "should carry the estimated odds and the extremes' weight in each replayed session's figures"` | exit 1; Tests  1 failed, 27 skipped (28) | Error: expected a Value, got undefined  |
| T9AR.3-B1 | should carry the estimated odds and the extremes' weight in each replayed session's figures | green | `npx vitest run src/domain/trade-analysis/replay-series.test.ts -t "should carry the estimated odds and the extremes' weight in each replayed session's figures"` | exit 0; Tests  1 passed, 27 skipped (28) |  |
| T9AR.3-B1 | refactor | refactor | none | no change | Nothing to refactor; the test sits in replay-series.test.ts, name unchanged. |
