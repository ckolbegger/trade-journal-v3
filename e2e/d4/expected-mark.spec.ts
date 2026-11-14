import type { Page } from '@playwright/test';
import { createTradeAt, detail, enterMark, expect, FOUR_TRADES, FRIDAY_1700, observationsOf, onboardedAt, openDrawer, openReview, openTradeFromOpenList, probe, setClock, test, TUESDAY_NOON, workspaceOf } from './support.ts';

const XYZ = FOUR_TRADES[0]!.plan;

async function openXyz(page: Page): Promise<void> {
  await page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'Trades' }).click();
  await openTradeFromOpenList(page, 'XYZ');
}

test.describe('B4.5 Expected Mark Date (AC-MARK-001)', () => {
  test('should show Missing with the stale Friday Mark as context and no current dollar figure at Tuesday noon, then Available for Oct 12 and not stale after Monday is entered', async ({ profile }) => {
    const { context, page } = await onboardedAt(profile, FRIDAY_1700);
    await createTradeAt(page, XYZ, '2026-10-08T09:30', [['100', '50.00', '2026-10-08T10:00']]);

    // Friday 17:00: the Review's Mark for that session is entered.
    await openReview(page);
    await enterMark(page, 'XYZ', 'Fri Oct 9', '51.20');

    // Tuesday noon: Monday's Mark is expected and missing; Friday's is stale context only.
    await setClock(context, page, TUESDAY_NOON);
    await openTradeFromOpenList(page, 'XYZ');
    await openDrawer(page, 'Today');
    const valuation = detail.valuation(page);
    await expect(valuation.getByRole('link', { name: 'Mark missing for XYZ on Mon Oct 12' })).toBeVisible();
    await expect(valuation).toContainText('Stale context: $51.20 from Fri Oct 9 close (stale, not used in any current figure)');
    await expect(detail.todayFigure(page, 'Expected Mark Date')).toHaveText('Mon Oct 12');
    await expect(detail.datedHeading(page, 'At the Fri Oct 9 Marks')).toBeVisible();
    await openDrawer(page, 'Position');
    await expect(detail.positionOpenPnlFigure(page)).toHaveText('Mark missing: XYZ, Mon Oct 12');
    await openDrawer(page, 'Today');
    await expect(detail.currentMarkedPnl(page)).toHaveText('Mark missing: XYZ, Mon Oct 12');
    // Each condition's figure says why it has none, in the rail's Conditions card (Stop, then Target), as "Mark missing"; the P&L card above
    // names the Instrument and date.
    await expect(detail.conditionBlocks(page).locator('.condition-figure')).toHaveText(['Mark missing', 'Mark missing']);
    // The current sections hold no dollar figure from Friday's Mark: dollars appear only in the stale line and the dated section.
    await openDrawer(page, 'Today');
    await expect(detail.anywhere(() => detail.todayFigure(page, 'Mark'))).toHaveCount(0);
    await expect(detail.datedFigure(page, 'At the Fri Oct 9 Marks', 'Mark')).toHaveText('$51.20');

    // The Review lists Monday's Mark; entering it makes the Detail Available.
    await openReview(page);
    await enterMark(page, 'XYZ', 'Mon Oct 12', '52.00');
    await openXyz(page);
    await openDrawer(page, 'Today');
    await expect(detail.todayFigure(page, 'Expected Mark Date')).toHaveText('Mon Oct 12');
    // With Monday's and Friday's Marks, Today's comparison shows Monday's Mark with its provenance, so the current-Marks card does not repeat it.
    await expect(detail.comparedMark(page)).toHaveText('$52.00');
    await expect(detail.currentMarkedPnl(page)).toContainText('$199.00');
    await expect(valuation).not.toContainText('Stale context');
    await expect(valuation).not.toContainText('Mark missing');

    // Both Marks are durable observation records.
    await page.reload();
    await openDrawer(page, 'Today');
    await expect(detail.comparedMark(page)).toHaveText('$52.00');
    expect(observationsOf(workspaceOf(await probe(page))!).map((o) => [o.tradingDate, o.marks[0]!.price])).toEqual([['2026-10-09', '51.2'], ['2026-10-12', '52']]);
    await context.close();
  });
});
