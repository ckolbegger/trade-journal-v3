# D09AR TDD log, T9AR.24-B12

One file per task (decision 111), so parallel lanes never edit one file. Each row is one single-case run; see `../tdd-log.md` for the rules.

| T9AR.24-B12 | should draw each figure of the Plan block, a signed amount and an odds pair included, as one card-figure span | red | `npx vitest run src/ui/cockpit/replay/frame.test.tsx -t "should draw each figure of the Plan block, a signed amount and an odds pair included, as one card-figure span"` | exit 1; Tests  1 failed, 28 skipped (29) | AssertionError: expected [] to deeply equal [ '$1.61', '$0.80', '−$324.00', …(2) ]  |
| T9AR.24-B12 | should draw each figure of the Plan block, a signed amount and an odds pair included, as one card-figure span | green | `npx vitest run src/ui/cockpit/replay/frame.test.tsx -t "should draw each figure of the Plan block, a signed amount and an odds pair included, as one card-figure span"` | exit 0; Tests  1 passed, 28 skipped (29) |  |
| T9AR.24-B12 | e2e: should keep every figure in the Plan block on one line, sign with its number, at 375 and 320 (BREN, AXIO, CORV) | red | `npx playwright test e2e/d9ar/readout.spec.ts -g T9AR.24-B12` (fix reverted, faults and releases rebuilt) | 3 failed | unmarked figure in "Stop: call at or below $0.80 · P&L if hit −$324.00" and the other Plan rows |
| T9AR.24-B12 | e2e: same, 3 cases | green | same command (fix restored, rebuilt) | 3 passed | |
| T9AR.24-B12 | refactor | refactor | none | The Plan block rows draw through Words; nothing to refactor. No test renamed; the e2e checks stray marks before counting figures so a failure names the defect. | |
