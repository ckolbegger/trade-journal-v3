# D08P TDD log, T8P.26-B3

One file per task (decision 111), so parallel lanes never edit one file. Each row is one single-case run; see `../tdd-log.md` for the rules.

| Task | Case | Phase | Command | Outcome | Failure excerpt |
|---|---|---|---|---|---|
| T8P.26-B3 | should show a final session with no Mark and no earlier Mark with its Trade P&L and no change line | red | `npx vitest run src/ui/cockpit/journal-cards.props.test.tsx -t "should show a final session with no Mark and no earlier Mark with its Trade P&L and no change line"` | exit 1; Tests  1 failed, 14 skipped (15) | AssertionError: expected <p class="journal-card-change"></p> to be null  |
| T8P.26-B3 | should show a final session with no Mark after an earlier marked session with no change line | red | `npx vitest run src/ui/cockpit/journal-cards.props.test.tsx -t "should show a final session with no Mark after an earlier marked session with no change line"` | exit 1; Tests  1 failed, 14 skipped (15) | AssertionError: expected <p class="journal-card-change" …(1)></p> to be null  |
| T8P.26-B3 | should show a final session with no Mark and no earlier Mark with its Trade P&L and no change line | green | `npx vitest run src/ui/cockpit/journal-cards.props.test.tsx -t "should show a final session with no Mark and no earlier Mark with its Trade P&L and no change line"` | exit 0; Tests  1 passed, 14 skipped (15) |  |
| T8P.26-B3 | should show a final session with no Mark after an earlier marked session with no change line | green | `npx vitest run src/ui/cockpit/journal-cards.props.test.tsx -t "should show a final session with no Mark after an earlier marked session with no change line"` | exit 0; Tests  1 passed, 14 skipped (15) |  |
| T8P.26-B3 | refactor | refactor | n/a | none | |
