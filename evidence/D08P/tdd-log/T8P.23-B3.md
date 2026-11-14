# D08P TDD log, T8P.23-B3

One file per task (decision 111), so parallel lanes never edit one file. Each row is one single-case run; see `../tdd-log.md` for the rules.

| Task | Case | Phase | Command | Outcome | Failure excerpt |
|---|---|---|---|---|---|
| T8P.23-B3 | should show only the current Marks card of the Today drawer in the Position drawer on a Settlement Due Detail | red | `npx vitest run src/ui/screens/trade-detail/Placed.test.tsx -t "should show only the current Marks card of the Today drawer in the Position drawer on a Settlement Due Detail"` | exit 1; Tests  1 failed, 7 skipped (8) | AssertionError: expected <div class="tracks">…(2)</div> to be null  |
| T8P.23-B3 | should show only the current Marks card of the Today drawer in the Position drawer on a Settlement Due Detail | green | `npx vitest run src/ui/screens/trade-detail/Placed.test.tsx -t "should show only the current Marks card of the Today drawer in the Position drawer on a Settlement Due Detail"` | exit 0; Tests  1 passed, 7 skipped (8) |  |
