# D08R TDD log, T8R.4-F1

One file per task (decision 111), so parallel lanes never edit one file. Each row is one single-case run; see `../tdd-log.md` for the rules.

| T8R.4-F1 | should show a visible Corrected marker in a corrected Mark cell, and none in an uncorrected one | red | `npx vitest run src/ui/cockpit/drawers/price-history.props.test.tsx -t "should show a visible Corrected marker in a corrected Mark cell, and none in an uncorrected one"` | exit 1; Tests  1 failed, 13 skipped (14) | AssertionError: expected '57.40' to be '57.40Corrected' // Object.is equality Expected: "57.40Corrected"  |
| T8R.4-F1 | should show a visible Corrected marker in a corrected Mark cell, and none in an uncorrected one | green | `npx vitest run src/ui/cockpit/drawers/price-history.props.test.tsx -t "should show a visible Corrected marker in a corrected Mark cell, and none in an uncorrected one"` | exit 1; Tests  1 failed, 13 skipped (14) | AssertionError: expected '$2.90' to be '2.90' // Object.is equality Expected: "2.90"  |
| T8R.4-F1 | should show a visible Corrected marker in a corrected Mark cell, and none in an uncorrected one | green | `npx vitest run src/ui/cockpit/drawers/price-history.props.test.tsx -t "should show a visible Corrected marker in a corrected Mark cell, and none in an uncorrected one"` | exit 0; Tests  1 passed, 13 skipped (14) |  |
| T8R.4-F1 | refactor | note | none | n/a | No refactor warranted. The first green row failed on a wrong test expectation ($2.90, not 2.90), fixed in the test; the second green row passed. |
