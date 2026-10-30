import {
  answerDebt, completion, confirmReference, continueToTrades, debtsOf, deferEntry, enterMark, entriesWithSettledDebt, expect, fillDebtAnswers, markEntry, onboardedAt, openReview, openTradeFromOpenList, probe, reflectionsOf, setClock, test,
  tradesFamily, TUESDAY, TUESDAY_1005, TUESDAY_1230, WEDNESDAY, WEDNESDAY_1700, workspaceOf,
} from './support.ts';

test.describe('B5.3 Reflect on Trade Detail', () => {
  test('should show Due in the Review after next before, Deferred, answered with Tuesday 12:30 after, and list no reflection for it in Wednesday’s Review', async ({ profile }) => {
    const { context, page } = await onboardedAt(profile, TUESDAY_1005);
    await confirmReference(page);
    await deferEntry(page, [{ quantity: '100', price: '50.00', fee: '1.00', time: '2026-10-13T10:00' }]);

    await setClock(context, page, TUESDAY_1230);
    await openTradeFromOpenList(page);
    await expect(page.getByText('Reflection owed')).toBeVisible();
    await expect(page.getByText('Due in the Review after next', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Reflect now' }).click();
    await fillDebtAnswers(page);
    await answerDebt(page);

    // After the save, and after a reload: answered later, with the time the trader answered.
    await page.reload();
    await expect(page.getByRole('heading', { name: 'XYZ', level: 1 })).toBeVisible();
    await expect(page.getByText('Deferred, answered', { exact: true })).toBeVisible();
    await expect(page.getByText('Answered', { exact: true })).toBeVisible();
    await expect(page.getByText('2026-10-13 12:30')).toBeVisible();
    await expect(page.getByText('Reflection owed')).toHaveCount(0);
    await expect(page.getByText('Due in the Review after next')).toHaveCount(0);

    const workspace = workspaceOf(await probe(page))!;
    expect(debtsOf(workspace)).toHaveLength(1);
    expect(entriesWithSettledDebt(workspace)).toHaveLength(1);

    // Wednesday's Review lists no reflection for the Trade.
    await setClock(context, page, WEDNESDAY_1700);
    await openReview(page);
    await expect(markEntry(page, 'XYZ', TUESDAY)).toBeVisible();
    await enterMark(page, 'XYZ', TUESDAY, '52.00');
    await enterMark(page, 'XYZ', WEDNESDAY, '52.50');
    await continueToTrades(page);
    await tradesFamily(page).getByRole('button', { name: 'Review XYZ' }).click();
    await expect(page.getByRole('region', { name: 'XYZ review', exact: true })).toBeVisible();
    await expect(reflectionsOf(page, 'XYZ')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^Reflect on / })).toHaveCount(0);
    await expect(completion(page)).toHaveText('Incomplete');
    await expect(page.getByRole('region', { name: 'Review status' })).not.toContainText('eflection');
    await context.close();
  });
});
