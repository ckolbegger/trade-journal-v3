# D08P TDD log, T8P.BUG-4.2

One file per task (decision 111), so parallel lanes never edit one file. Each row is one single-case run; see `../tdd-log.md` for the rules.

| Task | Case | Phase | Command | Outcome | Failure excerpt |
|---|---|---|---|---|---|
| T8P.BUG-4.2 | should return nothing when a fixture exists for every schema from 1 to the current one | red | `npx vitest run tools/verify-fixtures.test.ts -t "should return nothing when a fixture exists for every schema from 1 to the current one"` | exit 0; Tests  1 passed, 3 skipped (4) |  |
| T8P.BUG-4.2 | should name a missing middle schema | red | `npx vitest run tools/verify-fixtures.test.ts -t "should name a missing middle schema"` | exit 1; Tests  1 failed, 3 skipped (4) | AssertionError: expected [] to deeply equal [ 2 ]  |
| T8P.BUG-4.2 | should name the current schema when its fixture is missing | red | `npx vitest run tools/verify-fixtures.test.ts -t "should name the current schema when its fixture is missing"` | exit 1; Tests  1 failed, 3 skipped (4) | AssertionError: expected [] to deeply equal [ 3 ]  |
| T8P.BUG-4.2 | should ignore names that are not Workspace fixtures | red | `npx vitest run tools/verify-fixtures.test.ts -t "should ignore names that are not Workspace fixtures"` | exit 1; Tests  1 failed, 3 skipped (4) | AssertionError: expected [] to deeply equal [ 2 ]  |
| T8P.BUG-4.2 | should return nothing when a fixture exists for every schema from 1 to the current one | green | `npx vitest run tools/verify-fixtures.test.ts -t "should return nothing when a fixture exists for every schema from 1 to the current one"` | exit 0; Tests  1 passed, 3 skipped (4) |  |
| T8P.BUG-4.2 | should name a missing middle schema | green | `npx vitest run tools/verify-fixtures.test.ts -t "should name a missing middle schema"` | exit 0; Tests  1 passed, 3 skipped (4) |  |
| T8P.BUG-4.2 | should name the current schema when its fixture is missing | green | `npx vitest run tools/verify-fixtures.test.ts -t "should name the current schema when its fixture is missing"` | exit 0; Tests  1 passed, 3 skipped (4) |  |
| T8P.BUG-4.2 | should ignore names that are not Workspace fixtures | green | `npx vitest run tools/verify-fixtures.test.ts -t "should ignore names that are not Workspace fixtures"` | exit 0; Tests  1 passed, 3 skipped (4) |  |
| note | should return nothing when a fixture exists for every schema from 1 to the current one | First-run pass, flagged for the user: the case passed against the stub helper that returns an empty list (written so the file imports; no earlier task built this behavior). Mutation after the real helper: invert the presence check (`present.has` instead of `!present.has`). Command: `npx vitest run tools/verify-fixtures.test.ts -t "should return nothing when a fixture exists"`. First failure line: `AssertionError: expected [ 1, 2, 3 ] to deeply equal []`. Restored; green rerun passed. |
| refactor | all four | No change: helper is a small loop in `tools/fixture-schemas.ts`. Case 4 name rephrased "aren't" to "are not" (quote breaks -t). Tests exercise the helper only; the verify-fixtures wiring is checked by `npm run verify:fixtures` (structural.md). |
