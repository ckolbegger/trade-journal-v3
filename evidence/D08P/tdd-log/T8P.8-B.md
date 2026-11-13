# D08P TDD log, T8P.8-B

One file per task (decision 111), so parallel lanes never edit one file. Each row is one single-case run; see `../tdd-log.md` for the rules.

| Task | Case | Phase | Command | Outcome | Failure excerpt |
|---|---|---|---|---|---|
| T8P.8-B | should give the series on the first covered session without a previous session | red | `npx vitest run src/modules/market-data/market-data.test.ts -t "should give the series on the first covered session without a previous session"` | exit 1; Tests  1 failed, 34 skipped (35) | TypeError: Cannot read properties of undefined (reading 'resolution')  |
| T8P.8-B | should give the series on the first covered session without a previous session | green | `npx vitest run src/modules/market-data/market-data.test.ts -t "should give the series on the first covered session without a previous session"` | exit 0; Tests  1 passed, 34 skipped (35) |  |
| T8P.8-B | should give the series on the first covered session without a previous session | green | `npx vitest run src/modules/market-data/market-data.test.ts -t "should give the series on the first covered session without a previous session"` | exit 0; Tests  1 passed, 34 skipped (35) |  |
| note | T8P.8-B1 | The two rows above for "should give the series on the first covered session without a previous session" are bug task T8P.8-B1 (ocr finding: `frame!` dereference on the first covered session). |
| T8P.8-B | should read a series's history and its final point in one snapshot | red | `npx vitest run src/modules/market-data/market-data.test.ts -t "should read a series's history and its final point in one snapshot"` | exit 1; Tests  1 failed, 35 skipped (36) | AssertionError: expected [ { on: 'transaction', …(2) }, …(1) ] to have a length of 1 but got 2  |
| T8P.8-B | should read a series's history and its final point in one snapshot | green | `npx vitest run src/modules/market-data/market-data.test.ts -t "should read a series's history and its final point in one snapshot"` | exit 0; Tests  1 passed, 35 skipped (36) |  |
| T8P.8-B | should read a series's history and its final point in one snapshot | green | `npx vitest run src/modules/market-data/market-data.test.ts -t "should read a series's history and its final point in one snapshot"` | exit 0; Tests  1 passed, 35 skipped (36) |  |
| note | T8P.8-B2 | The two rows above for "should read a series's history and its final point in one snapshot" are bug task T8P.8-B2 (ocr finding: the scan and the final point were awaited one after the other, so two snapshots). Case 4's request list is unchanged. |
