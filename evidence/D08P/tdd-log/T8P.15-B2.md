# D08P TDD log, T8P.15-B2

One file per task (decision 111), so parallel lanes never edit one file. Each row is one single-case run; see `../tdd-log.md` for the rules.

| Task | Case | Phase | Command | Outcome | Failure excerpt |
|---|---|---|---|---|---|
| T8P.15-B2 | should open the chosen Debt.s form when two Debts of one Entry Type fall in the same minute | red | `npx vitest run src/ui/screens/trade-detail/Cockpit.test.tsx -t "should open the chosen Debt.s form when two Debts of one Entry Type fall in the same minute"` | exit 1; Tests  1 failed, 9 skipped (10) | AssertionError: expected <form …(2)>…(8)</form> to be null  |
| T8P.15-B2 | should open the chosen Debt.s form when two Debts of one Entry Type fall in the same minute | green | `npx vitest run src/ui/screens/trade-detail/Cockpit.test.tsx -t "should open the chosen Debt.s form when two Debts of one Entry Type fall in the same minute"` | exit 1; Tests  no tests | Error: Transform failed with 1 error:  |
| T8P.15-B2 | should open the chosen Debt.s form when two Debts of one Entry Type fall in the same minute | green | `npx vitest run src/ui/screens/trade-detail/Cockpit.test.tsx -t "should open the chosen Debt.s form when two Debts of one Entry Type fall in the same minute"` | exit 0; Tests  1 passed, 9 skipped (10) |  |
| T8P.15-B2 | should open the chosen Debt.s form when two Debts of one Entry Type fall in the same minute | green | `npx vitest run src/ui/screens/trade-detail/Cockpit.test.tsx -t "should open the chosen Debt.s form when two Debts of one Entry Type fall in the same minute"` | exit 0; Tests  1 passed, 9 skipped (10) |  |
