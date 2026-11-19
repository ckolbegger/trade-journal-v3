# D09AR TDD log, T9AR.24-B7-B1

One file per task (decision 111), so parallel lanes never edit one file. Each row is one single-case run; see `../tdd-log.md` for the rules.

| T9AR.24-B7-B1 | should keep the Stop breached flag drawn, clear of every other label | green | `npx vitest run src/ui/cockpit/replay/corridor.test.tsx -t "should keep the Stop breached flag drawn, clear of every other label"` | exit 0; Tests  1 passed, 75 skipped (76) |  |
| T9AR.24-B7-B1 | should keep the Stop breached flag drawn, clear of every other label | green | `npx vitest run src/ui/cockpit/replay/corridor.test.tsx -t "should keep the Stop breached flag drawn, clear of every other label"` | exit 0; Tests  1 passed, 75 skipped (76) |  |

| note | First-run pass, flagged for the user. The flag's own placement (T9AR.24-B7) already kept it clear of the banked label, so adding text.crossing-label to the LABELS selector passes at once. Mutation: the flag put at the banked label's own spot with must set. Command: `npx vitest run src/ui/cockpit/replay/corridor.test.tsx -t "should keep the Stop breached flag drawn"`. First failure line: `AssertionError: slider 5: expected [ Array(1) ] to deeply equal []` (`"Realized −$440" over "Stop breached"`). Code restored; `git diff -- src` empty. |
