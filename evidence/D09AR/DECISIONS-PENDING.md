# D09AR pending decisions

Decision 113 as amended by decision 115: one question asked at a time; the others queued here.

### T9AR.24: critic-3, the third gate critic, leaves one moderate defect (asked 2026-11-19)

Critic-3 passes every flow. One moderate defect remains. On the Review card's summary, the past-a-line row sits under a heading that contradicts it: AXIO and DALE read "Current Risk · Past the Stop by $300.00 (0.50R)", and BREN reads "Remaining Reward · Past the Target by $32.00 (0.10R)". The replay itself sets this row above both headings (W56, decision 7, coach point 6). Under the cap, this needs the user's decision. Options: fix it as one bug task with no further critic, then close (recommended); record it as tech debt and close now; fix it and run a fourth critic.

## Answered

### T9AR.24-B7: a third ocr round still leaves findings (answered 2026-11-19)

**Answer: fix both, then merge.** Done in lane PL as **T9AR.24-B7-D1** (D, since it carries out the user's answer), a structural task.

ocr's third round on B7's chain (`83089351..657d33c7`, `ocr/T9AR.24-B7-round3-657d33c7.json`) leaves two low findings, both Valid and both about style; behaviour is unchanged:
1. `corridor-pnl.tsx:257`: the tie's `row > y ? … : row < top ? … : undefined` is a nested ternary.
2. `corridor.test.tsx:949`: the new fixture repeats the nested ternary that B7-F1 just rewrote as `pnlAt(i)`.

Options: fix both as one more structural task and merge after its ocr (recommended); merge B7's chain now and record both as tech debt; something else.

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
