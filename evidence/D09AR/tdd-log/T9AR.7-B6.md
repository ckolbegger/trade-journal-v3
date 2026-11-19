# D09AR TDD log, T9AR.7-B6

One file per task (decision 111), so parallel lanes never edit one file. Each row is one single-case run; see `../tdd-log.md` for the rules.

| T9AR.7-B6 | should keep the plot frame at its own height in the wide grid, so no session button lies below the charts | red | `npx vitest run src/ui/cockpit/replay/overlay.test.tsx -t "should keep the plot frame at its own height in the wide grid, so no session button lies below the charts"` | exit 1; Tests  1 failed, 13 skipped (14) | AssertionError: expected undefined to be 'start' // Object.is equality  |
| T9AR.7-B6 | should keep the plot frame at its own height in the wide grid, so no session button lies below the charts | green | `npx vitest run src/ui/cockpit/replay/overlay.test.tsx -t "should keep the plot frame at its own height in the wide grid, so no session button lies below the charts"` | exit 0; Tests  1 passed, 13 skipped (14) |  |
- refactor: none (one declaration, no changes)
