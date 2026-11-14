# D08P TDD log, T8P.23-B8

One file per task (decision 111), so parallel lanes never edit one file. Each row is one single-case run; see `../tdd-log.md` for the rules.

| Task | Case | Phase | Command | Outcome | Failure excerpt |
|---|---|---|---|---|---|
| T8P.23-B8 | should word a missing Mark in Risk to stop | red | `npx vitest run src/ui/cockpit/drawers/plan-risk.test.tsx -t "should word a missing Mark in Risk to stop"` | exit 1; Tests  1 failed, 5 skipped (6) | AssertionError: expected [ '—', '—' ] to deeply equal [ …(2) ]  |
| T8P.23-B8 | should word a missing Mark in Risk to stop | green | `npx vitest run src/ui/cockpit/drawers/plan-risk.test.tsx -t "should word a missing Mark in Risk to stop"` | exit 0; Tests  1 passed, 5 skipped (6) |  |
| T8P.23-B8 | should word an unavailable condition result in the distance | red | `npx vitest run src/ui/cockpit/drawers/today.props.test.ts -t "should word an unavailable condition result in the distance"` | exit 1; Tests  1 failed, 11 skipped (12) | AssertionError: expected '—' to be 'Mark missing: XYZ, Thu Nov 19' // Object.is equality Expected: "Mark missing: XYZ, Thu Nov 19"  |
| T8P.23-B8 | should word an unavailable condition result in the distance | green | `npx vitest run src/ui/cockpit/drawers/today.props.test.ts -t "should word an unavailable condition result in the distance"` | exit 0; Tests  1 passed, 11 skipped (12) |  |

| refactor | T8P.23-B8 | none: two one-line changes reuse `calculation` from figures.ts; Placed.test.tsx dash expectations changed to A222 figure-length words |
