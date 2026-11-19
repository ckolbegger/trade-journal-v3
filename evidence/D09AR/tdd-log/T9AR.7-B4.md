# D09AR TDD log, T9AR.7-B4

One file per task (decision 111), so parallel lanes never edit one file. Each row is one single-case run; see `../tdd-log.md` for the rules.

| T9AR.7-B4 | should count a button inside a closed details summary as a Tab edge when it is the last control | red | `npx vitest run src/ui/cockpit/replay/overlay.test.tsx -t "should count a button inside a closed details summary as a Tab edge when it is the last control"` | exit 1; Tests  1 failed, 11 skipped (12) | AssertionError: expected <body><div inert></div>  |
| T9AR.7-B4 | should count a button inside a closed details summary as a Tab edge when it is the last control | green | `npx vitest run src/ui/cockpit/replay/overlay.test.tsx -t "should count a button inside a closed details summary as a Tab edge when it is the last control"` | exit 0; Tests  1 passed, 11 skipped (12) |  |
| refactor | T9AR.7-B4 | no change; the walk tracks the ancestor just below each details instead of the element itself |
