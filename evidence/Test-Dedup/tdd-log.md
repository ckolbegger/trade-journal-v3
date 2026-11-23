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

## TD.4

Moved checks went into e2e/d9ar/states.spec.ts (K-sale case, R-DALE-U case, No Mark once case), e2e/d9ar/overlay.spec.ts and the two new helpers in e2e/d9ar/support.ts. Each mutation changed one expected value, ran states.spec.ts and overlay.spec.ts, then was restored. Command each time: `.claude/scripts/with-browser-lock.sh npm run test:e2e:specs -- e2e/d9ar/states.spec.ts e2e/d9ar/overlay.spec.ts`.

| Moved check | Run | Result |
|---|---|---|
| expectSixDrawers: the selected drawer is Today (support.ts helper, used by K-sale, R-DALE-U, overlay) | mutated (expected "Position") | failed, assertion: Expected "Position", Received "Today" |
| No Mark once: readout does not contain "Mark missing" | mutated (not.toContainText "Put Mark") | failed, assertion: Expected substring: not "Put Mark" |
| expectNoPayoffOrTheory: no payoff path in the replay (support.ts helper, used by K-sale, R-DALE-U, overlay) | mutated (toHaveCount 1) | failed, assertion: toHaveCount Expected 1, Received 0 |
| R-DALE-U: no "going" line while Settlement Due | mutated (toHaveCount 1) | failed, assertion: toHaveCount |
| No Mark once: count of /No Mark for\|Mark missing/ is 1 | mutated (length 2) | failed, assertion: Expected length 2 |
| K-sale: readout Trade P&L +$1,138.00 | mutated ("+$1,139.00") | failed, assertion: toHaveText |
| R-DALE-U: Thu Nov 19 headline +$564.00 · 0.37R | mutated ("0.38R") | failed, assertion: toHaveText |
| K-sale: readout Realized +$1,138.00 | mutated ("+$1,139.00") | failed, assertion: toHaveText |
| R-DALE-U: stake sentence after expiry | mutated (trailing "!") | failed, assertion: toHaveText |
| K-sale: chart words (Sold 2 at $4.00) | mutated ("$4.01") | failed, assertion: ArrayContaining |
| R-DALE-U: "Expired" in the P&L chart | mutated ("Expired X") | failed, assertion: toContain |
| K-sale: Thu Nov 12 headline +$982.00 · 3.03R | mutated ("3.04R") | failed, assertion: toHaveText |
| K-sale: Thu Nov 12 going line | mutated ("$27.00 past it.") | failed, assertion: toHaveText |
| K-sale: Thu Nov 12 first group "How it is going" | mutated ("How it is going X") | failed, assertion: toHaveText |
| all, restored | green | `... e2e/d9ar/states.spec.ts e2e/d9ar/overlay.spec.ts e2e/d9ar/readout.spec.ts`: 23 passed |

Not mutated: the second half of expectNoPayoffOrTheory (no payoff/theoretical words), moved as written. The chart words "Realized +$478" and "Realized +$1,138" sit in the same array assertion as the mutated "Sold 2 at $4.00" and are covered by it.

## TD.5

Moved checks went into e2e/d9/estimates.spec.ts, the case "should show W47’s chips for R-BREN-U on Mon 11-16, ...". Each mutation changed one expected value and ran that case; command each time: `.claude/scripts/with-browser-lock.sh npm run test:e2e:specs -- e2e/d9/estimates.spec.ts -g "should show W47"`.

| Moved check | Run | Result |
|---|---|---|
| aria-expanded is "false" after the first Escape | mutated (expected "true") | 1 failed, assertion: Expected "true", Received "false" |
| focus is on the chip after 500 ms | mutated (not.toBeFocused) | 1 failed, assertion: Expected: not focused, Received: focused |
| second Escape closes the overlay | mutated (toHaveCount 1) | 1 failed, assertion: toHaveCount Expected 1, Received 0 |
| overlay still open after the first Escape and 500 ms | mutated (toHaveCount 0) | 1 failed, assertion: toHaveCount Expected 0, Received 1 |
| all, restored | green | `... e2e/d9/estimates-a11y.spec.ts e2e/d9/estimates.spec.ts`: 6 passed |

## TD.6

Moved checks went into e2e/d9ar/readout.spec.ts (helper `brokenReadoutFigures` and the `places` loop "should keep every figure in the readout and the header on one line, ..."). Each mutation changed one expected value and ran the DALE-hold Fri Nov 13 case; command each time: `.claude/scripts/with-browser-lock.sh npm run test:e2e:specs -- e2e/d9ar/readout.spec.ts -g "DALE-hold Fri Nov 13"`.

| Moved check | Run | Result |
|---|---|---|
| Each whole readout value (.replay-value, .replay-r, .replay-pnl-value) is one line, at 1280, 1440, 1920 | mutated (limit font x 0.1) | 1 failed, assertion: Expected [] , Received "readout: value runs onto a second line ..." |
| The stake grid ends inside the viewport | mutated (right > 10) | 1 failed, assertion: Expected [], Received "readout: the grid runs past the viewport" |
| At Worst case P&L matches the signed-amount pattern | mutated (pattern with a literal X) | 1 failed, assertion: toHaveText Expected pattern /^[−+]\$X.../ |
| all, restored | green | `... e2e/d9ar/readout.spec.ts e2e/d9ar/sweep.spec.ts e2e/d9/gaps.spec.ts`: 20 passed |

First attempt: the whole-value check at every width failed the existing cases at 375 ("≈ 540 shares" wraps before its word on a phone). The dropped case ran at the default size only, so the check runs at 1280 and wider (an assumption, recorded in structural.md).

## TD.7

Moved checks went into e2e/d9ar/review.spec.ts, the case "should restore a started Action on each card after the Price History round trip, and save exactly it with one press". Each mutation changed one expected value and ran that case; command each time: `.claude/scripts/with-browser-lock.sh npm run test:e2e:specs -- e2e/d9ar/review.spec.ts -g "should restore a started Action"`.

| Moved check | Run | Result |
|---|---|---|
| no .replay-card in the card before opening | mutated (toHaveCount 1) | 1 failed, assertion: toHaveCount Expected 1, Received 0 |
| no overlay before opening | mutated (toHaveCount 1) | 1 failed, assertion: toHaveCount Expected 1, Received 0 |
| no .replay-card in the card after opening | mutated (toHaveCount 1) | 1 failed, assertion: toHaveCount Expected 1, Received 0 |
| BREN headline on open | mutated ("+$989.00 · 3.05R") | 1 failed, assertion: toHaveText Expected "+$989.00 · 3.05R", Received "+$988.00 · 3.05R" |
| BREN headline after return | mutated ("+$983.00 · 3.03R") | 1 failed, assertion: toHaveText Expected "+$983.00 · 3.03R", Received "+$982.00 · 3.03R" |
| focus on the card's Replay button after Close | mutated (not.toBeFocused) | 1 failed, assertion: Expected: not focused, Received: focused |
| Action still started after Close (before the round trip) | mutated (Intent "wrong") | 1 failed, assertion: toHaveValue Expected "wrong" |
| zero Action entries after open, move and close | mutated (toBe saved + 1) | 1 failed, assertion: Expected 1, Received 0 |
| all, restored | green | `e2e/d9ar/review.spec.ts`: 5 passed |
