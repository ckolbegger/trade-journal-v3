# D9AR-retro-1 tdd-log

`tdd.sh` refuses the task ID `D9AR-retro-1` (it wants T<n>.<m>), so the rows are written by hand, with the same commands it runs.

| step | command | result |
|---|---|---|
| red | `npx playwright test e2e/d9ar/sweep.spec.ts` before the fix (the findings dump from the first sweep run, 248 lines) | 4 failed (BREN, AXIO, DALE_HOLD, CORV): unmarked figure text in .replay-going ("Ahead: 12% of the way to the Target."), .replay-crossing, .replay-stake and .replay-strip-labels, at 375 and 320, every session |
| red | `npx vitest run src/ui/cockpit/replay/frame.test.tsx -t "should draw the figures of the going"` | 1 failed: expected [] to deeply equal [ '15%' ] |
| red | `npx vitest run src/ui/cockpit/replay/corridor.test.tsx -t "should keep the result and banked labels when drawn narrow"` | 1 failed: each figure of the strip is one figure: expected [] to deeply equal [ '+$316', '+$478', '+$956' ] |
| red | `npx vitest run src/ui/cockpit/replay/figure-parts.test.ts` | 1 failed (a percentage alone, "15%", was not a figure); two more cases written with it passed at once and were dropped as redundant |
| green | `npx vitest run src/ui/cockpit` | 397 passed (the three frame tests that looked a sentence up by one element's own text now look it up by all its text, `whole()`; same words) |
| green | `npx playwright test e2e/d9ar/sweep.spec.ts` (after build:faults and build:releases) | 4 passed (15.5s) |
| mutation | `Words` removed from the Plan block rows in frame.tsx, rebuilt, `npx playwright test e2e/d9ar/sweep.spec.ts -g BREN` | 1 failed: `BREN at 375, Mon Nov 2 · 1 of 11: replay-plan: unmarked figure in "Entry: 4 contracts at $1.61"`; restored and rebuilt |
| refactor | none beyond the above | no change |
