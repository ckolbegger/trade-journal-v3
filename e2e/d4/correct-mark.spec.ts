import { createTrades, enterMark, expect, FOUR_TRADES, markEntry, MONDAY_1700, observationsOf, onboardedAt, openReview, openTradeFromOpenList, probe, test, workspaceOf } from './support.ts';

const DATE = 'Mon Oct 12';

test.describe('B4.4 Correct a Mark', () => {
  test('should show Corrected with the reason and +$130.00 on the Detail, with two revisions stored', async ({ profile }) => {
    const { context, page } = await onboardedAt(profile, MONDAY_1700);
    await createTrades(page, [FOUR_TRADES[0]!]);
    await openReview(page);
    await enterMark(page, 'XYZ', DATE, '52.00');

    const entry = markEntry(page, 'XYZ', DATE);
    await entry.getByRole('button', { name: 'Correct', exact: true }).click();
    await entry.getByLabel('Price').fill('51.50');
    await entry.getByLabel('Reason (required)').fill('Misread the closing quote.');
    await entry.getByRole('button', { name: 'Save correction' }).click();
    await expect(entry).toContainText('$51.50');
    await expect(entry).toContainText('Corrected: Misread the closing quote.');

    await page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'Trades' }).click();
    await openTradeFromOpenList(page, 'XYZ');
    const valuation = page.getByRole('region', { name: 'Valuation' });
    await expect(valuation).toContainText('Corrected');
    await expect(valuation).toContainText('Misread the closing quote.');
    await expect(valuation.locator('div', { has: page.locator('dt', { hasText: /^Current Marked Trade P&L$/ }) }).locator('dd')).toContainText('+$130.00');

    // Two revisions of the one observation: the initial Mark, then the Correction that supersedes it.
    const [xyz, ...rest] = observationsOf(workspaceOf(await probe(page))!);
    expect(rest).toEqual([]);
    expect(xyz!.marks.map((m) => [m.revisionNumber, m.price, m.intention])).toEqual([[1, '52', 'InitialManual'], [2, '51.5', 'Correction']]);
    expect(xyz!.marks[1]!.reason).toBe('Misread the closing quote.');
    await context.close();
  });
});
