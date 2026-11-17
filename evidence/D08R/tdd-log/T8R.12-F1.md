# D08R TDD log, T8R.12-F1

One file per task (decision 111), so parallel lanes never edit one file. Each row is one single-case run; see `../tdd-log.md` for the rules.

| T8R.12-F1 | should show New lots 1 contract, Average price of new lots | red | `npx vitest run src/ui/cockpit/drawers/plan-risk.test.tsx -t "should show New lots 1 contract, Average price of new lots"` | exit 1; Tests  1 failed, 17 skipped (18) | AssertionError: expected [ 'Since the last Marks', …(1) ] to deeply equal [ Array(2) ]  |
| T8R.12-F1 | should show New lots 1 contract, Average price of new lots | green | `npx vitest run src/ui/cockpit/drawers/plan-risk.test.tsx -t "should show New lots 1 contract, Average price of new lots"` | exit 0; Tests  1 passed, 17 skipped (18) |  |
| T8R.12-F1 | refactor | refactor | none | no change beyond the move; the order assertion now names the heading after Since the last Marks (Conditions) instead of the heading before Planned-Leg Fulfillment |  |
