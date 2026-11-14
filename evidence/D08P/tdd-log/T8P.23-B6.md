# D08P TDD log, T8P.23-B6

One file per task (decision 111), so parallel lanes never edit one file. Each row is one single-case run; see `../tdd-log.md` for the rules.

| Task | Case | Phase | Command | Outcome | Failure excerpt |
|---|---|---|---|---|---|
| T8P.23-B6 | should list the Plan conditions on an incoherent Detail | red | `npx vitest run src/ui/cockpit/rail/conditions.props.test.ts -t "should list the Plan conditions on an incoherent Detail"` | exit 1; Tests  1 failed, 12 skipped (13) | TestingLibraryElementError: Unable to find an accessible element with the role "list" and name "Conditions"  |
| T8P.23-B6 | should list the Plan conditions on an incoherent Detail | green | `npx vitest run src/ui/cockpit/rail/conditions.props.test.ts -t "should list the Plan conditions on an incoherent Detail"` | exit 1; Tests  1 failed, 12 skipped (13) | AssertionError: expected [ Array(2) ] to deeply equal [ Array(2) ]  |
| T8P.23-B6 | should list the Plan conditions on an incoherent Detail | green | `npx vitest run src/ui/cockpit/rail/conditions.props.test.ts -t "should list the Plan conditions on an incoherent Detail"` | exit 0; Tests  1 passed, 12 skipped (13) |  |
| T8P.23-B6 | (note) | refactor | none | no refactor needed | The first green row above failed on the test's own expected strings ($47.5 vs $47.50); the test was corrected and rerun green. |
