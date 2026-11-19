# D09AR TDD log, T9AR.7-B1

One file per task (decision 111), so parallel lanes never edit one file. Each row is one single-case run; see `../tdd-log.md` for the rules.

| T9AR.7-B1 | should wrap Tab from the last control that can take focus to Close | red | `npx vitest run src/ui/cockpit/replay/overlay.test.tsx -t "should wrap Tab from the last control that can take focus to Close"` | exit 1; Tests  1 failed, 9 skipped (10) | TestingLibraryElementError: Unable to find an element with the text: Table. This could be because the text is broken up by multiple elements. In this case, you can provide a function for your text matcher to make your ma |
| T9AR.7-B1 | should wrap Tab from the last control that can take focus to Close | red | `npx vitest run src/ui/cockpit/replay/overlay.test.tsx -t "should wrap Tab from the last control that can take focus to Close"` | exit 1; Tests  1 failed, 9 skipped (10) | AssertionError: expected <div tabindex="0"></div> to be <button type="button" …(1)></button> // Object.is equality  |
| T9AR.7-B1 | should wrap Tab from the last control that can take focus to Close | green | `npx vitest run src/ui/cockpit/replay/overlay.test.tsx -t "should wrap Tab from the last control that can take focus to Close"` | exit 0; Tests  1 passed, 9 skipped (10) |  |
| T9AR.7-B1 | (note) | note | first red row above was a fixture error (children prop overridden by the helper), not a valid red; the second red row is the valid one | | |
| T9AR.7-B1 | (all) | refactor | none; the focus filter is one small helper, canTakeFocus | | |
