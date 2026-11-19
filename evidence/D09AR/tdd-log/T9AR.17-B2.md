# D09AR TDD log, T9AR.17-B2

One file per task (decision 111), so parallel lanes never edit one file. Each row is one single-case run; see `../tdd-log.md` for the rules.

| T9AR.17-B2 | should hand focus to an enabled paging button when a resize | red | `npx vitest run src/ui/cockpit/replay/session-cards.test.tsx -t "should hand focus to an enabled paging button when a resize"` | exit 1; Tests  1 failed, 5 skipped (6) | AssertionError: expected <button type="button"></button> to be <button type="button" …(2)></button> // Object.is equality  |
| T9AR.17-B2 | should hand focus to an enabled paging button when a resize | green | `npx vitest run src/ui/cockpit/replay/session-cards.test.tsx -t "should hand focus to an enabled paging button when a resize"` | exit 0; Tests  1 passed, 5 skipped (6) |  |
