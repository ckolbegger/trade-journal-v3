# D09AR TDD log, T9AR.11-B1

One file per task (decision 111), so parallel lanes never edit one file. Each row is one single-case run; see `../tdd-log.md` for the rules.

| T9AR.11-B1 | should run a lone session area between two No Mark sessions to the edge of each shaded column, and end it upright | red | `npx vitest run src/ui/cockpit/replay/corridor.test.tsx -t "should run a lone session area between two No Mark sessions to the edge of each shaded column, and end it upright"` | exit 1; Tests  1 failed, 46 skipped (47) | AssertionError: expected 131.8 to be close to 122.75, received difference is 9.050000000000011, but expected 0.5  |
| T9AR.11-B1 | should run a lone session area between two No Mark sessions to the edge of each shaded column, and end it upright | green | `npx vitest run src/ui/cockpit/replay/corridor.test.tsx -t "should run a lone session area between two No Mark sessions to the edge of each shaded column, and end it upright"` | exit 0; Tests  1 passed, 46 skipped (47) |  |
| T9AR.11-B1 | should fill a single session with a figure between two gaps, and the first revealed session | green | `npx vitest run src/ui/cockpit/replay/corridor.test.tsx -t "should fill a single session with a figure between two gaps, and the first revealed session"` | exit 0; Tests  1 passed, 46 skipped (47) |  |
| refactor | T9AR.11-B1 | none; old lone-session bound changed from within 15 px of the dot to within the column edges (P146) |
