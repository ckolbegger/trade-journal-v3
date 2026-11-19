# D09AR TDD log, T9AR.7-B3

One file per task (decision 111), so parallel lanes never edit one file. Each row is one single-case run; see `../tdd-log.md` for the rules.

| T9AR.7-B3 | should keep Tab and Shift+Tab inside the dialog | red | `npx vitest run src/ui/cockpit/replay/overlay.test.tsx -t "should keep Tab and Shift+Tab inside the dialog"` | exit 0; Tests  11 skipped (11) |  |
| T9AR.7-B3 | should keep Tab and Shift.Tab inside the dialog | red | `npx vitest run src/ui/cockpit/replay/overlay.test.tsx -t "should keep Tab and Shift.Tab inside the dialog"` | exit 1; Tests  1 failed, 10 skipped (11) | AssertionError: expected <button type="button" …(1)></button> to be <button type="button"></button> // Object.is equality  |
| T9AR.7-B3 | should keep Tab and Shift.Tab inside the dialog | green | `npx vitest run src/ui/cockpit/replay/overlay.test.tsx -t "should keep Tab and Shift.Tab inside the dialog"` | exit 0; Tests  1 passed, 10 skipped (11) |  |

| note | First-run pass, flagged for the user. Production trap built by T9AR.7. Mutation: in overlay.tsx the Tab handler always refocuses the first item (Close) (`if (edge || ...)` and `items[0]?.focus()`). The tightened case failed (the red row above); the old in-dialog-only assertion would still have passed, since focus never left the dialog. Command: `.claude/scripts/tdd.sh red T9AR.7-B3 src/ui/cockpit/replay/overlay.test.tsx "should keep Tab and Shift.Tab inside the dialog"`. First line: AssertionError: expected Close button to be Inside button. Code restored exactly (git diff -- src shows only the test file); green row follows. Name filter uses "Shift.Tab" because "+" breaks -t. |
