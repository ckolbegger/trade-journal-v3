# D09AR TDD log, T9AR.23-S5

One file per task (decision 111), so parallel lanes never edit one file. Each row is one single-case run; see `../tdd-log.md` for the rules.

| T9AR.23-S5 | should not report hover for a touch or pen pointer, only for a mouse | red | `npx vitest run src/ui/cockpit/replay/corridor.test.tsx -t "should not report hover for a touch or pen pointer, only for a mouse"` | exit 1; Tests  1 failed, 58 skipped (59) | AssertionError: expected [ 1, null, 1, null ] to deeply equal []  |
| T9AR.23-S5 | should not report hover for a touch or pen pointer, only for a mouse | green | `npx vitest run src/ui/cockpit/replay/corridor.test.tsx -t "should not report hover for a touch or pen pointer, only for a mouse"` | exit 0; Tests  1 passed, 58 skipped (59) |  |
| T9AR.23-S5 | should not report the focus a tap on a session gives its button, but still report keyboard focus | red | `npx vitest run src/ui/cockpit/replay/corridor.test.tsx -t "should not report the focus a tap on a session gives its button, but still report keyboard focus"` | exit 1; Tests  1 failed, 59 skipped (60) | AssertionError: expected [ 1 ] to deeply equal []  |
| T9AR.23-S5 | should not report the focus a tap on a session gives its button, but still report keyboard focus | green | `npx vitest run src/ui/cockpit/replay/corridor.test.tsx -t "should not report the focus a tap on a session gives its button, but still report keyboard focus"` | exit 0; Tests  1 passed, 59 skipped (60) |  |
| T9AR.23-S5 | refactor | refactor | none needed | no change; both cases and the replay folder green | |
