# D09AR TDD log, T9AR.23-S7-B1

One file per task (decision 111), so parallel lanes never edit one file. Each row is one single-case run; see `../tdd-log.md` for the rules.

| T9AR.23-S7-B1 | should draw both edge labels without overlap at width | red | `npx vitest run src/ui/cockpit/replay/corridor.test.tsx -t "should draw both edge labels without overlap at width"` | exit 1; Tests  2 failed, 2 passed, 64 skipped (68) | AssertionError: expected 105 to be less than or equal to 82 AssertionError: expected 105 to be less than or equal to 97  |
| T9AR.23-S7-B1 | should draw both edge labels without overlap at width | green | `npx vitest run src/ui/cockpit/replay/corridor.test.tsx -t "should draw both edge labels without overlap at width"` | exit 0; Tests  4 passed, 64 skipped (68) |  |
| T9AR.23-S7-B1 | should draw both edge labels without overlap at width | green | `npx vitest run src/ui/cockpit/replay/corridor.test.tsx -t "should draw both edge labels without overlap at width"` | exit 0; Tests  4 passed, 64 skipped (68) |  |
| refactor | none needed; test uses it.each over 200, 215, 223, 240 (extra widths beyond the plan) | | |
