# D09AR TDD log, T9AR.19-B3

One file per task (decision 111), so parallel lanes never edit one file. Each row is one single-case run; see `../tdd-log.md` for the rules.

| T9AR.19-B3 | should still flag a first crossing on a session with no Trade P&L, at the line's own level or at the top of the plot, and name it in the key and the phone's strip | red | `npx vitest run src/ui/cockpit/replay/corridor.test.tsx -t "should still flag a first crossing on a session with no Trade P&L, at the line's own level or at the top of the plot, and name it in the key and the phone's strip"` | exit 1; Tests  1 failed, 56 skipped (57) | AssertionError: expected [] to have a length of 1 but got +0  |
| T9AR.19-B3 | should still flag a first crossing on a session with no Trade P&L, at the line's own level or at the top of the plot, and name it in the key and the phone's strip | green | `npx vitest run src/ui/cockpit/replay/corridor.test.tsx -t "should still flag a first crossing on a session with no Trade P&L, at the line's own level or at the top of the plot, and name it in the key and the phone's strip"` | exit 0; Tests  1 passed, 56 skipped (57) |  |
refactor: none; the key filter and the flag's top-of-plot placement are the whole change.
