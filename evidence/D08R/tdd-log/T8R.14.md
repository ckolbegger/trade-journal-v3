# D08R TDD log, T8R.14

One file per task (decision 111), so parallel lanes never edit one file. Each row is one single-case run; see `../tdd-log.md` for the rules.

| T8R.14 | should show an option-price Stop as | red | `npx vitest run src/ui/cockpit/rail/conditions.props.test.ts -t "should show an option-price Stop as"` | exit 1; Tests  1 failed, 11 skipped (12) | AssertionError: expected [ 'Stop−$440.00', …(3) ] to deeply equal [ 'Stop · 3.00 away', …(3) ]  |
| T8R.14 | should show an option-price Stop as | green | `npx vitest run src/ui/cockpit/rail/conditions.props.test.ts -t "should show an option-price Stop as"` | exit 0; Tests  1 passed, 11 skipped (12) |  |
| T8R.14 | should show Wednesday's option-price Stop as | red | `npx vitest run src/ui/cockpit/rail/conditions.props.test.ts -t "should show Wednesday's option-price Stop as"` | exit 1; Tests  1 failed, 11 skipped (12) | AssertionError: expected 'Stop · $0.00 away' to be 'Stop · Breached · $0.10 past' // Object.is equality Expected: "Stop · Breached · $0.10 past"  |
| T8R.14 | should show Wednesday's option-price Stop as | green | `npx vitest run src/ui/cockpit/rail/conditions.props.test.ts -t "should show Wednesday's option-price Stop as"` | exit 0; Tests  1 passed, 11 skipped (12) |  |
| T8R.14 | should show a dated distance | red | `npx vitest run src/ui/cockpit/rail/conditions.props.test.ts -t "should show a dated distance"` | exit 1; Tests  1 failed, 12 skipped (13) | AssertionError: expected [ 'Stop · Mark missing', …(3) ] to deeply equal [ …(4) ]  |
| T8R.14 | should show a dated distance | green | `npx vitest run src/ui/cockpit/rail/conditions.props.test.ts -t "should show a dated distance"` | exit 0; Tests  1 passed, 12 skipped (13) |  |
| T8R.14 | should not show nearest | red | `npx vitest run src/ui/cockpit/rail/conditions.props.test.ts -t "should not show nearest"` | exit 1; Tests  1 failed, 11 skipped (12) | AssertionError: expected <ul class="conditions-summary" …(1)>…(2)</ul> to be null  |
| T8R.14 | should not show nearest | green | `npx vitest run src/ui/cockpit/rail/conditions.props.test.ts -t "should not show nearest"` | exit 0; Tests  1 passed, 11 skipped (12) |  |
| refactor | T8R.14 | Removed the retired Worst case, Max reward and T8P.27 cases and the unused withNearest helper; test names rephrased only to drop quotes; asserted the Reached form and the stock "Mark" suffix beyond planned wording. | | |
