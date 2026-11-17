# D08R TDD log, T8R.14-B1

One file per task (decision 111), so parallel lanes never edit one file. Each row is one single-case run; see `../tdd-log.md` for the rules.

| T8R.14-B1 | should name the list of notes beneath the conditions Conditions notes | red | `npx vitest run src/ui/cockpit/rail/conditions.props.test.ts -t "should name the list of notes beneath the conditions Conditions notes"` | exit 1; Tests  1 failed, 11 skipped (12) | TestingLibraryElementError: Unable to find an element with the role "list" and name "Conditions notes"  |
| T8R.14-B1 | should name the list of notes beneath the conditions Conditions notes | green | `npx vitest run src/ui/cockpit/rail/conditions.props.test.ts -t "should name the list of notes beneath the conditions Conditions notes"` | exit 0; Tests  1 passed, 11 skipped (12) |  |

| refactor | T8R.14-B1 | nothing to change; the existing notes case now queries the new name (same assertions, so not a loosening) |
