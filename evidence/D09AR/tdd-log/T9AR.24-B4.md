# D09AR TDD log, T9AR.24-B4

One file per task (decision 111), so parallel lanes never edit one file. Each row is one single-case run; see `../tdd-log.md` for the rules.

| T9AR.24-B4 | should show the dash named No Mark in the Trade P&L row, and say no Mark missing anywhere in the readout, R-CORV-D Tue 11-10 | red | `npx vitest run src/ui/cockpit/replay/readout.props.test.ts -t "should show the dash named No Mark in the Trade P&L row, and say no Mark missing anywhere in the readout, R-CORV-D Tue 11-10"` | exit 1; Tests  1 failed, 27 skipped (28) | AssertionError: expected { kind: 'Unavailable', …(1) } to deeply equal { Object (kind, text) }  |
| T9AR.24-B4 | should show the dash named No Mark in the Trade P&L row, and say no Mark missing anywhere in the readout, R-CORV-D Tue 11-10 | green | `npx vitest run src/ui/cockpit/replay/readout.props.test.ts -t "should show the dash named No Mark in the Trade P&L row, and say no Mark missing anywhere in the readout, R-CORV-D Tue 11-10"` | exit 0; Tests  1 passed, 27 skipped (28) |  |
| T9AR.24-B4 | e2e/d9/gaps.spec.ts: should show No Mark on Tue 11-10 with the two results kept and no figure carried (Trade P&L expectation now the dash named No Mark) | red | `npx playwright test e2e/d9/gaps.spec.ts` after the fix, before the expectation changed | 1 failed, 71 passed in the combined run | Expected "Mark missing: CORV Nov 20 $80 Put, Tue Nov 10"; Received "—" |
| T9AR.24-B4 | same case | green | `npx playwright test e2e/d9/gaps.spec.ts` | 5 passed | |
| T9AR.24-B4 | refactor | note | session-words.props.ts comment corrected (no longer says the readout row reads headlineOf's reason); no code change | | |
