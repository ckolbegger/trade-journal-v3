import type { Page } from '@playwright/test';
import { createTradeAt, enterMark, expect, FOUR_TRADES, FRIDAY_1700, observationsOf, onboardedAt, openReview, openTradeFromOpenList, probe, setClock, test, TUESDAY_NOON, workspaceOf } from './support.ts';

const XYZ = FOUR_TRADES[0]!.plan;

// One figure of a Detail section, by the section's name and the figure's term.
const figure = (page: Page, section: string, term: string) =>
  page.getByRole('region', { name: section, exact: true }).locator('div', { has: page.locator('dt', { hasText: new RegExp(`^${term}$`) }) }).locator('dd');

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
    const valuation = page.getByRole('region', { name: 'Valuation', exact: true });
    await expect(valuation.getByRole('link', { name: 'Mark missing for XYZ on Mon Oct 12' })).toBeVisible();
    await expect(valuation).toContainText('Stale context: $51.20 from Fri Oct 9 close (stale, not used in any current figure)');
    await expect(figure(page, 'Valuation', 'Expected Mark Date')).toHaveText('Mon Oct 12');
    await expect(page.getByRole('heading', { name: 'At Fri Oct 9 close', level: 2 })).toBeVisible();
    for (const term of ['Open P&L', 'Current Marked Trade P&L']) await expect(figure(page, 'Valuation', term)).toHaveText('Mark missing: XYZ, Mon Oct 12');
    for (const term of ['Risk to stop', 'Reward to target']) await expect(figure(page, 'Risk and reward', term)).toHaveText('Mark missing: XYZ, Mon Oct 12');
    // The current sections hold no dollar figure from Friday's Mark: dollars appear only in the stale line and the dated section.
    await expect(figure(page, 'Valuation', 'Mark')).toHaveCount(0);
    await expect(figure(page, 'At Fri Oct 9 close', 'Mark')).toHaveText('$51.20');

    // The Review lists Monday's Mark; entering it makes the Detail Available.
    await openReview(page);
    await enterMark(page, 'XYZ', 'Mon Oct 12', '52.00');
    await openXyz(page);
    await expect(figure(page, 'Valuation', 'Expected Mark Date')).toHaveText('Mon Oct 12');
    await expect(figure(page, 'Valuation', 'Mark')).toHaveText('$52.00');
    await expect(figure(page, 'Valuation', 'Current Marked Trade P&L')).toContainText('+$199.00');
    await expect(valuation).not.toContainText('Stale context');
    await expect(valuation).not.toContainText('Mark missing');

    // Both Marks are durable observation records.
    await page.reload();
    await expect(figure(page, 'Valuation', 'Mark')).toHaveText('$52.00');
    expect(observationsOf(workspaceOf(await probe(page))!).map((o) => [o.tradingDate, o.marks[0]!.price])).toEqual([['2026-10-09', '51.2'], ['2026-10-12', '52']]);
    await context.close();
  });
});
