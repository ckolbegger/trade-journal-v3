# D08P TDD log, T8P.23-B11

One file per task (decision 111), so parallel lanes never edit one file. Each row is one single-case run; see `../tdd-log.md` for the rules.

| Task | Case | Phase | Command | Outcome | Failure excerpt |
|---|---|---|---|---|---|
| T8P.23-B11 | should not count the final session of a Closed Trade | red | `npx vitest run src/ui/cockpit/drawers/price-history.props.test.tsx -t "should not count the final session of a Closed Trade"` | exit 1; Tests  1 failed, 8 skipped (9) | AssertionError: expected 1 to be +0 // Object.is equality  |
| T8P.23-B11 | should not count the final session of a Closed Trade | green | `npx vitest run src/ui/cockpit/drawers/price-history.props.test.tsx -t "should not count the final session of a Closed Trade"` | exit 0; Tests  1 passed, 8 skipped (9) |  |
| T8P.23-B11 | should head a Closed Trade final session flat | red | `npx vitest run src/ui/cockpit/journal-cards.props.test.tsx -t "should head a Closed Trade final session flat"` | exit 1; Tests  1 failed, 12 skipped (13) | AssertionError: expected [ 'Tue Oct 13 without Marks', …(1) ] to deeply equal [ 'Tue Oct 13, final session', …(1) ]  |
| T8P.23-B11 | should head a Closed Trade final session flat | green | `npx vitest run src/ui/cockpit/journal-cards.props.test.tsx -t "should head a Closed Trade final session flat"` | exit 0; Tests  1 passed, 12 skipped (13) |  |
| refactor | none: both adapters share the one-line `heldNothing` test over `positions` (declared in each adapter's own slice, since the UI imports no coordinator type); no rename. TradeDetail.test.tsx's replay double now holds a nonzero Position per session, as the real view does. |
