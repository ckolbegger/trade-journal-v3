import type { Page } from '@playwright/test';
import { copyOc3ThursdayHold, detail, expect, FRIDAY_1200, FRIDAY_1800, openBreachedStockTrade, openDetailAt, test, THURSDAY_1800 } from './support.ts';

test.use({ actionTimeout: 15_000 });

// B8R.3 (plan section 7.2): O-C3 at Thu 18:00, then at Fri 10-16 with Friday's call Mark missing, and a stock Trade with its Stop breached. W21 and W22; the
// rail has no nearest badge, no Worst case, no Max reward and no change in Trade P&L.
// Fri 12:00 and Fri 18:00 (main-session reading of B8R.3): at 12:00 Friday's session has not closed, so no Friday Mark is due and the rail has no dated line;
// at 18:00 the session has closed with no Friday Marks, so today's figures are unavailable and the rail shows Thursday's, dated (the same Given as I8R.1).
const GONE = /nearest|Worst case|Max reward|Change in Trade P&L/;

const railGone = async (page: Page): Promise<void> => {
  await expect(detail.conditionsCard(page).locator('.condition-nearest, .condition-why, .conditions-summary')).toHaveCount(0);
  await expect(detail.pnlCard(page).getByText(GONE)).toHaveCount(0);
  await expect(detail.conditionsCard(page).getByText(GONE)).toHaveCount(0);
  await expect(detail.needsYouCard(page).getByText(GONE)).toHaveCount(0);
};

test.describe('B8R.3 Rail', () => {
  test('should show each condition with its distance at Thu 18:00, then no dated line at Fri 12:00 and Thursday dated figures at Fri 18:00', async ({ profile, copySetup }) => {
    test.setTimeout(540_000);
    const trade = await copyOc3ThursdayHold(copySetup);

    await test.step('Thu 18:00 (W21): "Stop · $2.20 away" for the option condition and "Target · 2.10 away" for the Underlying one; the P&L card as today', async () => {
      const { context, page } = await openDetailAt(profile, THURSDAY_1800, trade);
      await expect(detail.conditionBlocks(page)).toHaveCount(2);
      await expect(detail.conditionBlocks(page).nth(0).locator('.condition-head')).toHaveText('Stop · $2.20 away');
      await expect(detail.conditionBlocks(page).nth(0).locator('.condition-text')).toHaveText('Option at or below $1.00');
      await expect(detail.conditionBlocks(page).nth(1).locator('.condition-head')).toHaveText('Target · 2.10 away');
      await expect(detail.conditionBlocks(page).nth(1).locator('.condition-text')).toHaveText('XYZ at or above 60.00');
      await expect(detail.pnlFigure(page)).toHaveText('$218.05');
      await expect(detail.pnlLine(page)).toHaveText('+$30.00 since Wed Oct 14');
      await railGone(page);
      await context.close();
    });

    await test.step('Fri 12:00: no Friday Mark is due yet, so the rail has no dated line', async () => {
      const { context, page } = await openDetailAt(profile, FRIDAY_1200, trade);
      await expect(detail.conditionBlocks(page)).toHaveCount(2);
      await expect(detail.conditionBlocks(page).locator('.condition-head')).toHaveText(['Stop · $2.20 away', 'Target · 2.10 away']);
      await expect(detail.pnlLine(page)).not.toContainText(/ at the .* Marks?$/);
      await railGone(page);
      await context.close();
    });

    await test.step('Fri 18:00, Friday closed with no Mark (W21, W22): Thursday\'s figures, each dated "Thu Oct 15 Marks"', async () => {
      const { context, page } = await openDetailAt(profile, FRIDAY_1800, trade);
      await expect(detail.pnlFigure(page)).not.toHaveText('$218.05');
      await expect(detail.pnlCard(page).getByText('+$218.05 at the Thu Oct 15 Marks', { exact: true })).toBeVisible();
      await expect(detail.pnlCard(page).getByText('Mark missing: XYZ Dec 18 $55 Call, Fri Oct 16', { exact: true })).toBeVisible();
      await expect(detail.conditionBlocks(page).nth(0).locator('.condition-head')).toHaveText('Stop · $2.20 away · Thu Oct 15 Marks');
      await expect(detail.conditionBlocks(page).nth(1).locator('.condition-head')).toHaveText('Target · 2.10 away · Thu Oct 15 Marks');
      await expect(detail.conditionBlocks(page).nth(0).locator('.condition-text')).toHaveText('Option at or below $1.00');
      await railGone(page);
      await context.close();
    });
  });

  test('should show a stock Trade with its Stop breached as "Breached · $0.50 past", with no nearest, Worst case or Max reward on the rail', async ({ profile }) => {
    test.setTimeout(300_000);
    const { context, page } = await openBreachedStockTrade(profile);
    const stop = detail.conditionBlock(page, 'XYZ at or below $47.50');
    await expect(stop.locator('.condition-head')).toHaveText('Stop · Breached · $0.50 past');
    await expect(detail.conditionBlock(page, 'XYZ at or above $56.00').locator('.condition-head')).toHaveText(/^Target · \$[\d,]+\.\d\d away$/);
    await railGone(page);
    await context.close();
  });
});
