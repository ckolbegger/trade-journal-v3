# D09AR pending decisions

Decision 113 as amended by decision 115: one question asked at a time; the others queued here.

None pending.

## Answered

### T9AR.18: the first-crossing sentence does not fit one phone screen at 320 by 667 (answered 2026-11-19)

**Answer: below the charts on a phone (option 1).** On a phone only, the sentence follows the charts, above the readout; wide screens are unchanged and the words are unchanged. Done in lane SC as **T9AR.18-D1**.

T9AR.18 puts W64's sentence ("Target first reached Thu Nov 12.") after the status line, as W64 says. On a session with a crossing, that adds one line at the top. At 320 by 667 the headline and both charts then span 616 px of the 588.9 px allowed, 27 px over. B9.5's check fails on the Detail replay and on the Review card replay at 320. Switching the sentence off makes it pass, so the Plan block is not the cause. No chart was shortened. Options:

1. On a phone only, show the sentence after the charts, above the readout (CSS order). The words are unchanged. (Recommended by the task.)
2. Fold it into the status line's own line and shorten the status words (P137).
3. Raise B9.5's 320 px budget by one line.
4. Leave it off a phone's top. The date stays in the card's Events ("Target first reached") and on the chart's flag.

### T9AR.12: a 200-high P&L chart does not fit one phone screen at 320 by 667 (answered 2026-11-19)

The phone's P&L chart is now 200 high (it was 170), as the task asks. At 320 by 667 the headline, the stake sentence, the price chart and the P&L chart then span 601 px of the 589 px above the bottom navigation, 12 px over (it fit at 170). B9.5's check fails at 320 on the Detail replay and the Review card replay (375 passes). The chart was not shortened to pass. Options put to the user: take the 12 px from the price chart's phone height (recommended); tighten the headline's or stake sentence's spacing (other lanes' files); take the 200 minimum to about 188 at 320; allow a 12 px scroll at 320.

**Answer: take the 12 px from the price chart's phone height**, at narrow widths only; the P&L chart keeps 200. Done in lane PL as **T9AR.12-D1** (`b5412945`), red then green. 12 px left the Review card replay half a pixel over at 320, so the phone price chart gave up 13 px (123 high, from 136); the P&L chart stays 200.
