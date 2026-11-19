# D09AR TDD log, T9AR.12-B1

One file per task (decision 111), so parallel lanes never edit one file. Each row is one single-case run; see `../tdd-log.md` for the rules.

| T9AR.12-B1 | should keep the slider value inside the phone drawing at the last session | red | `npx vitest run src/ui/cockpit/replay/corridor.test.tsx -t "should keep the slider value inside the phone drawing at the last session"` | exit 1; Tests  1 failed, 52 skipped (53) | AssertionError: slider 14, right edge: expected 345.2 to be less than or equal to 340  |
| T9AR.12-B1 | should keep the slider value inside the phone drawing at the last session | green | `npx vitest run src/ui/cockpit/replay/corridor.test.tsx -t "should keep the slider value inside the phone drawing at the last session"` | exit 0; Tests  1 passed, 52 skipped (53) |  |

refactor: none; the extra spots are the whole change.
| T9AR.12-B1 | should keep the slider value inside the phone drawing at the last session | green | `npx vitest run src/ui/cockpit/replay/corridor.test.tsx -t "should keep the slider value inside the phone drawing at the last session"` | exit 0; Tests  1 passed, 52 skipped (53) |  |
