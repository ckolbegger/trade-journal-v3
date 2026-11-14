import type { Page } from '@playwright/test';
import { createTrades, detail, enterMark, expect, FOUR_TRADES, MONDAY_1700, onboardedAt, openDrawer, openReview, openTradeFromOpenList, recordEntry, setClock, test, TUESDAY_NOON } from './support.ts';

// The rail's Conditions card (W5, W6) replaces the retired Conditions table: each condition is one block, found by its row 2 (the boundary in W6's
// words), with its figure (its distance, or Breached or Reached, or why it has none) and, once crossed, how far past it the Mark is.
const STOP = 'XYZ at or below $47.50';
const TARGET = 'XYZ at or above $56.00';
const conditionFigure = (page: Page, text: string) => detail.conditionBlock(page, text).locator('.condition-figure');

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
    await expect(conditionFigure(page, STOP)).toHaveText('Breached');
    await expect(detail.conditionBlock(page, STOP).locator('.condition-text')).toHaveText(STOP);
    await expect(detail.conditionBlock(page, STOP).locator('.condition-why')).toContainText('$50.00 (0.20R) of Trade P&L past this Stop');
    // An Active condition shows its distance, not a status word.
    await expect(conditionFigure(page, TARGET)).toHaveText(/^\+\$/);
    await openDrawer(page, 'Plan and Risk');
    await expect(detail.riskFigure(page, 'Risk to stop')).toHaveText('$0.00 · 0.00R');
    await expect(detail.deviations(page)).toContainText('No Deviations recorded.');

    // Tuesday noon, after 40 more shares at Tuesday 10:00: the Mark is not yet this session's.
    await setClock(context, page, TUESDAY_NOON);
    await openTradeFromOpenList(page, 'XYZ');
    await recordEntry(page, [{ quantity: '40', price: '50.30', fee: '1.00', time: '2026-10-13T10:00' }]);
    await page.getByRole('link', { name: 'Back to the Trade' }).click();
    await expect(detail.heading(page, 'XYZ')).toBeVisible();
    await openDrawer(page, 'Position');
    await expect(detail.tradeSummary(page).getByText('Long 140 shares')).toBeVisible();
    await expect(detail.positionOpenPnlFigure(page)).toHaveText('Awaiting the close after Mon Oct 12');
    await expect(detail.currentMarkedPnl(page)).toHaveText('Awaiting the close after Mon Oct 12');
    await openDrawer(page, 'Plan and Risk');
    await expect(detail.riskFigure(page, 'Worst case')).toHaveText('Awaiting the close after Mon Oct 12');
    // The Conditions card words an unavailable condition's figure "Awaiting close" (the Awaiting-the-close sentence is the P&L card's).
    await expect(conditionFigure(page, STOP)).toHaveText('Awaiting close');
    await expect(conditionFigure(page, TARGET)).toHaveText('Awaiting close');

    // The dated line: the Position held at Monday's close with its own figures.
    const dated = 'At the Mon Oct 12 Marks';
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
