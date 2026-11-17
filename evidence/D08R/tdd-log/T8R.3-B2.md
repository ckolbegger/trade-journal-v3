# D08R TDD log, T8R.3-B2

One file per task (decision 111), so parallel lanes never edit one file. Each row is one single-case run; see `../tdd-log.md` for the rules.

| T8R.3-B2 | should keep a strike third decimal, XYZ Dec 18 52.505 Put | red | `npx vitest run src/ui/calculation-words.test.ts -t "should keep a strike third decimal, XYZ Dec 18 52.505 Put"` | exit 1; Tests  1 failed, 25 skipped (26) | AssertionError: expected 'XYZ Dec 18 $52.51 Put' to be 'XYZ Dec 18 $52.505 Put' // Object.is equality Expected: "XYZ Dec 18 $52.505 Put"  |
| T8R.3-B2 | should keep a strike third decimal, XYZ Dec 18 52.505 Put | green | `npx vitest run src/ui/calculation-words.test.ts -t "should keep a strike third decimal, XYZ Dec 18 52.505 Put"` | exit 0; Tests  1 passed, 25 skipped (26) |  |

| refactor | T8R.3-B2 | No change; summaryStrike has one added branch for a third decimal. Test placed in src/ui/calculation-words.test.ts. |
