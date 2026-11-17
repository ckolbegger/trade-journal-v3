# D08R TDD log, T8R.24

One file per task (decision 111), so parallel lanes never edit one file. Each row is one single-case run; see `../tdd-log.md` for the rules.

| T8R.24 | should word a figure and a sentence | red | `npx vitest run src/ui/calculation-words.test.ts -t "should word a figure and a sentence"` | exit 1; Tests  1 failed, 27 skipped (28) | AssertionError: expected 'Awaiting the close after Fri Oct 9' to be 'Awaiting the Mon Oct 12 close' // Object.is equality Expected: "Awaiting the Mon Oct 12 close"  |
| T8R.24 | should keep the existing words when due is absent | red | `npx vitest run src/ui/calculation-words.test.ts -t "should keep the existing words when due is absent"` | exit 0; Tests  1 passed, 27 skipped (28) |  |
| T8R.24 | should word a figure and a sentence | green | `npx vitest run src/ui/calculation-words.test.ts -t "should word a figure and a sentence"` | exit 0; Tests  1 passed, 27 skipped (28) |  |
| T8R.24 | should keep the existing words when due is absent | green | `npx vitest run src/ui/calculation-words.test.ts -t "should keep the existing words when due is absent"` | exit 0; Tests  1 passed, 27 skipped (28) |  |

note | First-run pass, flagged for the user | case "should keep the existing words when due is absent": the pre-existing no-due branch of AwaitingClose already produced these words. Mutation: the due branch always taken (`due ?? after`). Command: `npx vitest run src/ui/calculation-words.test.ts -t "should keep the existing words when due is absent"`. Failure: `AssertionError: expected 'Awaiting the Mon Oct 12 close' to be 'Awaiting the close after Mon Oct 12'`.
| T8R.24 | fails on the dated before-Marks words, whole or split around the date W34 | red | `npx vitest run tools/wording-rules.test.ts -t "fails on the dated before-Marks words, whole or split around the date W34"` | exit 0; Tests  38 skipped (38) |  |
| T8R.24 | fails on the dated before-Marks words | red | `npx vitest run tools/wording-rules.test.ts -t "fails on the dated before-Marks words"` | exit 1; Tests  1 failed, 37 skipped (38) | AssertionError: expected [] to deeply equal [ 1 ]  |
| T8R.24 | fails on the dated before-Marks words | green | `npx vitest run tools/wording-rules.test.ts -t "fails on the dated before-Marks words"` | exit 0; Tests  1 passed, 37 skipped (38) |  |
| T8R.24 | fails on the dated before-Marks words | green | `npx vitest run tools/wording-rules.test.ts -t "fails on the dated before-Marks words"` | exit 0; Tests  1 passed, 37 skipped (38) |  |

refactor | none | No production change beyond the green steps. The wording rule's red/green is the case "fails on the dated before-Marks words, whole or split around the date, W34" in tools/wording-rules.test.ts (name rephrased: parentheses removed).
