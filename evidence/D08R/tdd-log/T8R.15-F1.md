# D08R TDD log, T8R.15-F1

One file per task (decision 111), so parallel lanes never edit one file. Each row is one single-case run; see `../tdd-log.md` for the rules.

| T8R.15-F1 | should show the dated line on an owed Debt resolved in place, and no Answered or Declined row | red | `npx vitest run src/ui/screens/trade-detail/Journal.test.tsx -t "should show the dated line on an owed Debt resolved in place, and no Answered or Declined row"` | exit 1; Tests  1 failed, 19 skipped (20) | TestingLibraryElementError: Unable to find an element with the text: Position Change · Mon Oct 12, 10:00 am · written Tue Oct 13. This could be because the text is broken up by multiple elements. In this case, you can pr |
| T8R.15-F1 | should show the dated line on an owed Debt resolved in place, and no Answered or Declined row | green | `npx vitest run src/ui/screens/trade-detail/Journal.test.tsx -t "should show the dated line on an owed Debt resolved in place, and no Answered or Declined row"` | exit 0; Tests  1 passed, 19 skipped (20) |  |
| T8R.15-F1 | refactor | refactor | none | Reviewed: the saved item's `timeLabel` field was unused after the change and is removed; nothing else. Tests rerun green (src/ui/screens, src/ui/cockpit: 633 passed). |  |
