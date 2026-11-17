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
    // W29: the Stale context stands under the Marks table; the Mark-missing link and the Expected Mark Date are gone from Today.
    await expect(detail.marksNotes(page)).toContainText('Stale context: $51.20 from Fri Oct 9 close (stale, not used in any current figure)');
    await expect(page.locator('.trade-detail #drawer-panel-today a', { hasText: 'Mark missing for' })).toHaveCount(0);
    await expect(page.locator('.trade-detail').getByText('Expected Mark Date')).toHaveCount(0);
    await expect(detail.todayCard(page, 'At the Fri Oct 9 Marks')).toHaveCount(0);
    await openDrawer(page, 'Position');
    await expect(detail.positionOpenPnlFigure(page)).toHaveText('Mark missing: XYZ, Mon Oct 12');
    await openDrawer(page, 'Today');
    await expect(detail.currentMarkedPnl(page)).toHaveText('Mark missing: XYZ, Mon Oct 12');
    // With today's Mark missing, each condition's figure in the rail's Conditions card (Stop, then Target) is its distance at the dated Marks, with
    // that date (W21, A231); the P&L card above names the Instrument and date of the missing Mark.
    await expect(detail.conditionBlocks(page).locator('.condition-figure')).toHaveText(['$3.70 away · Fri Oct 9 Mark', '$4.80 away · Fri Oct 9 Mark']);
    // The current sections hold no dollar figure from Friday's Mark: dollars appear only in the stale line.
    await openDrawer(page, 'Today');
    for (const column of ['Today', 'Yesterday', 'Change'] as const) await expect(detail.marksCell(page, 'XYZ Mark', column)).toHaveText('—');

    // The Review lists Monday's Mark; entering it makes the Detail Available.
    await openReview(page);
    await enterMark(page, 'XYZ', 'Mon Oct 12', '52.00');
    await openXyz(page);
    await openDrawer(page, 'Today');
    // Tuesday noon: Today is Tuesday (not ended) and Yesterday is Monday, whose Mark is $52.00 (W29, A232).
    await expect(detail.marksHeadings(page)).toHaveText(['Today, Tue Oct 13', 'Yesterday, Mon Oct 12', 'Change']);
    await expect(detail.marksCell(page, 'XYZ Mark', 'Yesterday')).toHaveText('$52.00');
    await expect(detail.currentMarkedPnl(page)).toContainText('$199.00');
    await expect(detail.marksNotes(page)).toHaveCount(0);

    // Both Marks are durable observation records.
    await page.reload();
    await openDrawer(page, 'Today');
    await expect(detail.marksCell(page, 'XYZ Mark', 'Yesterday')).toHaveText('$52.00');
    expect(observationsOf(workspaceOf(await probe(page))!).map((o) => [o.tradingDate, o.marks[0]!.price])).toEqual([['2026-10-09', '51.2'], ['2026-10-12', '52']]);
    await context.close();
  });
});
