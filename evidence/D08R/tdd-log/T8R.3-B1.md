# D08R TDD log, T8R.3-B1

One file per task (decision 111), so parallel lanes never edit one file. Each row is one single-case run; see `../tdd-log.md` for the rules.

| T8R.3-B1 | should decide the current year in the Workspace zone | red | `npx vitest run src/ui/calculation-words.test.ts -t "should decide the current year in the Workspace zone"` | exit 1; Tests  1 failed, 24 skipped (25) | AssertionError: expected 'XYZ Jan 15 $55 Call' to be 'XYZ Jan 15 2027 $55 Call' // Object.is equality Expected: "XYZ Jan 15 2027 $55 Call"  |
| T8R.3-B1 | should decide the current year in the Workspace zone | green | `npx vitest run src/ui/calculation-words.test.ts -t "should decide the current year in the Workspace zone"` | exit 0; Tests  1 passed, 24 skipped (25) |  |
| refactor | T8R.3-B1 | no refactor needed; zone threaded as optional second parameter (needed by tools/bench/compare.ts and unowned callers); text() also takes optional zone |
