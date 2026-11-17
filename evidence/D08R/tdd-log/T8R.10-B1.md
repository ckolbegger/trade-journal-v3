# D08R TDD log, T8R.10-B1

One file per task (decision 111), so parallel lanes never edit one file. Each row is one single-case run; see `../tdd-log.md` for the rules.

| T8R.10-B1 | should show the expired note and no dated figures on a Settlement Due Trade whose current Mark is missing | red | `npx vitest run src/ui/cockpit/drawers/plan-risk.test.tsx -t "should show the expired note and no dated figures on a Settlement Due Trade whose current Mark is missing"` | exit 1; Tests  1 failed, 12 skipped (13) | AssertionError: expected [ …(4) ] to deeply equal [ …(4) ]  |
| T8R.10-B1 | should show the expired note and no dated figures on a Settlement Due Trade whose current Mark is missing | green | `npx vitest run src/ui/cockpit/drawers/plan-risk.test.tsx -t "should show the expired note and no dated figures on a Settlement Due Trade whose current Mark is missing"` | exit 0; Tests  1 passed, 12 skipped (13) |  |
