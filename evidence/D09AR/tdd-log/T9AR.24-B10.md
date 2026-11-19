# D09AR TDD log, T9AR.24-B10

One file per task (decision 111), so parallel lanes never edit one file. Each row is one single-case run; see `../tdd-log.md` for the rules.

| T9AR.24-B10 | should not draw a stake tag over a y-axis figure on the entry session at the 1440 frame width | red | `npx vitest run src/ui/cockpit/replay/corridor.test.tsx -t "should not draw a stake tag over a y-axis figure on the entry session at the 1440 frame width"` | exit 1; Tests  1 failed, 79 skipped (80) | AssertionError: a label (3 to 131) is over an axis figure (19 to 45): expected true to be false // Object.is equality  |
| T9AR.24-B10 | should not draw a stake tag over a y-axis figure on the entry session at the 1440 frame width | green | `npx vitest run src/ui/cockpit/replay/corridor.test.tsx -t "should not draw a stake tag over a y-axis figure on the entry session at the 1440 frame width"` | exit 0; Tests  1 passed, 79 skipped (80) |  |
| refactor | none | The fix is one reserved column; no change beyond it. The e2e cases (red: 1440 on BREN and CORV, "Remaining Reward" over "$500"; green after the fix) are in e2e/d9ar/chart.spec.ts. |
