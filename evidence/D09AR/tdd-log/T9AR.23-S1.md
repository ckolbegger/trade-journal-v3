# T9AR.23-S1 (lane OV)

Browser cases, run with `.claude/scripts/with-browser-lock.sh npx playwright test e2e/d9ar/overlay.spec.ts e2e/d9ar/readout.spec.ts -g "beside the charts|one line"`.

| step | result |
|---|---|
| red (test.fail lines removed, plan's grid selector only) | the readout was below the charts (x 770); with the chart box in column 1 the five "one line" cases still failed: "+$988.00 · 3.05R" is 41 px high on a 16 px font (the app's `dl` two-column grid gave each row half a group) |
| green | 6 passed (14.0s): beside the charts at 1280, and the five one-line cases |

Fix: `replay-overlay.css` places `.replay-chart-box` (not `.replay-plot-frame`) in column 1, wide and phone; at 861 px and wider the readout's `dl` is one column.

Follow-up in the same commit: the first columns (3fr, 2fr) drew the P&L chart 715 px wide at 1280, under the 800 that e2e/d9ar/responsive-a11y.spec.ts requires; the grid is now `minmax(0, 1fr) minmax(0, 340px)` (chart about 853 px at 1280).

Open: e2e/d9ar/chart.spec.ts "should list in the key only what R-BREN-U has drawn" (line 42) fails with the readout beside the charts. On Mon 11-02 the cursor's name covers the left axis label "Mon Nov 2", and corridor-pnl.tsx leaves that label out; the chart must be about 950 px or wider for them to clear, which no readout beside it at 1280 leaves room for. Needs a decision (corridor-pnl.tsx's label rule, or the case).
