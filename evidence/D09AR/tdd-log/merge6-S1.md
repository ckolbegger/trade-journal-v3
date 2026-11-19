# merge6-S1 tdd-log

| step | command | result |
|---|---|---|
| red | `npx playwright test e2e/d9/gaps.spec.ts:94` (browser lock, after build:faults and build:releases) | 1 failed (R-DALE-D: the grid fits, grid right edge past the viewport), 1 passed |
| measure | readout column sized to its content (fit-content 480 px) at 1280 | R-DALE-D grid 402 px, R-BREN-U Mon 11-02 grid 438 px; chart 791 px with the body's 16 px side padding (chart case: 790.75, below 800) |
| green | same case after fit-content(480px) column and 8 px body side padding at 861 px and wider | passes |
| browser | `npx playwright test e2e/d9ar e2e/d9/gaps.spec.ts e2e/d9/responsive-a11y.spec.ts e2e/d9/replay.spec.ts` | 61 passed |
| refactor | none beyond the CSS change (replay-overlay.css only) | no change |
