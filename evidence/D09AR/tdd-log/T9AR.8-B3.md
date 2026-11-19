# D09AR TDD log, T9AR.8-B3

One file per task (decision 111), so parallel lanes never edit one file. Each row is one single-case run; see `../tdd-log.md` for the rules.

| T9AR.8-B3 | should put focus on the Replay button when an overlay opened from the address closes | red | `npx vitest run src/ui/screens/TradeDetail.test.tsx -t "should put focus on the Replay button when an overlay opened from the address closes"` | exit 1; Tests  1 failed, 27 skipped (28) | AssertionError: expected <body><div>…(1)</div></body> to be <button type="button" …(1)></button> // Object.is equality  |
| T9AR.8-B3 | should put focus on the Replay button when an overlay opened from the address closes | red | `npx vitest run src/ui/screens/TradeDetail.test.tsx -t "should put focus on the Replay button when an overlay opened from the address closes"` | exit 1; Tests  1 failed, 27 skipped (28) | AssertionError: expected <body><div>…(1)</div></body> to be <button type="button" …(1)></button> // Object.is equality  |
| T9AR.8-B3 | should put focus on the Replay button when an overlay opened from the address closes | green | `npx vitest run src/ui/screens/TradeDetail.test.tsx -t "should put focus on the Replay button when an overlay opened from the address closes"` | exit 0; Tests  1 passed, 27 skipped (28) |  |
