# D09AR TDD log, T9AR.24-B5

One file per task (decision 111), so parallel lanes never edit one file. Each row is one single-case run; see `../tdd-log.md` for the rules.

| T9AR.24-B5 | should not report the mouse pointerenter a browser sends under a finger just after a touch | red | `npx vitest run src/ui/cockpit/replay/corridor.test.tsx -t "should not report the mouse pointerenter a browser sends under a finger just after a touch"` | exit 1; Tests  1 failed, 70 skipped (71) | AssertionError: expected [ +0 ] to deeply equal []  |
| T9AR.24-B5 | should not report the mouse pointerenter a browser sends under a finger just after a touch | green | `npx vitest run src/ui/cockpit/replay/corridor.test.tsx -t "should not report the mouse pointerenter a browser sends under a finger just after a touch"` | exit 0; Tests  1 passed, 70 skipped (71) |  |
| T9AR.24-B5 | e2e: Review card Replay tap at 320, no hover box or band | red | `npx playwright test e2e/d9ar/responsive-a11y.spec.ts -g "hover box or band.*at 320"` | exit 1 | Error: no hover box on open; Expected: 0, Received: 1 |
| T9AR.24-B5 | e2e: Review card Replay tap at 320, no hover box or band | green | same, after the fix | 3 passed with the other two e2e cases | |
| T9AR.24-B5 | note | First-run pass, flagged for the user: the e2e cases at 375 and DALE from Trade Detail at 320 passed before the fix (the Replay button does not sit over a session there in this harness, so no fake mouse enter reached a hit). Mutation: the 1000 ms gate in corridor.tsx made `< -1` (never true), rebuilt; the two cases still passed, so they do not detect the defect. The unit case and the 320 e2e case do. | `npx playwright test e2e/d9ar/responsive-a11y.spec.ts -g "hover box or band.*at 375\|uncovered by a hover band"` | 2 passed (mutation not caught) | |
| T9AR.24-B5 | refactor | none: the fix is one module-level touch timestamp and one condition. | | | |
