# D09AR TDD log, T9AR.24-B7-B2

One file per task (decision 111), so parallel lanes never edit one file. Each row is one single-case run; see `../tdd-log.md` for the rules.

| T9AR.24-B7-B2 | should join the Stop breached label to its pole | red | `npx vitest run src/ui/cockpit/replay/corridor.test.tsx -t "should join the Stop breached label to its pole"` | exit 1; Tests  1 failed, 77 skipped (78) | AssertionError: the label crosses the cursor line, -440/-740/160/-1010 at 837, slider 6: expected true to be false // Object.is equality  |
| T9AR.24-B7-B2 | should join the Stop breached label to its pole | green | `npx vitest run src/ui/cockpit/replay/corridor.test.tsx -t "should join the Stop breached label to its pole"` | exit 1; Tests  1 failed, 77 skipped (78) | AssertionError: the pole (145.6 to 163.6) reaches the label's row (144), -600/-740/760/-860 at 837, slider 6: expected false to be true // Object.is equality  |
| T9AR.24-B7-B2 | should join the Stop breached label to its pole | green | `npx vitest run src/ui/cockpit/replay/corridor.test.tsx -t "should join the Stop breached label to its pole"` | exit 0; Tests  1 passed, 77 skipped (78) |  |
| T9AR.24-B7-B2 | note | e2e red | `.claude/scripts/with-browser-lock.sh npx playwright test e2e/d9ar/chart.spec.ts -g "Stop breached flag on the P&L chart"` on the old code (corridor-pnl.tsx reverted, dist-faults and dist-releases rebuilt) | exit 1; 1 failed | `expect(look.tied, ...the pole runs to the label...)` Received: false (chart.spec.ts:221) |
| T9AR.24-B7-B2 | note | e2e green | same command on the fixed code, both folders rebuilt | exit 0; 1 passed | |
| T9AR.24-B7-B2 | note | the 2nd "green" row above is an intermediate failure: the first fix tied only labels below the pole, and a label above its top (row 144 over a pole from 145.6) failed; the fix then tied both ways | | | |
| T9AR.24-B7-B2 | refactor | none beyond the fix; no existing line changed | | | |
