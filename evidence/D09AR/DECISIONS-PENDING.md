# D09AR pending decisions

Decision 113 as amended by decision 115: one question asked at a time; the others queued here.

None pending.

## Answered

### T9AR.12: a 200-high P&L chart does not fit one phone screen at 320 by 667 (answered 2026-11-19)

The phone's P&L chart is now 200 high (it was 170), as the task asks. At 320 by 667 the headline, the stake sentence, the price chart and the P&L chart then span 601 px of the 589 px above the bottom navigation, 12 px over (it fit at 170). B9.5's check fails at 320 on the Detail replay and the Review card replay (375 passes). The chart was not shortened to pass. Options put to the user: take the 12 px from the price chart's phone height (recommended); tighten the headline's or stake sentence's spacing (other lanes' files); take the 200 minimum to about 188 at 320; allow a 12 px scroll at 320.

**Answer: take the 12 px from the price chart's phone height**, at narrow widths only; the P&L chart keeps 200. Done in lane PL as **T9AR.12-D1**, red then green.
