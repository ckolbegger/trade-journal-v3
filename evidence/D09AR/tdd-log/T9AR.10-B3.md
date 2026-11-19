# D09AR TDD log, T9AR.10-B3

One file per task (decision 111), so parallel lanes never edit one file. Each row is one single-case run; see `../tdd-log.md` for the rules.

| T9AR.10-B3 | should keep the Worst case and Max reward labels out of the cursor’s column at the last session | red | `npx vitest run src/ui/cockpit/replay/corridor.test.tsx -t "should keep the Worst case and Max reward labels out of the cursor’s column at the last session"` | exit 0; Tests  1 passed, 38 skipped (39) |  |
| T9AR.10-B3 | should keep the Worst case and Max reward labels out of the cursor’s column at the last session | red | `npx vitest run src/ui/cockpit/replay/corridor.test.tsx -t "should keep the Worst case and Max reward labels out of the cursor’s column at the last session"` | exit 0; Tests  1 passed, 38 skipped (39) |  |
| T9AR.10-B3 | should keep the Worst case and Max reward labels out of the cursor’s column at the last session | red | `npx vitest run src/ui/cockpit/replay/corridor.test.tsx -t "should keep the Worst case and Max reward labels out of the cursor’s column at the last session"` | exit 1; Tests  1 failed, 38 skipped (39) | AssertionError: expected false to be true // Object.is equality  |
| T9AR.10-B3 | should keep the Worst case and Max reward labels out of the cursor’s column at the last session | green | `npx vitest run src/ui/cockpit/replay/corridor.test.tsx -t "should keep the Worst case and Max reward labels out of the cursor’s column at the last session"` | exit 0; Tests  1 passed, 38 skipped (39) |  |
| T9AR.10-B3 | - | refactor | none | no change; test uses axis slots 4 so the cursor is at the last column | |
