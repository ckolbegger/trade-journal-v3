# D08R TDD log, T8R.17-B1

One file per task (decision 111), so parallel lanes never edit one file. Each row is one single-case run; see `../tdd-log.md` for the rules.

| T8R.17-B1 | should not show the active Deviation line on an incoherent Detail | red | `npx vitest run src/ui/screens/trade-detail/Journal.test.tsx -t "should not show the active Deviation line on an incoherent Detail"` | exit 1; Tests  1 failed, 23 skipped (24) | AssertionError: expected <p class="journal-deviations">…(1)</p> to be null  |
| T8R.17-B1 | should not show the active Deviation line on an incoherent Detail | green | `npx vitest run src/ui/screens/trade-detail/Journal.test.tsx -t "should not show the active Deviation line on an incoherent Detail"` | exit 0; Tests  1 passed, 23 skipped (24) |  |
| refactor | T8R.17-B1 | none needed; test helper journalWith gained an optional view argument |
