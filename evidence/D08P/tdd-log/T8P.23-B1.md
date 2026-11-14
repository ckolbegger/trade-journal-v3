# D08P TDD log, T8P.23-B1

One file per task (decision 111), so parallel lanes never edit one file. Each row is one single-case run; see `../tdd-log.md` for the rules.

| Task | Case | Phase | Command | Outcome | Failure excerpt |
|---|---|---|---|---|---|
| T8P.23-B1 | should show the Result rows and the realized figure once on the rail | red | `npx vitest run src/ui/screens/trade-detail/Result.test.tsx -t "should show the Result rows and the realized figure once on the rail"` | exit 1; Tests  1 failed, 2 skipped (3) | AssertionError: expected <section class="card" …(1)>…(2)</section> to be null  |
| T8P.23-B1 | should show the Result rows and the realized figure once on the rail | green | `npx vitest run src/ui/screens/trade-detail/Result.test.tsx -t "should show the Result rows and the realized figure once on the rail"` | exit 0; Tests  1 passed, 2 skipped (3) |  |
| T8P.23-B1 | should show the Result rows and the realized figure once on the rail | green | `npx vitest run src/ui/screens/trade-detail/Result.test.tsx -t "should show the Result rows and the realized figure once on the rail"` | exit 0; Tests  1 passed, 2 skipped (3) |  |
| refactor | Removed the now-unimported `Result.tsx`, the `result` prop of the Position drawer and its comments. Result.test and Cockpit.test reads moved to the rail's Trade P&L card. No test renamed. |
