# D08R TDD log, T8R.25-B3

One file per task (decision 111), so parallel lanes never edit one file. Each row is one single-case run; see `../tdd-log.md` for the rules.

| T8R.25-B3 | should name a stock Trades conditions in the Condition cell | red | `npx vitest run src/ui/cockpit/drawers/plan-risk.test.tsx -t "should name a stock Trades conditions in the Condition cell"` | exit 1; Tests  1 failed, 21 skipped (22) | AssertionError: expected [ '$47.50', '$56.00' ] to deeply equal [ 'XYZ at or below $47.50', …(1) ]  |
| T8R.25-B3 | should name a stock Trades conditions in the Condition cell | green | `npx vitest run src/ui/cockpit/drawers/plan-risk.test.tsx -t "should name a stock Trades conditions in the Condition cell"` | exit 0; Tests  1 passed, 21 skipped (22) |  |
