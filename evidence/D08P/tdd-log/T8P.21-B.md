# D08P TDD log, T8P.21-B

One file per task (decision 111), so parallel lanes never edit one file. Each row is one single-case run; see `../tdd-log.md` for the rules.

| Task | Case | Phase | Command | Outcome | Failure excerpt |
|---|---|---|---|---|---|
| T8P.21-B | should keep a page of cards in view when the list shrinks or stops paging | red | `npx vitest run src/ui/cockpit/journal-cards.props.test.tsx -t "should keep a page of cards in view when the list shrinks or stops paging"` | exit 1; Tests  1 failed, 9 skipped (10) | TestingLibraryElementError: Unable to find an accessible element with the role "article"  |
| T8P.21-B | should keep a page of cards in view when the list shrinks or stops paging | green | `npx vitest run src/ui/cockpit/journal-cards.props.test.tsx -t "should keep a page of cards in view when the list shrinks or stops paging"` | exit 0; Tests  1 passed, 9 skipped (10) |  |
| T8P.21-B | should keep each entry's saved status and its Answered or Declined time on its card | red | `npx vitest run src/ui/cockpit/journal-cards.props.test.tsx -t "should keep each entry's saved status and its Answered or Declined time on its card"` | exit 1; Tests  1 failed, 10 skipped (11) | AssertionError: expected [ 'Position Change Reflection' ] to deeply equal [ 'Position Change Reflection', …(2) ]  |
| T8P.21-B | should keep each entry's saved status and its Answered or Declined time on its card | green | `npx vitest run src/ui/cockpit/journal-cards.props.test.tsx -t "should keep each entry's saved status and its Answered or Declined time on its card"` | exit 0; Tests  1 passed, 10 skipped (11) |  |
