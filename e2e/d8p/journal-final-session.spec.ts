import type { Locator, Page } from '@playwright/test';
import {
  closeTheTrade, confirmOptionPlan, createTrades, currentTradeId, detail, enterMark, expect, FOUR_TRADES, fillRows, firstPage, launchAt, MONDAY, MONDAY_0900, MONDAY_1105, MONDAY_1700, MONDAY_NOV_1700,
  onboardedAt, openDrawer, openExitForm, openReview, OS, READY, recordExpiration, recordOptionEntry, sell, test,
} from './support.ts';

test.use({ actionTimeout: 15_000 });

// T8P.26-B3 (critic-4 defect 3, W10, A211, A212; the user's reading of W10, 2026-11-14): "First Mark" names only a session that brought a Mark.
// A final session at whose close nothing was held has its Trade P&L and no change line; a marked session keeps its line.
const card = (page: Page, heading: RegExp): Locator => page.locator('.trade-detail #drawer-panel-journal article.journal-card').filter({ hasText: heading });

test.describe('T8P.26-B3 a Journal card whose session has no Mark has no change line', () => {
  test('should show DEF Closed by sale with its Trade P&L and no change line, while XYZ keeps First Mark on its marked session', async ({ profile }) => {
    test.setTimeout(420_000);
    const { context: setup, page: setupPage } = await onboardedAt(profile, MONDAY_1700);
    const [xyz, , def] = await createTrades(setupPage, FOUR_TRADES);
    await setupPage.goto(`/trades/${def}`);
    await openExitForm(setupPage);
    await fillRows(setupPage, [sell('100', '44.00', '1.00', '2026-10-12T15:00')]);
    await closeTheTrade(setupPage, 'now');
    await setupPage.getByRole('button', { name: 'Save exit' }).click();
    await expect(setupPage.getByRole('heading', { name: 'Exit recorded', level: 1 })).toBeVisible(READY);
    await openReview(setupPage);
    await enterMark(setupPage, 'XYZ', MONDAY, '52.00');
    await setup.close();

    const context = await launchAt(profile, MONDAY_1700);
    const page = await firstPage(context);
    await page.goto(`/trades/${def}`);
    await expect(detail.heading(page, 'DEF')).toBeVisible(READY);
    await openDrawer(page, 'Journal');
    const final = card(page, /Today, Mon Oct 12, final session/);
    await expect(final).toHaveCount(1);
    await expect(final.locator('.journal-card-title')).toHaveText('$398.00');
    await expect(final.locator('.journal-card-change')).toHaveCount(0);
    await expect(final).not.toContainText('First Mark');

    await page.goto(`/trades/${xyz}`);
    await expect(detail.heading(page, 'XYZ')).toBeVisible(READY);
    await openDrawer(page, 'Journal');
    await expect(card(page, /Today, Mon Oct 12/).locator('.journal-card-change')).toHaveText('First Mark');
    await context.close();
  });

  test('should show the expired MNO put final session with its Trade P&L and no change line', async ({ profile }) => {
    test.setTimeout(420_000);
    // D7's Settlement Due fixture: O-S, 2 short MNO puts at 1.25 (Mon 10:00, fee 1.30), expiring Fri Nov 20; viewed Mon Nov 23 17:00.
    const { context: setup, page: setupPage } = await onboardedAt(profile, MONDAY_0900);
    await confirmOptionPlan(setupPage, OS);
    const tradeId = await currentTradeId(setupPage);
    await setup.close();
    const entering = await launchAt(profile, MONDAY_1105);
    const entryPage = await firstPage(entering);
    await entryPage.goto(`/trades/${tradeId}`);
    await expect(detail.heading(entryPage, 'MNO')).toBeVisible(READY);
    await recordOptionEntry(entryPage, [{ quantity: '2', price: '1.25', fee: '1.30', time: '2026-10-12T10:00' }]);
    await entering.close();

    const context = await launchAt(profile, MONDAY_NOV_1700);
    const page = await firstPage(context);
    await page.goto(`/trades/${tradeId}`);
    await expect(detail.settlementDueHeading(page)).toBeVisible(READY);
    await detail.recordExpirationLink(page).click();
    await recordExpiration(page);
    await page.getByRole('link', { name: 'Back to the Trade' }).click();
    await expect(detail.heading(page, 'MNO')).toBeVisible(READY);
    await openDrawer(page, 'Journal');
    const final = card(page, /Fri Nov 20, final session/);
    await expect(final).toHaveCount(1);
    await expect(final.locator('.journal-card-title')).toHaveText('$248.70');
    await expect(final.locator('.journal-card-change')).toHaveCount(0);
    await expect(final).not.toContainText('First Mark');
    await context.close();
  });
});
