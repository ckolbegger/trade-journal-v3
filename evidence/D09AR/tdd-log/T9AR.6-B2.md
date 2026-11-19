# D09AR TDD log, T9AR.6-B2

One file per task (decision 111), so parallel lanes never edit one file. Each row is one single-case run; see `../tdd-log.md` for the rules.

| T9AR.6-B2 | it should build the Plan column and a fill distance from a decimal price | red | `npx vitest run tools/replay-view-fields.test.ts -t "it should build the Plan column and a fill distance from a decimal price"` | exit 1; Tests  1 failed, 1 skipped (2) | RangeError: The number 100.5 cannot be converted to a BigInt because it is not an integer  |
| T9AR.6-B2 | it should build the Plan column and a fill distance from a decimal price | green | `npx vitest run tools/replay-view-fields.test.ts -t "it should build the Plan column and a fill distance from a decimal price"` | exit 0; Tests  1 passed, 1 skipped (2) |  |
| T9AR.6-B2 | replay view field builders | green | `npx vitest run tools/replay-view-fields.test.ts -t "replay view field builders"` | exit 0; Tests  2 passed (2) |  |
