# Test dedup TDD log

Browser-test dedup (plan/browser-test-duplicates-plan.md). Rows are mutation checks of moved checks: a wrong expected value, run, see the assertion fail, restore, run green.

## TD.1

| Moved check | Run | Command | Result |
|---|---|---|---|
| BD5: key contains "No Mark" on Wed 11-11 (chart "should shade the session with no Mark on R-CORV-D, ...") | mutated (expected "No Mark X") | `.claude/scripts/with-browser-lock.sh npm run test:e2e:specs -- e2e/d9ar/chart.spec.ts -g "should shade the session with no Mark on R-CORV-D"` | 1 failed, assertion: "Expected value: "No Mark X"", Received array contains "No Mark" |
| BD5: key contains "No Mark" on Tue Nov 10 after one ArrowLeft | mutated (expected "No Mark X") | same | 1 failed, assertion: "the key on Tue Nov 10 · 7 of 8", Expected value "No Mark X" |
| both, restored | green | `... e2e/d9ar/chart.spec.ts e2e/d9ar/readout.spec.ts e2e/d9ar/sweep.spec.ts` | 35 passed |
