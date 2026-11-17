import type { Page } from '@playwright/test';
import { createTrades, detail, enterMark, expect, FOUR_TRADES, MONDAY_1700, onboardedAt, openDrawer, openReview, openTradeFromOpenList, recordEntry, setClock, test, TUESDAY_NOON } from './support.ts';

// The rail's Conditions card (W5, W6) replaces the retired Conditions table: each condition is one block, found by its row 2 (the boundary in W6's
// words), with its figure (its distance, or Breached or Reached, or why it has none) and, once crossed, how far past it the Mark is.
const STOP = 'XYZ at or below $47.50';
const TARGET = 'XYZ at or above $56.00';
const conditionFigure = (page: Page, text: string) => detail.conditionBlock(page, text).locator('.condition-figure');

test.describe('B4.14 Breach, overrun, and intraday lines', () => {
  test('should show Stop Breached with Risk to stop $0.00 and Stop Overrun $50.00 and no Deviation, then Awaiting the Tue Oct 13 close with no dated or At entry card on Today for the 40 shares', async ({ profile }) => {
    const { context, page } = await onboardedAt(profile, MONDAY_1700);
    await createTrades(page, [FOUR_TRADES[0]!]);
    await openReview(page);
    await enterMark(page, 'XYZ', 'Mon Oct 12', '47.00');
    await page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'Trades' }).click();
    await openTradeFromOpenList(page, 'XYZ');

    // Monday 17:00, Mark 47.00 below the Stop at 47.50.
    await openDrawer(page, 'Today');
    await expect(detail.marksCell(page, 'XYZ Mark', 'Today')).toHaveText('$47.00');
    // W21: a crossed condition reads "Breached · $0.50 past" (the Mark 47.00 against the Stop 47.50); the card no longer words the Trade P&L past it.
    await expect(conditionFigure(page, STOP)).toHaveText('Breached · $0.50 past');
    await expect(detail.conditionBlock(page, STOP).locator('.condition-text')).toHaveText(STOP);
    await expect(detail.conditionBlock(page, STOP).locator('.condition-why')).toHaveCount(0);
    // An Active condition shows its distance, not a status word.
    await expect(conditionFigure(page, TARGET)).toHaveText(/^\$[\d,]+\.\d\d away$/);
    await openDrawer(page, 'Plan and Risk');
    await expect(detail.riskFigure(page, 'Risk to stop')).toHaveText('Risk to stop $50.00 · 0.20R past');
    // No Deviation is recorded, so the Deviations group is not shown at all (T8R.11).
    await expect(detail.deviations(page)).toHaveCount(0);

    // Tuesday noon, after 40 more shares at Tuesday 10:00: the Mark is not yet this session's.
    await setClock(context, page, TUESDAY_NOON);
    await openTradeFromOpenList(page, 'XYZ');
    await recordEntry(page, [{ quantity: '40', price: '50.30', fee: '1.00', time: '2026-10-13T10:00' }]);
    await page.getByRole('link', { name: 'Back to the Trade' }).click();
    await expect(detail.heading(page, 'XYZ')).toBeVisible();
    await openDrawer(page, 'Position');
    await expect(detail.tradeSummary(page).getByText('Long 140 shares')).toBeVisible();
    await expect(detail.positionOpenPnlFigure(page)).toHaveText('Awaiting the Tue Oct 13 close');
    await expect(detail.currentMarkedPnl(page)).toHaveText('Awaiting the Tue Oct 13 close');
    await openDrawer(page, 'Plan and Risk');
    // W31: with today's Mark missing, Worst case reads the last Marks' figure, labelled with its date.
    await expect(detail.riskFigure(page, 'Worst case')).toHaveText('$4,700.00 · 18.80R if XYZ goes to zero · Mon Oct 12 Mark');
    // With today's Mark not yet this session's, the Conditions card shows each condition's distance at the dated Marks, with the date (W21, A231).
    await expect(conditionFigure(page, STOP)).toHaveText('Breached · $0.50 past · Mon Oct 12 Mark');
    await expect(conditionFigure(page, TARGET)).toHaveText(/^\$[\d,]+\.\d\d away · Mon Oct 12 Mark$/);

    // Today no longer carries the dated card or At entry: each figure has one home (P116), in Plan and Risk and the rail.
    await openDrawer(page, 'Today');
    await expect(detail.marksCell(page, 'XYZ Mark', 'Yesterday')).toHaveText('$47.00');
    await expect(detail.todayCard(page, 'At the Mon Oct 12 Marks')).toHaveCount(0);
    await expect(detail.todayCard(page, 'At entry')).toHaveCount(0);
    await context.close();
  });
});
