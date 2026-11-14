# D08P TDD log, T8P.26-B5

One file per task (decision 111), so parallel lanes never edit one file. Each row is one single-case run; see `../tdd-log.md` for the rules.

| Task | Case | Phase | Command | Outcome | Failure excerpt |
|---|---|---|---|---|---|
| T8P.26-B5 | should show only the first-Marks note, with no Mark missing link, for a Mark missing at a close where nothing was held | red | `npx vitest run src/ui/cockpit/rail/needs-you.props.test.tsx -t "should show only the first-Marks note, with no Mark missing link, for a Mark missing at a close where nothing was held"` | exit 1; Tests  1 failed, 6 skipped (7) | AssertionError: expected [ …(2) ] to deeply equal [ Array(1) ]  |
| T8P.26-B5 | should not say a Mark is missing for the value at expiration before the first Marks, and say when they are due | red | `npx vitest run src/ui/cockpit/drawers/payoff.test.tsx -t "should not say a Mark is missing for the value at expiration before the first Marks, and say when they are due"` | exit 1; Tests  1 failed, 4 skipped (5) | AssertionError: expected 'Mark missing: XYZ, Thu Nov 19' to be 'First Marks are due once the Mon Nov …' // Object.is equality Expected: "First Marks are due once the Mon Nov 23 session ends."  |
| T8P.26-B5 | should show only the first-Marks note, with no Mark missing link, for a Mark missing at a close where nothing was held | green | `npx vitest run src/ui/cockpit/rail/needs-you.props.test.tsx -t "should show only the first-Marks note, with no Mark missing link, for a Mark missing at a close where nothing was held"` | exit 0; Tests  1 passed, 6 skipped (7) |  |
| T8P.26-B5 | should not say a Mark is missing for the value at expiration before the first Marks, and say when they are due | green | `npx vitest run src/ui/cockpit/drawers/payoff.test.tsx -t "should not say a Mark is missing for the value at expiration before the first Marks, and say when they are due"` | exit 0; Tests  1 passed, 4 skipped (5) |  |

| note | Browser case e2e/d8p/first-marks-pending.spec.ts: red by mutation (Needs you guard removed, rebuilt): `expect(locator).toHaveCount(0)` Received 1 on the Mark missing link; green with the fix (1 passed). Specs run: evidence/D08P/browser/T8P.26-B5-specs.txt (28 passed). |
