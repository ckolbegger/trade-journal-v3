# D08P TDD log, T8P.23-B3-B1

One file per task (decision 111), so parallel lanes never edit one file. Each row is one single-case run; see `../tdd-log.md` for the rules.

| Task | Case | Phase | Command | Outcome | Failure excerpt |
|---|---|---|---|---|---|
| T8P.23-B3-B1 | should show the Mark, Source, Saved and Underlying Mark in the Position drawer card even when the replay holds an available Mark | red | `npx vitest run src/ui/screens/trade-detail/Placed.test.tsx -t "should show the Mark, Source, Saved and Underlying Mark in the Position drawer card even when the replay holds an available Mark"` | exit 1; Tests  1 failed, 8 skipped (9) | TestingLibraryElementError: Unable to find an element with the text: Mark, which matches selector 'dt'. This could be because the text is broken up by multiple elements. In this case, you can provide a function for your  |
| T8P.23-B3-B1 | should show the Mark, Source, Saved and Underlying Mark in the Position drawer card even when the replay holds an available Mark | green | `npx vitest run src/ui/screens/trade-detail/Placed.test.tsx -t "should show the Mark, Source, Saved and Underlying Mark in the Position drawer card even when the replay holds an available Mark"` | exit 0; Tests  1 passed, 8 skipped (9) |  |
