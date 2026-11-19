Structural task (no red/green). Verification run for T9AR.8-F1: the nested ternary in the Replay overlay body of `src/ui/screens/trade-detail/Cockpit.tsx` became explicit if / else branches.

| Command | Result |
| --- | --- |
| `npx vitest run src/ui/screens/TradeDetail.test.tsx src/ui/screens/trade-detail` | Tests  123 passed (123) |
| `npm run typecheck`, `npx tsc6 --noEmit`, `npm run lint`, `npm run lint:deps` | each exit 0 |
