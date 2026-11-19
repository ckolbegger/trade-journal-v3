# D09AR TDD log, T9AR.7-B2

One file per task (decision 111), so parallel lanes never edit one file. Each row is one single-case run; see `../tdd-log.md` for the rules.

| T9AR.7-B2 | should place the charts on the left and the readout on the right inside the overlay at a wide width, and one column on a phone | red | `npx vitest run src/ui/cockpit/replay/overlay.test.tsx -t "should place the charts on the left and the readout on the right inside the overlay at a wide width, and one column on a phone"` | exit 1; Tests  no tests | TypeError: The URL must be of scheme file  |
| T9AR.7-B2 | should place the charts on the left and the readout on the right inside the overlay at a wide width, and one column on a phone | red | `npx vitest run src/ui/cockpit/replay/overlay.test.tsx -t "should place the charts on the left and the readout on the right inside the overlay at a wide width, and one column on a phone"` | exit 1; Tests  1 failed, 10 skipped (11) | AssertionError: expected undefined to be 'grid' // Object.is equality  |
| T9AR.7-B2 | should place the charts on the left and the readout on the right inside the overlay at a wide width, and one column on a phone | green | `npx vitest run src/ui/cockpit/replay/overlay.test.tsx -t "should place the charts on the left and the readout on the right inside the overlay at a wide width, and one column on a phone"` | exit 0; Tests  1 passed, 10 skipped (11) |  |
| T9AR.7-B2 | (note) | note | | | The first red row (URL scheme TypeError) was a fixture error, not a red; the test was fixed to read the stylesheet by path and the second row is the genuine red. |
| T9AR.7-B2 | (refactor) | refactor | | | No change: the stylesheet rules and the one test needed nothing further. |
