# D08R TDD log, T8R.23

One file per task (decision 111), so parallel lanes never edit one file. Each row is one single-case run; see `../tdd-log.md` for the rules.

| T8R.23 | should give O-C3+ open lots average | red | `npx vitest run src/coordinators/trade-views/replay-trade.test.ts -t "should give O-C3+ open lots average"` | exit 0; Tests  9 skipped (9) |  |
| T8R.23 | should give O-C3+ open lots average | red | `npx vitest run src/coordinators/trade-views/replay-trade.test.ts -t "should give O-C3+ open lots average"` | exit 0; Tests  9 skipped (9) |  |
| T8R.23 | open lots average 2.65 | red | `npx vitest run src/coordinators/trade-views/replay-trade.test.ts -t "open lots average 2.65"` | exit 1; Tests  1 failed, 8 skipped (9) | AssertionError: expected undefined to deeply equal Rational{ numerator: 53n, …(1) }  |
| T8R.23 | open lots average 2.65 | green | `npx vitest run src/coordinators/trade-views/replay-trade.test.ts -t "open lots average 2.65"` | exit 0; Tests  1 passed, 8 skipped (9) |  |
| T8R.23 | should give a stock Trade the Trade Summary price | red | `npx vitest run src/coordinators/trade-views/trade-summary.test.ts -t "should give a stock Trade the Trade Summary price"` | exit 0; Tests  1 passed, 4 skipped (5) |  |
| T8R.23 | should give a stock Trade the Trade Summary price | green | `npx vitest run src/coordinators/trade-views/trade-summary.test.ts -t "should give a stock Trade the Trade Summary price"` | exit 0; Tests  1 passed, 4 skipped (5) |  |
| T8R.23 | note | First-run pass, flagged for the user | case "should give a stock Trade the Trade Summary price": the first case's `openLotsAverageOf` already gives a stock Trade its lots' average, which is the Summary's price. Mutation: added 1 to the average in `openLotsAverageOf`. Command: `npx vitest run src/coordinators/trade-views/trade-summary.test.ts -t "should give a stock Trade the Trade Summary price"`. First failure line: FAIL ... should give a stock Trade the Trade Summary price (expected value off by 1). Restored; green re-run passes. |  |
| T8R.23 | note | The first two red rows used the planned name with an apostrophe and plus sign, which `-t` did not match (nothing ran, so invalid red); the case was renamed "should give O-C3+ open lots average 2.65" and rerun with the filter "open lots average 2.65". |  |
| T8R.23 | refactor | Reused `openLotsAverageOf` in `openItem` for `averageOpenCost`, replacing its inline duplicate; trade-views tests rerun. Test names rephrased to drop apostrophes and the dollar sign. |  |
