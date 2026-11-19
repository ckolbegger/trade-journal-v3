# D09AR TDD log, T9AR.9-B3

One file per task (decision 111), so parallel lanes never edit one file. Each row is one single-case run; see `../tdd-log.md` for the rules.

| T9AR.9-B3 | should go back one entry on the second Close after Replay, Close, Forward | red | `npx vitest run src/ui/screens/ReviewCard.test.tsx -t "should go back one entry on the second Close after Replay, Close, Forward"` | exit 1; Tests  1 failed, 67 skipped (68) | AssertionError: expected '/review?trade=t1&panel=Action' to be '/review' // Object.is equality Expected: "/review"  |
| T9AR.9-B3 | should go back one entry on the second Close after Replay, Close, Forward | green | `npx vitest run src/ui/screens/ReviewCard.test.tsx -t "should go back one entry on the second Close after Replay, Close, Forward"` | exit 0; Tests  1 passed, 67 skipped (68) |  |
