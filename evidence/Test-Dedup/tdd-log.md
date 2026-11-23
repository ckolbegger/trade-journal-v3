# Test dedup TDD log

Browser-test dedup (plan/browser-test-duplicates-plan.md). Rows are mutation checks of moved checks: a wrong expected value, run, see the assertion fail, restore, run green.

## TD.1

| Moved check | Run | Command | Result |
|---|---|---|---|
| BD5: key contains "No Mark" on Wed 11-11 (chart "should shade the session with no Mark on R-CORV-D, ...") | mutated (expected "No Mark X") | `.claude/scripts/with-browser-lock.sh npm run test:e2e:specs -- e2e/d9ar/chart.spec.ts -g "should shade the session with no Mark on R-CORV-D"` | 1 failed, assertion: "Expected value: "No Mark X"", Received array contains "No Mark" |
| BD5: key contains "No Mark" on Tue Nov 10 after one ArrowLeft | mutated (expected "No Mark X") | same | 1 failed, assertion: "the key on Tue Nov 10 · 7 of 8", Expected value "No Mark X" |
| both, restored | green | `... e2e/d9ar/chart.spec.ts e2e/d9ar/readout.spec.ts e2e/d9ar/sweep.spec.ts` | 35 passed |

## TD.2

Moved checks went into e2e/d8p/states.spec.ts "should show a Settlement Due Detail with Today selected ...". Each mutation changed one expected value, ran the case, then was restored.

| Moved check | Run | Command | Result |
|---|---|---|---|
| BD17: Put Mark Change is "—" (Settlement Due) | mutated ("X—") | `.claude/scripts/with-browser-lock.sh npm run test:e2e:specs -- e2e/d8p/states.spec.ts -g "should show a Settlement Due Detail with Today selected"` | 1 failed, assertion: expect(locator).toHaveText(expected) |
| BD17: "Expired" appears once in Today | mutated (count 2) | same | 1 failed, assertion: toHaveCount |
| BD17: "Where the prices sit" absent | mutated (count 1) | same | 1 failed, assertion: toHaveCount |
| BD17: "Closed" absent while Settlement Due | mutated (count 1) | same | 1 failed, assertion: toHaveCount |
| BD17: Closed stamp in the accessibility tree | mutated ("Closed X") | same | 1 failed, assertion: the accessibility tree of Today |
| BD17: Closed stamp has no aria-hidden ancestor | mutated (toBe false) | same | 1 failed, assertion: expect(received).toBe(expected) |
| BD17: MNO Mark Today cell empty after Closed | mutated ("X") | same | 1 failed, assertion: toHaveText |
| BD17: Put Mark Change is "—" after Closed | mutated ("X—") | same | 1 failed, assertion: toHaveText |
| all, restored | green | `... e2e/d8p/history.spec.ts e2e/d8p/states.spec.ts e2e/d8r/history.spec.ts e2e/d8r/states.spec.ts` | 9 passed |

BD14 moved nothing, so it has no mutation row.

## TD.2-F1

Moved into e2e/d8p/states.spec.ts "should show a Settlement Due Detail with Today selected ...". Each mutation changed one expected value, ran the case, then was restored.

| Moved check | Run | Command | Result |
|---|---|---|---|
| Marks row labels ["MNO Mark", "Put Mark"] | mutated ("MNO Mark X") | `.claude/scripts/with-browser-lock.sh npm run test:e2e:specs -- e2e/d8p/states.spec.ts -g "should show a Settlement Due Detail with Today selected"` | 1 failed, assertion: toHaveText (Expected - 1, Received + 1) |
| Yesterday cell accessible name after Closed | mutated ("Expired Fri Nov 21") | same | 1 failed, assertion: toHaveAccessibleName, Expected "Expired Fri Nov 21", Received "Expired Fri Nov 20" |
| both, restored | green | `... e2e/d8p/states.spec.ts` | 3 passed |

## TD.3

Moved checks went into e2e/d9ar/responsive-a11y.spec.ts (`expectPhoneLabels`, `throughSizes`, the new `expectFocusedControlsUncovered`, and the tap case). Each mutation changed one expected value (the d9:168 check: a full-screen cover was injected), ran the case, then was restored. "Detail" = "should fit the Detail overlay on one screen"; the Review card case runs the same `throughSizes`.

| Moved check | Run | Command | Result |
|---|---|---|---|
| BD2/3: price title "BREN price" | mutated | `.claude/scripts/with-browser-lock.sh npm run test:e2e:specs -- e2e/d9ar/responsive-a11y.spec.ts -g "should fit the Detail overlay on one screen"` | 1 failed, assertion: Detail overlay at 375 px: price title |
| BD2/3: P&L title "Trade P&L" | mutated | `.claude/scripts/with-browser-lock.sh npm run test:e2e:specs -- e2e/d9ar/responsive-a11y.spec.ts -g "should fit the Detail overlay on one screen"` | 1 failed, assertion: Detail overlay at 375 px: P&L title |
| BD2/3: no long price title | mutated | `.claude/scripts/with-browser-lock.sh npm run test:e2e:specs -- e2e/d9ar/responsive-a11y.spec.ts -g "should fit the Detail overlay on one screen"` | 1 failed, assertion: Detail overlay at 375 px: no long price title |
| BD2/3: no long P&L title | mutated | `.claude/scripts/with-browser-lock.sh npm run test:e2e:specs -- e2e/d9ar/responsive-a11y.spec.ts -g "should fit the Detail overlay on one screen"` | 1 failed, assertion: Detail overlay at 375 px: no long P&L title |
| BD2/3: every Sold marker reads "Sold 2" | mutated | `.claude/scripts/with-browser-lock.sh npm run test:e2e:specs -- e2e/d9ar/responsive-a11y.spec.ts -g "should fit the Detail overlay on one screen"` | 1 failed, assertion: Detail overlay at 375 px: marker |
| BD2/3: Risk and Reward tags start with "$" | mutated | `.claude/scripts/with-browser-lock.sh npm run test:e2e:specs -- e2e/d9ar/responsive-a11y.spec.ts -g "should fit the Detail overlay on one screen"` | 1 failed, assertion: Detail overlay at 375 px: stake tags Worst case +$156 / Stop +$316 / Realized +$478 / Target +$956 / Risk $666 / $26 past the Target / Target reached / Sold 2 |
| BD3: wide results Stop +$316 at the lines | mutated | `.claude/scripts/with-browser-lock.sh npm run test:e2e:specs -- e2e/d9ar/responsive-a11y.spec.ts -g "should fit the Detail overlay on one screen"` | 1 failed, assertion: Detail overlay at 1280 px: the results at the lines |
| BD16: tap leaves no hover box | mutated | `.claude/scripts/with-browser-lock.sh npm run test:e2e:specs -- e2e/d9ar/responsive-a11y.spec.ts -g "should move the slider by a tap"` | 1 failed, assertion: a tap leaves no hover box |
| BD16: tap leaves no hover column | mutated | `.claude/scripts/with-browser-lock.sh npm run test:e2e:specs -- e2e/d9ar/responsive-a11y.spec.ts -g "should move the slider by a tap"` | 1 failed, assertion: a tap leaves no hover column |
| d9:168: nothing covers a focused control (a full-screen cover injected) | mutated | `.claude/scripts/with-browser-lock.sh npm run test:e2e:specs -- e2e/d9ar/responsive-a11y.spec.ts -g "should fit the Detail overlay on one screen"` | 1 failed, assertion: Detail overlay at 375 px: "Previous session" (y 222 to 266) has something over its centre |
| all, restored | green | `.claude/scripts/with-browser-lock.sh npm run test:e2e:specs -- e2e/d9ar/responsive-a11y.spec.ts` | 18 passed |
