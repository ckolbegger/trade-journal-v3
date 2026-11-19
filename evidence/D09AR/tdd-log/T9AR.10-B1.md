# D09AR TDD log, T9AR.10-B1

One file per task (decision 111), so parallel lanes never edit one file. Each row is one single-case run; see `../tdd-log.md` for the rules.

| T9AR.10-B1 | should keep Expires Fri Nov 20 on an option time axis at the last session | red | `npx vitest run src/ui/cockpit/replay/corridor.test.tsx -t "should keep Expires Fri Nov 20 on an option time axis at the last session"` | exit 1; Tests  1 failed, 36 skipped (37) | TypeError: Cannot read properties of null (reading 'textContent')  |
| T9AR.10-B1 | should keep Expires Fri Nov 20 on an option time axis at the last session | green | `npx vitest run src/ui/cockpit/replay/corridor.test.tsx -t "should keep Expires Fri Nov 20 on an option time axis at the last session"` | exit 0; Tests  1 passed, 36 skipped (37) |  |
| T9AR.10-B1 | refactor | note | none | no change | Axis-end label now exempt from the cursor filter; cursor x clamped left of it. Whole replay folder (115) green. |
