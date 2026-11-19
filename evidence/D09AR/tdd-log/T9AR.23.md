# T9AR.23 Browser suite, part 1 (B9AR.1, B9AR.2, B9AR.3, B9AR.5, B9AR.7)

Structural task (tests only; B9AR.4 and B9AR.6 wait for T9AR.18). Lane BR, branch `d09ar/br`, base `70ce0f74`. No product code changed.

## Runs

| Run | Command | Result |
|---|---|---|
| e2e/d9ar, last run | `.claude/scripts/with-browser-lock.sh npx playwright test e2e/d9ar` (after `npm run build:faults` and `npm run build:releases`) | 35 passed (1.6m); 9 of them are `test.fail()` cases that fail as expected (list below) |
| Lane tier | `.claude/scripts/full-suite.sh evidence/D09AR T9AR.23-1 lane` | unit 2426 passed (211 files), integration 286 passed (135 files), checks 14 of 14 exit 0 |
| Stage `browser-3` | `npm run test:e2e:3` now names `e2e/d9ar` after `e2e/d9` | last recorded `browser-3` 5.0m (merge5, 79 tests); `e2e/d9ar` part 1 adds 1.6m, so about 6.6m; not run whole here (lane rule: only the files this task changes) |

## Cases that fail as expected (`test.fail`), product disagrees with the plan

1. B9AR.1 `should put the readout beside the charts at 1280`: readout x 770 is below the charts, whose box spans the full width (right edge 1247).
2. B9AR.3 `should keep every readout figure on one line for ...` (five situations): "+$642.00 · 2.02R" runs onto a second line in the readout.
3. B9AR.3 `should draw the From here sentence in the status line's colour`: rgb(85, 82, 75) against the status line's rgb(28, 27, 25).
4. B9AR.5 `should name the shaded No Mark column in the key on R-CORV-D`: the key has no "No Mark" while the P&L chart shades the column.
5. B9AR.7 `should fit the Detail overlay's ... on one 320 by 667 screen` and the Review card's: 708 px of 667.
6. B9AR.7 `should make the overlay's Close button at least 44 pixels high on a phone`: 21 px.
7. B9AR.7 `should leave no hover box after a tap on a session`: the hover box and column stay drawn.

Screenshots: `evidence/D09AR/screenshots/`.
