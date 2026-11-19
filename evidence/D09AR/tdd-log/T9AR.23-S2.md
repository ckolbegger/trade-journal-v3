# T9AR.23-S2 (lane OV)

Measured at 320 by 667 (header top to the P&L chart's bottom, Detail overlay; the Review card's overlay gives the same):

| state | header | chart box top | span |
|---|---|---|---|
| red (before S3) | 52 (title on two lines, 21 px Close) | 365 | 708 |
| after S3 only (Close 44) | 52 | 365 | 688 |
| green | 45 (title on one line) | 342 | 665 of 667 |

Fix, phone only: the title is 0.9rem on one line (header 45 instead of 52), the body's top padding is 4 px (was 12) and the card's top padding is 4 px. No chart shortened, no words cut, no figure hidden. Margin is 2 px.

Green: `npx playwright test e2e/d9ar e2e/d9/responsive-a11y.spec.ts`: 40 passed, 1 failed (chart.spec.ts line 42, see S1's log).
