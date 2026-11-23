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
