# D09AR TDD log, T9AR.18-D1

One file per task (decision 111), so parallel lanes never edit one file. Each row is one single-case run; see `../tdd-log.md` for the rules.

| T9AR.18-D1 | B9.5 fit: Detail replay on one screen; Review card replay at 320 px | red | `playwright test e2e/d9/responsive-a11y.spec.ts -g "should fit the Detail replay on one screen\|should fit the Review card replay at 320"` | exit 1; 2 failed | span 616 px over 588.9 available (the crossing sentence adds a line) |
| T9AR.18-D1 | should put the first-crossing sentence after the charts on a phone and after the status line on a wide screen | red | `playwright test e2e/d9ar/crossing-position.spec.ts` | exit 1; 1 failed | 860px: after the charts, expected >= 631.6, received 139.8 |
| T9AR.18-D1 | both fit cases and the position case | green | `playwright test e2e/d9ar/crossing-position.spec.ts e2e/d9/responsive-a11y.spec.ts -g "first-crossing\|should fit the Detail replay on one screen\|should fit the Review card replay at 320"` | exit 0; 3 passed | |
