# T8P.11 Facade and Installed Capability Manifest (structural)

Rows below are verification runs, not red/green cases. No check failed first apart from the planned negative check.

| Step | Command | Exit | Result line |
|---|---|---|---|
| Entry added to the facade only | `npm run verify:capabilities` | 1 | `FAIL installed TradeViewsAndReporting.replayTrade is not reachable from any route` and `FAIL installed variant MarketData.query (ReadSeries) is not presented by any route` (manifest entries in, trade-detail route not yet requiring them; fixed in `src/app/routes.ts`) |
| Final | `npm run verify:capabilities` | 0 | `verify:capabilities OK: 20 operations, 11 variant-qualified, 9 routes, 4 Entry Types, schema 7, release 853915...` |
| Manifest entry `TradeViewsAndReporting.replayTrade` removed | `npm run verify:capabilities` | 1 | `FAIL facade exposes TradeViewsAndReporting.replayTrade, which the manifest does not declare` and `FAIL route trade-detail requires absent capability TradeViewsAndReporting.replayTrade` |
| Entry restored | `npm run verify:capabilities` | 0 | `verify:capabilities OK: 20 operations, ...` |
| Checks | `npm run typecheck`, `npx tsc6 --noEmit`, `npm run lint`, `npm run lint:deps` | 0, 0, 0, 0 | |
