import type { Page } from '@playwright/test';
import { createTrades, enterMark, expect, FOUR_TRADES, MONDAY_1700, onboardedAt, openReview, openTradeFromOpenList, recordEntry, setClock, test, TUESDAY_NOON } from './support.ts';

// One figure of a Detail section, by the section's name and the figure's term.
const figure = (page: Page, section: string, term: string) =>
  page.getByRole('region', { name: section, exact: true }).locator('div', { has: page.locator('dt', { hasText: new RegExp(`^${term}$`) }) }).locator('dd');

const conditionRow = (page: Page, boundary: string) => page.getByRole('row', { name: new RegExp(`^${boundary} `) });

test.describe('B4.14 Breach, overrun, and intraday lines', () => {
  test('should show Stop Breached with Risk to stop $0.00 and Stop Overrun $50.00 and no Deviation, then Awaiting the next close with Mon Oct 12 close and At entry sections for the 40 shares', async ({ profile }) => {
    const { context, page } = await onboardedAt(profile, MONDAY_1700);
    await createTrades(page, [FOUR_TRADES[0]!]);
    await openReview(page);
    await enterMark(page, 'XYZ', 'Mon Oct 12', '47.00');
    await page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'Trades' }).click();
    await openTradeFromOpenList(page, 'XYZ');

    // Monday 17:00, Mark 47.00 below the Stop at 47.50.
    await expect(figure(page, 'Valuation', 'Mark')).toHaveText('$47.00');
    await expect(conditionRow(page, 'Stop')).toContainText('Breached');
    await expect(conditionRow(page, 'Stop')).toContainText('$47.50');
    await expect(figure(page, 'Risk and reward', 'Risk to stop')).toHaveText('$0.00 · 0.00R');
    await expect(conditionRow(page, 'Stop')).toContainText('$0.00 · 0.00R');
    await expect(conditionRow(page, 'Stop')).toContainText('$50.00 · 0.20R');
    await expect(conditionRow(page, 'Target')).toContainText('Active');
    await expect(page.getByRole('region', { name: 'Deviations', exact: true })).toContainText('No Deviations recorded.');

    // Tuesday noon, after 40 more shares at Tuesday 10:00: the Mark is not yet this session's.
    await setClock(context, page, TUESDAY_NOON);
    await openTradeFromOpenList(page, 'XYZ');
    await recordEntry(page, [{ quantity: '40', price: '50.30', fee: '1.00', time: '2026-10-13T10:00' }]);
    await page.getByRole('link', { name: 'Back to the Trade' }).click();
    await expect(page.getByRole('heading', { name: 'XYZ', level: 1 })).toBeVisible();
    await expect(page.getByText('Long 140 shares')).toBeVisible();
    for (const term of ['Open P&L', 'Current Marked Trade P&L']) await expect(figure(page, 'Valuation', term)).toHaveText('Awaiting the next close');
    for (const term of ['Risk to stop', 'Worst case', 'Reward to target']) await expect(figure(page, 'Risk and reward', term)).toHaveText('Awaiting the next close');
    await expect(conditionRow(page, 'Stop')).toContainText('Awaiting the next close');
    await expect(conditionRow(page, 'Target')).toContainText('Awaiting the next close');

    // The dated line: the Position held at Monday's close with its own figures.
    const dated = 'At Mon Oct 12 close';
    await expect(page.getByRole('heading', { name: dated, level: 2 })).toBeVisible();
    await expect(figure(page, dated, 'Mark')).toHaveText('$47.00');
    await expect(figure(page, dated, 'Open P&L')).toHaveText('−$320.00');
    await expect(figure(page, dated, 'Risk to stop')).toHaveText('$0.00 · 0.00R');
    // The at-entry line for the 40 shares: their own risk and reward.
    await expect(page.getByRole('heading', { name: 'At entry', level: 2 })).toBeVisible();
    await expect(figure(page, 'At entry', 'Quantity')).toHaveText('40 shares');
    await expect(figure(page, 'At entry', 'Average entry')).toHaveText('$50.30');
    await expect(figure(page, 'At entry', 'Risk from entry')).toHaveText('$112.00 · 0.45R');
    await expect(figure(page, 'At entry', 'Reward from entry')).toHaveText('$228.00 · 0.91R');
    await context.close();
  });
});
