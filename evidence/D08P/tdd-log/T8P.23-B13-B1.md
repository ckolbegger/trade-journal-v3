# D08P TDD log, T8P.23-B13-B1

One file per task (decision 111), so parallel lanes never edit one file. Each row is one single-case run; see `../tdd-log.md` for the rules.

| Task | Case | Phase | Command | Outcome | Failure excerpt |
|---|---|---|---|---|---|
| T8P.23-B13-B1 | should give no expiration while the Trade also holds stock or a live contract, and the latest expiration when every held leg is a due contract | red | `npx vitest run src/coordinators/trade-views/replay-trade.test.ts -t "should give no expiration while the Trade also holds stock or a live contract, and the latest expiration when every held leg is a due contract"` | exit 1; Tests  1 failed, 7 skipped (8) | AssertionError: expected '2026-11-20' to be null  |
| T8P.23-B13-B1 | should give no expiration while the Trade also holds stock or a live contract, and the latest expiration when every held leg is a due contract | green | `npx vitest run src/coordinators/trade-views/replay-trade.test.ts -t "should give no expiration while the Trade also holds stock or a live contract, and the latest expiration when every held leg is a due contract"` | exit 0; Tests  1 passed, 7 skipped (8) |  |
