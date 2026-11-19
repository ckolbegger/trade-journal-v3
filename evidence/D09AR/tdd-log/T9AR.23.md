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

# T9AR.23 part 2 (B9AR.4, B9AR.6, B9AR.3's Position-group words)

Structural, tests only; lane BR, from `9b908473` (includes T9AR.18). No product code changed.

| Run | Command | Result |
|---|---|---|
| New cases, first run | `.claude/scripts/with-browser-lock.sh npx playwright test e2e/d9ar/cards.spec.ts e2e/d9ar/states.spec.ts e2e/d9ar/readout.spec.ts -g "B9AR.4|B9AR.6|Position group" --workers=1` | 5 failed, 4 passed: four of them test mistakes (the cards left on an older page by the lookup; the position group's `has` locator; the Review's saved row read from the wrong panel); fixed in the tests |
| e2e/d9ar, last run | `.claude/scripts/with-browser-lock.sh npx playwright test e2e/d9ar --workers=1` (after `npm run build:faults` and `npm run build:releases`) | 45 passed (2.0m); none of the new cases needed `test.fail` |
| Lane tier | `.claude/scripts/full-suite.sh evidence/D09AR T9AR.23-2 lane` | unit 2440 passed (212 files), integration 286 passed (135 files), checks 14 of 14 exit 0 |
| Stage `browser-3` | not run whole | last recorded 5.0m (79 tests) before `e2e/d9ar`; `e2e/d9ar` is now 2.0m, so about 7.0m: under 8, no `browser-4` yet, about one minute of room |

New cases: cards.spec.ts (3: R-AXIO-D stepped through all 11 sessions, paged, and an earlier card pressed; R-BREN-U's Plan block and W63; R-CORV-D's W64), states.spec.ts (4: K-sale; R-DALE-U Settlement Due then Expired; Planned Trade; R-CORV-D Tue 11-10 then acknowledged), readout.spec.ts (2: Position-group Execution words for AXIO and BREN). Screenshots: `evidence/D09AR/screenshots/B9AR.4-*.png`, `B9AR.6-*.png`.

## T9AR.23-B1 (cards.spec.ts: each drawn figure checked on its own row)

Test-only. The P&L chart's figures were merged into one set of numbers across the readout and the card; each is now checked by row label and figure on the readout and again on the slider's card (At Stop, At Target, At Worst case, Realized or Banked, Past the Stop or Target by). B9AR.4 says "in the readout and on the slider's card", so both surfaces are required.

| Run | Command | Result |
|---|---|---|
| Bite | the Stop result's row changed to "at Worst case" | `.claude/scripts/with-browser-lock.sh npx playwright test e2e/d9ar/cards.spec.ts -g "R-AXIO-D"`: failed, `AXIO first session: the chart's "Stop −$600" is on its row in the readout`, expected -600, received [9940, -10000]; restored |
| After | `.claude/scripts/with-browser-lock.sh npx playwright test e2e/d9ar/cards.spec.ts` | 3 passed (9.1s) |

## T9AR.23-B2 (cards.spec.ts: checks that could pass without checking)

Test-only. Each case now names the price-line labels its trade draws (AXIO: Stop and Target; BREN and CORV: Strike) and asserts they are drawn, then matches each to the Plan block's row of the same name by its price. The price chart's Mark is now checked on the "<symbol> Mark" row of the readout and of the slider's card (B9AR.4 says every figure the charts draw). Each P&L label must yield a figure and at least one figure must have been compared.

| Run | Command | Result |
|---|---|---|
| Bite, lines | AXIO's expected lines given a "Strike" | `npx playwright test e2e/d9ar/cards.spec.ts -g "R-AXIO-D"` under the lock: failed, `AXIO first session: the price chart draws its Strike line`, expected true, received false; restored |
| Bite, Mark | the Mark row's label changed to "<symbol> Position" | failed, `the price chart's Mark "$49.70" is on the AXIO Mark row of the readout`, expected 49.7, received []; restored |
| After | `.claude/scripts/with-browser-lock.sh npx playwright test e2e/d9ar/cards.spec.ts` | 3 passed (10.3s) |

## T9AR.23-B3 (cards.spec.ts: R-BREN-U stepped through every session)

Test-only. R-BREN-U was checked at sessions 1 and 9 only; it now steps from the first session to Mon Nov 16 (sessions 2 to 11 by ArrowRight), checking the cards and every drawn figure at each, as the AXIO and CORV cases do. The sale's "Target first reached Thu Nov 12." is still checked at session 9. New screenshots `B9AR.4-BREN-session-2.png` to `-11.png` replace `B9AR.4-BREN-Thu-11-12.png` (left in place, no longer written).

| Run | Command | Result |
|---|---|---|
| Bite | the BREN loop's expected index changed to 4 at session 6 | `npx playwright test e2e/d9ar/cards.spec.ts -g "R-BREN-U"` under the lock: failed, expected "Fri Nov 6 · 5 of 11", received "Mon Nov 9 · 6 of 11"; restored |
| After | `.claude/scripts/with-browser-lock.sh npx playwright test e2e/d9ar --workers=1` (after `npm run build:faults` and `npm run build:releases`) | 45 passed (2.0m); none of the strengthened checks needed `test.fail` |