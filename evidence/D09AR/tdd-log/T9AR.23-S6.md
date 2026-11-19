# D09AR TDD log, T9AR.23-S6

One file per task (decision 111), so parallel lanes never edit one file. Each row is one single-case run; see `../tdd-log.md` for the rules.

| T9AR.23-S6 | should list No Mark in the key for a session whose result is missing | red | `npx vitest run src/ui/cockpit/replay/plot.props.test.ts -t "should list No Mark in the key for a session whose result is missing"` | exit 1; Tests  1 failed, 15 skipped (16) | AssertionError: expected [ 'Mark', 'Break-even', 'Strike' ] to include 'No Mark'  |
| T9AR.23-S6 | should list No Mark in the key for a session whose result is missing | green | `npx vitest run src/ui/cockpit/replay/plot.props.test.ts -t "should list No Mark in the key for a session whose result is missing"` | exit 0; Tests  1 passed, 15 skipped (16) |  |
| T9AR.23-S6 | should list No Mark in the key for a session whose result is missing | green | `npx vitest run src/ui/cockpit/replay/plot.props.test.ts -t "should list No Mark in the key for a session whose result is missing"` | exit 0; Tests  1 passed, 15 skipped (16) |  |
| T9AR.23-S6 | refactor | refactor | none needed | no change; replay folder green | |
