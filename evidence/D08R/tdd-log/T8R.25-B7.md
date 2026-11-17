# D08R TDD log, T8R.25-B7

One file per task (decision 111), so parallel lanes never edit one file. Each row is one single-case run; see `../tdd-log.md` for the rules.

| T8R.25-B7 | should let the Payoff table scroll box take keyboard focus, with a name | red | `npx vitest run src/ui/cockpit/drawers/payoff.test.tsx -t "should let the Payoff table scroll box take keyboard focus, with a name"` | exit 1; Tests  1 failed, 5 skipped (6) | TestingLibraryElementError: Unable to find an accessible element with the role "region" and name "Planned Expiration Payoff table"  |
| T8R.25-B7 | should let the Payoff table scroll box take keyboard focus, with a name | green | `npx vitest run src/ui/cockpit/drawers/payoff.test.tsx -t "should let the Payoff table scroll box take keyboard focus, with a name"` | exit 0; Tests  1 passed, 5 skipped (6) |  |
| T8R.25-B7 | should pass axe on the Payoff drawer at 320 px | red | `npx playwright test e2e/d8r/responsive-a11y.spec.ts -g "Payoff drawer at 320"` | exit 1; 1 failed | `scrollable-region-focusable: section[aria-labelledby="_r_1_"] > .table-scroll, section[aria-labelledby="_r_2_"] > .table-scroll` (Settlement Due O-S2X, Payoff at 320) |
| T8R.25-B7 | should pass axe on the Payoff drawer at 320 px | green | `npx playwright test e2e/d8r e2e/d8p/{first-marks-pending,cockpit,responsive-a11y,payoff-fit,states}.spec.ts --grep-invert @release-history` | exit 0; 23 passed | |
| T8R.25-B7 | refactor | refactor | none | no change; the one-line fix reuses the Plan and Risk table box pattern as is | |
