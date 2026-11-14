# D08P TDD log, T8P.23-B4

Playwright rows, logged by hand (a layout defect only the browser shows).

| Task | Case | Phase | Command | Outcome | Failure excerpt |
|---|---|---|---|---|---|
| T8P.23-B4 | should space the Position drawer tables, name Lot Matches once in visible text, and show every Open Lots column whole at 1280 px | red | `npx playwright test e2e/d6/responsive-a11y.spec.ts -g "space the Position drawer tables"` | exit 1; 1 failed | Error: Position drawer cells that touch; Received "BoughtSoldQuantityRealized (cells 3 and 4)", "$50.10 on 2026-10-12 10:00$53.00 on 2026-10-13 10:0030+$86.00 (cells 1 and 2)" |
| T8P.23-B4 | same | green | same | exit 0; 1 passed | |
| T8P.23-B4 | note | - | - | - | The visible-name and Open Lots clauses sat behind the first failing assertion, so they were not seen red. On this fixture (XYZ, 1 lot match, 1 open lot) Open Lots fits at 1280 px even with nowrap headers (mutation: header white-space nowrap, test still passed, slack 0), so that clause is a regression guard here; the critic's wider data is not reproduced by this fixture. |
