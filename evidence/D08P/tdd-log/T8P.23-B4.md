# D08P TDD log, T8P.23-B4

Playwright rows, logged by hand (a layout defect only the browser shows).

| Task | Case | Phase | Command | Outcome | Failure excerpt |
|---|---|---|---|---|---|
| T8P.23-B4 | should space the Position drawer tables, name Lot Matches once in visible text, and show every Open Lots column whole at 1280 px | red | `npx playwright test e2e/d6/responsive-a11y.spec.ts -g "space the Position drawer tables"` | exit 1; 1 failed | Error: Position drawer cells that touch; Received "BoughtSoldQuantityRealized (cells 3 and 4)", "$50.10 on 2026-10-12 10:00$53.00 on 2026-10-13 10:0030+$86.00 (cells 1 and 2)" |
| T8P.23-B4 | same | green | same | exit 0; 1 passed | |
| T8P.23-B4 | note | - | - | - | The visible-name and Open Lots clauses sat behind the first failing assertion, so they were not seen red. On this fixture (XYZ, 1 lot match, 1 open lot) Open Lots fits at 1280 px even with nowrap headers (mutation: header white-space nowrap, test still passed, slack 0), so that clause is a regression guard here; the critic's wider data is not reproduced by this fixture. |
| T8P.23-B4 | should show the Position drawer tables of a Settlement Due option Trade spaced, with Lot Matches named once and every Open Lots column and figure inside its region at 1280 px | note (round 2) | `npx playwright test e2e/d7/responsive-a11y.spec.ts -g "Open Lots column and figure inside"` | exit 0 on 7dccdff5 (first-run pass, flagged) | O-C3-like fixture (createSettlementFixture, T-1: 1 contract left, unconsumed opening fee $0.65). Round 1's stock fixture did not reproduce the cut-off. |
| T8P.23-B4 | same | mutation red: Open Lots header wrap rule reverted to `white-space: nowrap` (rebuild, then run) | same | exit 1; 1 failed | `cut: ["Unconsumed opening fee", "$0.65"]`, `scrolls: true` (expected `cut: []`, `scrolls: false`). Rule restored. |
| T8P.23-B4 | same | mutation red: caption-hiding rule disabled (selector changed so it matches nothing; rebuild faults and releases) | same, and `e2e/d6/responsive-a11y.spec.ts -g "space the Position drawer"` | exit 1; 1 failed each | `Expected: 1  Received: 2` (visible Lot Matches names). Rule restored. A run that rebuilt only dist and dist-faults left dist-releases stale, so build:releases is needed for the d6 spec. |
