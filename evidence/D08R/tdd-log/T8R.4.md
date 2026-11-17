# D08R TDD log, T8R.4

One file per task (decision 111), so parallel lanes never edit one file. Each row is one single-case run; see `../tdd-log.md` for the rules.

| T8R.4 | should give each Mark cell Manual | red | `npx vitest run src/ui/cockpit/drawers/price-history.props.test.tsx -t "should give each Mark cell Manual"` | exit 0; Tests  11 skipped (11) |  |
| T8R.4 | should give each Mark cell | red | `npx vitest run src/ui/cockpit/drawers/price-history.props.test.tsx -t "should give each Mark cell"` | exit 1; Tests  1 failed, 10 skipped (11) | AssertionError: expected null to be 'Manual · saved 2026-10-14 17:00' // Object.is equality  |
| T8R.4 | should give each Mark cell | green | `npx vitest run src/ui/cockpit/drawers/price-history.props.test.tsx -t "should give each Mark cell"` | exit 0; Tests  1 passed, 10 skipped (11) |  |
| T8R.4 | should add Corrected | red | `npx vitest run src/ui/cockpit/drawers/price-history.props.test.tsx -t "should add Corrected"` | exit 0; Tests  12 skipped (12) |  |
| T8R.4 | should add Corrected and its reason | red | `npx vitest run src/ui/cockpit/drawers/price-history.props.test.tsx -t "should add Corrected and its reason"` | exit 1; Tests  1 failed, 11 skipped (12) | AssertionError: expected 'Manual · saved 2026-10-14 17:00' to be 'Manual · saved 2026-10-14 17:00. Corr…' // Object.is equality Expected: "Manual · saved 2026-10-14 17:00. Corrected: Typo in the first entry"  |
| T8R.4 | should add Corrected and its reason | green | `npx vitest run src/ui/cockpit/drawers/price-history.props.test.tsx -t "should add Corrected and its reason"` | exit 1; Tests  1 failed, 11 skipped (12) | AssertionError: expected undefined to be 'Manual · saved 2026-10-14 17:00' // Object.is equality  |
| T8R.4 | should add Corrected and its reason | green | `npx vitest run src/ui/cockpit/drawers/price-history.props.test.tsx -t "should add Corrected and its reason"` | exit 0; Tests  1 passed, 11 skipped (12) |  |
| T8R.4 | should give a gap no provenance | red | `npx vitest run src/ui/cockpit/drawers/price-history.props.test.tsx -t "should give a gap no provenance"` | exit 0; Tests  1 passed, 12 skipped (13) |  |
| T8R.4 | should give a gap no provenance | green | `npx vitest run src/ui/cockpit/drawers/price-history.props.test.tsx -t "should give a gap no provenance"` | exit 0; Tests  1 passed, 12 skipped (13) |  |

| note | should give a gap no provenance | First-run pass, flagged for the user. Cases 1 and 2 built the behavior (a gap is a null cell, so the cell gets no title or aria-label). Mutation: the cell's title falls back to 'Manual' when the cell is a gap. Command: `npx vitest run src/ui/cockpit/drawers/price-history.props.test.tsx -t "should give a gap no provenance"`. First failure line: `AssertionError: expected true to be false // Object.is equality`. |

| refactor | | No change: the code is already minimal. Test names rephrased: case 2 reads "Corrected and its reason" (the colon and angle brackets break -t filtering). Assertions added beyond the plan: the cell has no tabindex, and an uncorrected cell next to a corrected one keeps plain provenance. The existing cases gained a third argument (the Workspace time zone) and their fixtures gained source and saved time; no expected value changed. |
