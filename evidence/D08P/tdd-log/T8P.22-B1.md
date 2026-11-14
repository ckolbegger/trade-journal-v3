# D08P TDD log, T8P.22-B1

One file per task (decision 111), so parallel lanes never edit one file. Each row is one single-case run; see `../tdd-log.md` for the rules.

| Task | Case | Phase | Command | Outcome | Failure excerpt |
|---|---|---|---|---|---|
| T8P.22-B1 | should turn the Journal cards to the page holding the Debt when Reflect now is chosen for a Debt on an older session | red | `npx vitest run src/ui/screens/TradeDetail.test.tsx -t "should turn the Journal cards to the page holding the Debt when Reflect now is chosen for a Debt on an older session"` | exit 1; Tests  1 failed, 7 skipped (8) | TestingLibraryElementError: Unable to find role="form" and name "Reflection"  |
| T8P.22-B1 | should turn the Journal cards to the page holding the Debt when Reflect now is chosen for a Debt on an older session | green | `npx vitest run src/ui/screens/TradeDetail.test.tsx -t "should turn the Journal cards to the page holding the Debt when Reflect now is chosen for a Debt on an older session"` | exit 0; Tests  1 passed, 7 skipped (8) |  |
| T8P.22-B1 | should turn the Journal cards to the page holding the Debt when Reflect now is chosen for a Debt on an older session | green | `npx vitest run src/ui/screens/TradeDetail.test.tsx -t "should turn the Journal cards to the page holding the Debt when Reflect now is chosen for a Debt on an older session"` | exit 0; Tests  1 passed, 7 skipped (8) |  |
