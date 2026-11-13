# D08P TDD log, T8P.8-B

One file per task (decision 111), so parallel lanes never edit one file. Each row is one single-case run; see `../tdd-log.md` for the rules.

| Task | Case | Phase | Command | Outcome | Failure excerpt |
|---|---|---|---|---|---|
| T8P.8-B | should give the series on the first covered session without a previous session | red | `npx vitest run src/modules/market-data/market-data.test.ts -t "should give the series on the first covered session without a previous session"` | exit 1; Tests  1 failed, 34 skipped (35) | TypeError: Cannot read properties of undefined (reading 'resolution')  |
| T8P.8-B | should give the series on the first covered session without a previous session | green | `npx vitest run src/modules/market-data/market-data.test.ts -t "should give the series on the first covered session without a previous session"` | exit 0; Tests  1 passed, 34 skipped (35) |  |
| T8P.8-B | should give the series on the first covered session without a previous session | green | `npx vitest run src/modules/market-data/market-data.test.ts -t "should give the series on the first covered session without a previous session"` | exit 0; Tests  1 passed, 34 skipped (35) |  |
| note | T8P.8-B1 | The two rows above for "should give the series on the first covered session without a previous session" are bug task T8P.8-B1 (ocr finding: `frame!` dereference on the first covered session). |
