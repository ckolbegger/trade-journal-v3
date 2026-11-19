# D09AR TDD log, T9AR.6-B3

One file per task (decision 111), so parallel lanes never edit one file. Each row is one single-case run; see `../tdd-log.md` for the rules.

| T9AR.6-B3 | it should build the Plan column from prices whose differences are not exact in floating point | red | `npx vitest run tools/replay-view-fields.test.ts -t "it should build the Plan column from prices whose differences are not exact in floating point"` | exit 1; Tests  1 failed, 2 skipped (3) | Error: Not a decimal: -20.19999999999999  |
| T9AR.6-B3 | it should build the Plan column from prices whose differences are not exact in floating point | green | `npx vitest run tools/replay-view-fields.test.ts -t "it should build the Plan column from prices whose differences are not exact in floating point"` | exit 0; Tests  1 passed, 2 skipped (3) |  |
| T9AR.6-B3 | refactor | refactor | none | no change beyond the fix; againstPlanOf takes one price so needed no change; the test also asserts atStop, atTarget, rewardRisk and each condition pnlIfHit exactly (quantity 2) | |
