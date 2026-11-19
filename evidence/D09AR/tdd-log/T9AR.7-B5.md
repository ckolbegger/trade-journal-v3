# D09AR TDD log, T9AR.7-B5

One file per task (decision 111), so parallel lanes never edit one file. Each row is one single-case run; see `../tdd-log.md` for the rules.

| T9AR.7-B5 | should not count a summary with tabIndex=-1 as a Tab edge | red | `npx vitest run src/ui/cockpit/replay/overlay.test.tsx -t "should not count a summary with tabIndex=-1 as a Tab edge"` | exit 1; Tests  1 failed, 12 skipped (13) | AssertionError: expected <body><div inert></div>  |
| T9AR.7-B5 | should not count a summary with tabIndex=-1 as a Tab edge | green | `npx vitest run src/ui/cockpit/replay/overlay.test.tsx -t "should not count a summary with tabIndex=-1 as a Tab edge"` | exit 0; Tests  1 passed, 12 skipped (13) |  |
| refactor | none; nothing to change. No test renamed, no assertion added beyond the plan. |
