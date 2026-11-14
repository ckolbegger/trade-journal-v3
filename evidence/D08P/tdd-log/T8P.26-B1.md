# T8P.26-B1 TDD log (hand-written: the case is a Playwright browser spec, which tdd.sh cannot run)

| Task | Case | Phase | Command | Outcome | Failure excerpt |
|---|---|---|---|---|---|
| T8P.26-B1 | should show the whole Payoff chart, the Now legend and both lines, inside its box at 1280 px, and keep scrolling inside the box at 375 and 320 px | red | `.claude/scripts/with-browser-lock.sh npx playwright test e2e/d8p/payoff-fit.spec.ts` (after npm run build and build:faults) | 1 failed | `chart geometry at 1280 px`: expected `lineOutside: false, nowOutside: false`, received `true, true` |
| T8P.26-B1 | same | green | same command, after `payoff.css` lets the chart shrink to its box from 1200 px (`min-width: 0`) | 1 passed | |
| T8P.26-B1 | refactor | refactor | none | no change | |
