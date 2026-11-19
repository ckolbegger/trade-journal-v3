# merge6-S1 tdd-log

| step | command | result |
|---|---|---|
| red | `npx playwright test e2e/d9/gaps.spec.ts:94` (browser lock, after build:faults and build:releases) | 1 failed (R-DALE-D: the grid fits, grid right edge past the viewport), 1 passed |
| measure | readout column sized to its content (fit-content 480 px) at 1280 | R-DALE-D grid 402 px, R-BREN-U Mon 11-02 grid 438 px; chart 791 px with the body's 16 px side padding (chart case: 790.75, below 800) |
| green | same case after fit-content(480px) column and 8 px body side padding at 861 px and wider | passes |
| browser | `npx playwright test e2e/d9ar e2e/d9/gaps.spec.ts e2e/d9/responsive-a11y.spec.ts e2e/d9/replay.spec.ts` | 61 passed |
| red (S1b) | scratch spec (deleted) stepping every session of R-BREN-U, AXIO, CORV, DALE-hold and R-DALE-D at 1280 against commit 1538b776 | widest grid 473 px (AXIO Mon 11-09); narrowest P&L chart 736.5 px (AXIO Mon 11-09), also 745 (R-DALE-D, DALE-hold Thu 11-12), 766 (CORV), 771 (BREN Mon 11-02); the column and chart changed with the slider. The width came from the Past the Stop sentence, which fit-content counts unwrapped, not from the figures |
| measure (S1b) | column fixed narrow (300 px) | the grid's true minimum (every figure on one line) is 310 (BREN), 327 (AXIO), 324 (CORV), 367.3 (DALE-hold, R-DALE-D) with the stake grid's gaps 6 px instead of 12 |
| green (S1b) | column 372 px fixed; stake grid gaps 6 px and no right padding at 861 px and wider (replay-readout.css); body side padding 8 px | every session of all five Trades: grid 372 px, P&L chart 837 px constant; no grid overflow |
| browser (S1b) | `npx playwright test e2e/d9ar e2e/d9/gaps.spec.ts e2e/d9/responsive-a11y.spec.ts e2e/d9/replay.spec.ts` | 61 passed |
| refactor | none beyond the CSS change (replay-overlay.css only) | no change |
