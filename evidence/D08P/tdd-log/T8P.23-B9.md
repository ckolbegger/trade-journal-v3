# D08P TDD log, T8P.23-B9

One file per task (decision 111), so parallel lanes never edit one file. Each row is one single-case run; see `../tdd-log.md` for the rules.

| Task | Case | Phase | Command | Outcome | Failure excerpt |
|---|---|---|---|---|---|
| T8P.23-B9 | should name the contract on the expiration day itself, with no Mark missing text on the card | red | `npx vitest run src/ui/cockpit/rail/pnl.props.test.tsx -t "should name the contract on the expiration day itself, with no Mark missing text on the card"` | exit 1; Tests  1 failed, 7 skipped (8) | AssertionError: expected 'Mark missing: XYZ 20 Nov 2026 55 Call…' to be 'Settlement Due: XYZ 20 Nov 2026 55 Ca…' // Object.is equality Expected: "Settlement Due: XYZ 20 Nov 2026 55 Call"  |
| T8P.23-B9 | should word Risk to stop and Reward to target as Settlement Due on the expiration day, with no Mark missing text | red | `npx vitest run src/ui/cockpit/drawers/plan-risk.test.tsx -t "should word Risk to stop and Reward to target as Settlement Due on the expiration day, with no Mark missing text"` | exit 1; Tests  1 failed, 6 skipped (7) | AssertionError: expected [ …(2) ] to deeply equal [ …(2) ]  |
| T8P.23-B9 | should name the contract on the expiration day itself, with no Mark missing text on the card | green | `npx vitest run src/ui/cockpit/rail/pnl.props.test.tsx -t "should name the contract on the expiration day itself, with no Mark missing text on the card"` | exit 0; Tests  1 passed, 7 skipped (8) |  |
| T8P.23-B9 | should word Risk to stop and Reward to target as Settlement Due on the expiration day, with no Mark missing text | green | `npx vitest run src/ui/cockpit/drawers/plan-risk.test.tsx -t "should word Risk to stop and Reward to target as Settlement Due on the expiration day, with no Mark missing text"` | exit 0; Tests  1 passed, 6 skipped (7) |  |
