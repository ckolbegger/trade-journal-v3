import type { Page } from '@playwright/test';
import { createTrades, detail, enterMark, expect, FOUR_TRADES, MONDAY_1700, onboardedAt, openDrawer, openReview, openTradeFromOpenList, recordEntry, setClock, test, TUESDAY_NOON } from './support.ts';

const conditionRow = (page: Page, boundary: string) => detail.conditionRow(page, new RegExp(`^${boundary} `));

// One cell of a Condition row, by the column's header, so a value in another column cannot satisfy it.
const COLUMNS = ['Condition', 'Boundary', 'Status', 'Distance', 'Overrun'];
const conditionCell = (page: Page, boundary: string, column: string) => conditionRow(page, boundary).getByRole('cell').nth(COLUMNS.indexOf(column));

test.describe('B4.14 Breach, overrun, and intraday lines', () => {
  test('should show Stop Breached with Risk to stop $0.00 and Stop Overrun $50.00 and no Deviation, then Awaiting the close after Mon Oct 12 with Mon Oct 12 close and At entry sections for the 40 shares', async ({ profile }) => {
    const { context, page } = await onboardedAt(profile, MONDAY_1700);
    await createTrades(page, [FOUR_TRADES[0]!]);
    await openReview(page);
    await enterMark(page, 'XYZ', 'Mon Oct 12', '47.00');
    await page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'Trades' }).click();
    await openTradeFromOpenList(page, 'XYZ');

    // Monday 17:00, Mark 47.00 below the Stop at 47.50.
    await openDrawer(page, 'Today');
    await expect(detail.todayFigure(page, 'Mark')).toHaveText('$47.00');
    await expect(conditionCell(page, 'Stop', 'Status')).toHaveText('Breached');
    await expect(conditionCell(page, 'Stop', 'Boundary')).toHaveText('$47.50');
    await expect(detail.riskFigure(page, 'Risk to stop')).toHaveText('$0.00 · 0.00R');
    await expect(conditionCell(page, 'Stop', 'Distance')).toHaveText('$0.00 · 0.00R');
    await expect(conditionCell(page, 'Stop', 'Overrun')).toHaveText('$50.00 · 0.20R');
    await expect(conditionCell(page, 'Target', 'Status')).toHaveText('Active');
    await openDrawer(page, 'Plan and Risk');
    await expect(detail.deviations(page)).toContainText('No Deviations recorded.');

    // Tuesday noon, after 40 more shares at Tuesday 10:00: the Mark is not yet this session's.
    await setClock(context, page, TUESDAY_NOON);
    await openTradeFromOpenList(page, 'XYZ');
    await recordEntry(page, [{ quantity: '40', price: '50.30', fee: '1.00', time: '2026-10-13T10:00' }]);
    await page.getByRole('link', { name: 'Back to the Trade' }).click();
    await expect(detail.heading(page, 'XYZ')).toBeVisible();
    await expect(detail.summary(page).getByText('Long 140 shares')).toBeVisible();
    await openDrawer(page, 'Position');
    await expect(detail.openPnlFigure(page)).toHaveText('Awaiting the close after Mon Oct 12');
    await expect(detail.currentMarkedPnl(page)).toHaveText('Awaiting the close after Mon Oct 12');
    for (const term of ['Risk to stop', 'Worst case', 'Reward to target']) await expect(detail.riskFigure(page, term)).toHaveText('Awaiting the close after Mon Oct 12');
    await expect(conditionCell(page, 'Stop', 'Status')).toHaveText('Awaiting the close after Mon Oct 12');
    await expect(conditionCell(page, 'Target', 'Status')).toHaveText('Awaiting the close after Mon Oct 12');

    // The dated line: the Position held at Monday's close with its own figures.
    const dated = 'At Mon Oct 12 close';
    await openDrawer(page, 'Today');
    await expect(detail.datedHeading(page, dated)).toBeVisible();
    await expect(detail.datedFigure(page, dated, 'Mark')).toHaveText('$47.00');
    await expect(detail.datedFigure(page, dated, 'Open P&L')).toHaveText('−$320.00');
    await expect(detail.datedFigure(page, dated, 'Risk to stop')).toHaveText('$0.00 · 0.00R');
    // The at-entry line for the 40 shares: their own risk and reward.
    await expect(detail.atEntryHeading(page)).toBeVisible();
    await expect(detail.atEntryFigure(page, 'Quantity')).toHaveText('40 shares');
    await expect(detail.atEntryFigure(page, 'Average entry')).toHaveText('$50.30');
    await expect(detail.atEntryFigure(page, 'Risk from entry')).toHaveText('$112.00 · 0.45R');
    await expect(detail.atEntryFigure(page, 'Reward from entry')).toHaveText('$228.00 · 0.91R');
    await context.close();
  });
});
