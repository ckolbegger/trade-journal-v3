# D09AR TDD log, T9AR.8-B2

One file per task (decision 111), so parallel lanes never edit one file. Each row is one single-case run; see `../tdd-log.md` for the rules.

| T9AR.8-B2 | should go back one entry on Close after Back then Forward brought the overlay back | red | `npx vitest run src/ui/screens/TradeDetail.test.tsx -t "should go back one entry on Close after Back then Forward brought the overlay back"` | exit 1; Tests  1 failed, 27 skipped (28) | AssertionError: expected 'REPLACE' to be 'POP' // Object.is equality Expected: "POP"  |
| T9AR.8-B2 | should go back one entry on Close after Back then Forward brought the overlay back | red | `npx vitest run src/ui/screens/TradeDetail.test.tsx -t "should go back one entry on Close after Back then Forward brought the overlay back"` | exit 0; Tests  26 skipped (26) |  |
| T9AR.8-B2 | should go back one entry on Close after Back then Forward brought the overlay back | red | `npx vitest run src/ui/screens/TradeDetail.test.tsx -t "should go back one entry on Close after Back then Forward brought the overlay back"` | exit 1; Tests  1 failed, 26 skipped (27) | AssertionError: expected 'REPLACE' to be 'POP' // Object.is equality Expected: "POP"  |
| T9AR.8-B2 | should go back one entry on Close after Back then Forward brought the overlay back | green | `npx vitest run src/ui/screens/TradeDetail.test.tsx -t "should go back one entry on Close after Back then Forward brought the overlay back"` | exit 0; Tests  1 passed, 26 skipped (27) |  |
