# T8P.26-B2 TDD log (hand-written: the cases are Playwright browser specs, which tdd.sh cannot run)

Cases (`e2e/d8p/lot-matches-fit.spec.ts`): Lot Matches in the Position drawer at 1280 px on DEF (Closed by sale) and on O-C3: scrollWidth no larger than clientWidth, every cell of the Realized column inside the box's rect, no sideways page scroll; at 375 and 320 px no sideways page scroll.

| Task | Case | Phase | Command | Outcome | Failure excerpt |
|---|---|---|---|---|---|
| T8P.26-B2 | DEF and O-C3 | red | `.claude/scripts/with-browser-lock.sh npx playwright test e2e/d8p/lot-matches-fit.spec.ts` | 2 failed | `Lot Matches overflows its box at 1280 px`, expected <= 0, received 72 (O-C3) |
| T8P.26-B2 | DEF and O-C3 | green | same, after `position.css`: at min-width 960px the Bought and Sold cells of Lot Matches wrap at their spaces (`white-space: normal`) | 2 passed | |
| T8P.26-B2 | refactor | refactor | n/a | none | |
