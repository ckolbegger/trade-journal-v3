import { createTrades, expectMark, markInputOf, marksStepOf, saveMarksButton, detail, enterMark, expect, FOUR_TRADES, MONDAY_1700, observationsOf, onboardedAt, openDrawer, openReview, openTradeFromOpenList, probe, test, workspaceOf } from './support.ts';

const DATE = 'Mon Oct 12';

test.describe('B4.4 Correct a Mark', () => {
  test('should show Corrected with the reason and +$130.00 on the Detail, with two revisions stored', async ({ profile }) => {
    const { context, page } = await onboardedAt(profile, MONDAY_1700);
    await createTrades(page, [FOUR_TRADES[0]!]);
    await openReview(page);
    await enterMark(page, 'XYZ', DATE, '52.00');

    // A Mark saved in this Review is fixed in its cell and saved with Save Marks: no reason is asked, and the correction carries "Fixed in the same Review".
    const price = await markInputOf(page, 'XYZ', DATE);
    await price.fill('51.50');
    await expect(marksStepOf(page).getByText('Saved in this Review: fix it in place, no reason needed.')).toBeVisible();
    await expect(marksStepOf(page).getByLabel('Reason (required)')).toHaveCount(0);
    await saveMarksButton(page).click();
    await expect(marksStepOf(page).getByRole('button', { name: 'Edit', exact: true })).toBeVisible();
    await expectMark(page, 'XYZ', DATE, '51.5');

    await page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'Trades' }).click();
    await openTradeFromOpenList(page, 'XYZ');
    await openDrawer(page, 'Today');
    // A corrected Mark's provenance lives on Price History (T8R.4): the visible badge and the cell's accessible name.
    await openDrawer(page, 'Price History');
    const corrected = page.locator('#drawer-panel-price-history table.price-history').getByRole('cell', { name: /^\$51\.50\. .*\. Corrected: Fixed in the same Review\.?$/ });
    await expect(corrected).toHaveCount(1);
    await expect(corrected).toContainText('Corrected');
    await expect(detail.currentMarkedPnl(page)).toContainText('$130.00');

    // Two revisions of the one observation: the initial Mark, then the Correction that supersedes it.
    const [xyz, ...rest] = observationsOf(workspaceOf(await probe(page))!);
    expect(rest).toEqual([]);
    expect(xyz!.marks.map((m) => [m.revisionNumber, m.price, m.intention])).toEqual([[1, '52', 'InitialManual'], [2, '51.5', 'Correction']]);
    expect(xyz!.marks[1]!.reason).toBe('Fixed in the same Review');
    await context.close();
  });
});
