# D08P TDD log, T8P.12-B

One file per task (decision 111). Each row is one run; see `../tdd-log.md` for the rules.

| Task | Case | Phase | Command | Outcome | Failure excerpt |
|---|---|---|---|---|---|
| T8P.12-B1 | it should choose the days text without a nested conditional | note | `npx vitest run src/ui/cockpit/rail` | refactor kept green: before 7 passed (7), after 7 passed (7) | `daysText` in `identity.props.ts` went from a nested ternary to three guarded returns; no behaviour, words or expectations changed, and the identity cases (36 days, 1 day, today, absent) cover it. |
