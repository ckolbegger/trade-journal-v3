# D08P TDD log, T8P.22-B2

One file per task (decision 111), so parallel lanes never edit one file. Each row is one single-case run; see `../tdd-log.md` for the rules.

| Task | Case | Phase | Command | Outcome | Failure excerpt |
|---|---|---|---|---|---|
| T8P.22-B2 | should keep the Detail of the Trade the route is on when an earlier Trade.s read settles after the route moved | red | `npx vitest run src/ui/screens/TradeDetail.test.tsx -t "should keep the Detail of the Trade the route is on when an earlier Trade.s read settles after the route moved"` | exit 1; Tests  1 failed, 8 skipped (9) | AssertionError: expected [ <h1></h1> ] to deeply equal []  |
| T8P.22-B2 | should keep the Detail of the Trade the route is on when an earlier Trade.s read settles after the route moved | green | `npx vitest run src/ui/screens/TradeDetail.test.tsx -t "should keep the Detail of the Trade the route is on when an earlier Trade.s read settles after the route moved"` | exit 0; Tests  1 passed, 8 skipped (9) |  |
