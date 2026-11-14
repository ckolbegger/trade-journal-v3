import type { Page } from '@playwright/test';
import { confirmOptionPlan, currentTradeId, detail, expect, firstPage, FRIDAY_NOV_1700, launchAt, MONDAY_0900, MONDAY_1105, MONDAY_NOV_1700, onboardedAt, openDrawer, OS, recordOptionEntry, test } from '../d7/support.ts';

test.use({ actionTimeout: 15_000 });

// T8P.23-B13 (A212, revision 98): a Settlement Due Trade's history ends with its contract's expiration session, Fri Nov 20.
const priceHistoryColumn = (page: Page, date: string) => page.locator('.trade-detail #drawer-panel-price-history thead th', { hasText: date });
const notEndedCard = (page: Page) => page.locator('.trade-detail #drawer-panel-journal').getByText('Session not ended yet');

async function expectHistoryEndsAtExpiration(page: Page): Promise<void> {
  await openDrawer(page, 'Price History');
  await expect(priceHistoryColumn(page, 'Nov 20')).toBeVisible();
  // Gone, not hidden: no later column, and no session not yet ended, anywhere in the DOM.
  await expect(priceHistoryColumn(page, 'Nov 23')).toHaveCount(0);
  await openDrawer(page, 'Journal');
  await expect(notEndedCard(page)).toHaveCount(0);
  await expect(page.locator('.trade-detail #drawer-panel-journal').getByText('Mon Nov 23')).toHaveCount(0);
  await expect(page.locator('.trade-detail #drawer-panel-journal').getByText('Tue Nov 24')).toHaveCount(0);
}

test.describe('T8P.23-B13 a Settlement Due Trade ends its history with the expiration session', () => {
  test('should show no later Price History column and no Session not ended yet card on Friday Nov 20 and on Monday Nov 23', async ({ profile }) => {
    test.setTimeout(240_000);
    const { context: setup, page: setupPage } = await onboardedAt(profile, MONDAY_0900);
    await confirmOptionPlan(setupPage, OS);
    const tradeId = await currentTradeId(setupPage);
    await setup.close();
    const entering = await launchAt(profile, MONDAY_1105);
    const entryPage = await firstPage(entering);
    await entryPage.goto(`/trades/${tradeId}`);
    await expect(detail.heading(entryPage, 'MNO')).toBeVisible();
    await recordOptionEntry(entryPage, [{ quantity: '2', price: '1.25', fee: '1.30', time: '2026-10-12T10:00' }]);
    await entering.close();

    for (const now of [FRIDAY_NOV_1700, MONDAY_NOV_1700]) {
      const context = await launchAt(profile, now);
      const page = await firstPage(context);
      await page.goto(`/trades/${tradeId}`);
      await expect(detail.settlementDueHeading(page)).toBeVisible();
      await expectHistoryEndsAtExpiration(page);
      await context.close();
    }
  });
});
