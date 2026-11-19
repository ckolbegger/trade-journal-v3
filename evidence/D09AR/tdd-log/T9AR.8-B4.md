# D09AR TDD log, T9AR.8-B4

One file per task (decision 111), so parallel lanes never edit one file. Each row is one single-case run; see `../tdd-log.md` for the rules.

| T9AR.8-B4 | should go back one entry on the second Close after Replay, Close, Forward | red | `npx vitest run src/ui/screens/TradeDetail.test.tsx -t "should go back one entry on the second Close after Replay, Close, Forward"` | exit 1; Tests  1 failed, 28 skipped (29) | AssertionError: expected 'REPLACE' to be 'POP' // Object.is equality Expected: "POP"  |
| T9AR.8-B4 | should go back one entry on the second Close after Replay, Close, Forward | green | `npx vitest run src/ui/screens/TradeDetail.test.tsx -t "should go back one entry on the second Close after Replay, Close, Forward"` | exit 0; Tests  1 passed, 28 skipped (29) |  |
