# D09AR TDD log, T9AR.5-B1

One file per task (decision 111), so parallel lanes never edit one file. Each row is one single-case run; see `../tdd-log.md` for the rules.

| T9AR.5-B1 | should hold the role's run through a session where its crossed condition has no reading | red | `npx vitest run src/domain/trade-analysis/replay-crossings.test.ts -t "should hold the role's run through a session where its crossed condition has no reading"` | exit 1; Tests  1 failed, 7 skipped (8) | AssertionError: expected [ '2026-10-12', '2026-10-14' ] to deeply equal [ '2026-10-12', '2026-10-12' ]  |
| T9AR.5-B1 | should hold the role's run through a session where its crossed condition has no reading | green | `npx vitest run src/domain/trade-analysis/replay-crossings.test.ts -t "should hold the role's run through a session where its crossed condition has no reading"` | exit 0; Tests  1 passed, 7 skipped (8) |  |
| refactor | none beyond the comment on crossingsOf; no test renames | 
