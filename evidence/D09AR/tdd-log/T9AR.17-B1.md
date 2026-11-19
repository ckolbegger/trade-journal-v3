# D09AR TDD log, T9AR.17-B1

One file per task (decision 111), so parallel lanes never edit one file. Each row is one single-case run; see `../tdd-log.md` for the rules.

| T9AR.17-B1 | should turn the cards back to the first page when another Trade is handed | red | `npx vitest run src/ui/cockpit/replay/frame.test.tsx -t "should turn the cards back to the first page when another Trade is handed"` | exit 1; Tests  1 failed, 25 skipped (26) | AssertionError: expected [ 'Tue Nov 10', 'Mon Nov 9' ] to deeply equal [ 'Thu Nov 12', 'Wed Nov 11' ]  |
| T9AR.17-B1 | should turn the cards back to the first page when another Trade is handed | green | `npx vitest run src/ui/cockpit/replay/frame.test.tsx -t "should turn the cards back to the first page when another Trade is handed"` | exit 0; Tests  1 passed, 25 skipped (26) |  |
