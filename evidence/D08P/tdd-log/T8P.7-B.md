# D08P TDD log, T8P.7-B

One file per task (decision 111), so parallel lanes never edit one file. Each row is one single-case run; see `../tdd-log.md` for the rules.

| Task | Case | Phase | Command | Outcome | Failure excerpt |
|---|---|---|---|---|---|
| T8P.7-B | it should give that session an unavailable Trade P&L, not throw, when its frames lack the held Instrument's\. | red | `npx vitest run src/domain/trade-analysis/replay-series.test.ts -t "it should give that session an unavailable Trade P&L, not throw, when its frames lack the held Instrument's\."` | exit 1; Tests  1 failed, 9 skipped (10) | TypeError: Cannot use 'in' operator to search for 'resolution' in undefined  |
| T8P.7-B | it should give that session an unavailable Trade P&L, not throw, when its frames lack the held Instrument's\. | green | `npx vitest run src/domain/trade-analysis/replay-series.test.ts -t "it should give that session an unavailable Trade P&L, not throw, when its frames lack the held Instrument's\."` | exit 0; Tests  1 passed, 9 skipped (10) |  |
