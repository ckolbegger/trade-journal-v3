# D08P TDD log, T8P.23-B5

One file per task (decision 111), so parallel lanes never edit one file. Each row is one single-case run; see `../tdd-log.md` for the rules.

| Task | Case | Phase | Command | Outcome | Failure excerpt |
|---|---|---|---|---|---|
| T8P.23-B5 | should show the rail cards in the order identity, P&L, Conditions and Needs you | red | `npx vitest run src/ui/screens/TradeDetail.test.tsx -t "should show the rail cards in the order identity, P&L, Conditions and Needs you"` | exit 1; Tests  1 failed, 9 skipped (10) | AssertionError: expected [ <header …(1)>…(6)</header>, …(3) ] to deeply equal [ <header …(1)>…(6)</header>, …(3) ]  |
| T8P.23-B5 | should show the rail cards in the order identity, P&L, Conditions and Needs you | green | `npx vitest run src/ui/screens/TradeDetail.test.tsx -t "should show the rail cards in the order identity, P&L, Conditions and Needs you"` | exit 0; Tests  1 passed, 9 skipped (10) |  |
