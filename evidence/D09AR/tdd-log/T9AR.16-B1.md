# D09AR TDD log, T9AR.16-B1

One file per task (decision 111), so parallel lanes never edit one file. Each row is one single-case run; see `../tdd-log.md` for the rules.

| T9AR.16-B1 | should link an option Trade to the Review row by the contract key the Marks rows use, not the listing symbol, R-CORV-D Tue 11-10 | red | `npx vitest run src/ui/cockpit/replay/replay.props.test.ts -t "should link an option Trade to the Review row by the contract key the Marks rows use, not the listing symbol, R-CORV-D Tue 11-10"` | exit 1; Tests  1 failed, 11 skipped (12) | AssertionError: expected '/review?trade=T-1&instrument=DALE' to be '/review?trade=T-1&instrument=DALE2611…' // Object.is equality Expected: "/review?trade=T-1&instrument=DALE261120P00057500"  |
| T9AR.16-B1 | should link an option Trade to the Review row by the contract key the Marks rows use, not the listing symbol, R-CORV-D Tue 11-10 | green | `npx vitest run src/ui/cockpit/replay/replay.props.test.ts -t "should link an option Trade to the Review row by the contract key the Marks rows use, not the listing symbol, R-CORV-D Tue 11-10"` | exit 0; Tests  1 passed, 11 skipped (12) |  |
| T9AR.16-B1 | should link a session with a missing or acknowledged Mark | green | `npx vitest run src/ui/cockpit/replay/replay.props.test.ts -t "should link a session with a missing or acknowledged Mark"` | exit 1; Tests  1 failed, 11 skipped (12) | AssertionError: expected [ undefined, …(1) ] to deeply equal [ undefined, …(1) ]  |
- refactor: none (no change beyond the fix).
| T9AR.16-B1 | should link | green | `npx vitest run src/ui/cockpit/replay/replay.props.test.ts -t "should link"` | exit 0; Tests  2 passed, 10 skipped (12) |  |
