# D08P TDD log, T8P.14-B

One file per task (decision 111), so parallel lanes never edit one file. Each row is one single-case run; see `../tdd-log.md` for the rules.

| Task | Case | Phase | Command | Outcome | Failure excerpt |
|---|---|---|---|---|---|
| T8P.14-B | should show any other Unavailable reason at the label length on row 1 | red | `npx vitest run src/ui/cockpit/rail/conditions.props.test.ts -t "should show any other Unavailable reason at the label length on row 1"` | exit 1; Tests  1 failed, 8 skipped (9) | TestingLibraryElementError: Unable to find an element with the text: Outside calendar. This could be because the text is broken up by multiple elements. In this case, you can provide a function for your text matcher to m |
| T8P.14-B | should show any other Unavailable reason at the label length on row 1 | green | `npx vitest run src/ui/cockpit/rail/conditions.props.test.ts -t "should show any other Unavailable reason at the label length on row 1"` | exit 0; Tests  1 passed, 8 skipped (9) |  |
| T8P.14-B | should choose the subject wording without a nested conditional | refactor | `npx vitest run src/ui/cockpit/rail/conditions src/ui/screens/trade-detail` | exit 0; all passed before and after | whyText's nested ternary became the function subjectText with early returns; the card's 10 existing cases were green before and after. No new test: behavior unchanged. |
| T8P.14-B | (note) B2 | note | no command | n/a | measuredItem now takes `waiting` (the same test openProps already used, with coverage not NotCovered), so an Unavailable condition shows unavailableLabel unless the Trade waits for its first Mark; no reason code is branched on. BEFORE_MARKS logic in openProps is unchanged (B1 is a plan revision). The absence check uses querySelector null, since the reason line is a paragraph with no role. |
