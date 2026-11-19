# merge6-S1-D1 tdd-log

Regression guard for merge6-S1 (test only; no product change). Case: "should keep the P&L chart 800 wide and still, and each stake grid inside the readout, at every session of ..." in e2e/d9ar/responsive-a11y.spec.ts, generated for two launches (R-BREN-U, R-AXIO-D, R-CORV-D and R-DALE-D in one Review; R-DALE-U alone, since a Review finds Marks panels by symbol).

| step | command | result |
|---|---|---|
| note | `.claude/scripts/with-browser-lock.sh npx playwright test e2e/d9ar/responsive-a11y.spec.ts -g "at every session of"` (after build:faults and build:releases) | First-run pass, flagged for the user: merge6-S1 (2882fee8, c614cd64) built the behaviour. 2 passed in 9.6s |
| mutation | replay-overlay.css `.replay-card` column 372px changed to 480px, build:faults, same command | 2 failed: "BREN in R-BREN-U, R-AXIO-D, R-CORV-D and R-DALE-D at 1280, session 1 of 11 (Mon Nov 2 · 1 of 11): the P&L chart is 729 wide; Expected: >= 800"; R-DALE-U fails the same way |
| restore | edit back to 372px, build:faults; `git diff -- src` empty | no product change |
| browser | `npx playwright test e2e/d9ar` | 47 passed (2.0m) |
