import {
  answerDebt, completion, confirmReference, debtsOf, deferEntry, detail, enterMark, entriesWithSettledDebt, expect, fillDebtAnswers, markRow, onboardedAt, openDrawer, openReview, openTradeFromOpenList, probe, reachCard, reflectionsOf, setClock, test, tradeCard,
  TUESDAY, TUESDAY_1005, TUESDAY_1230, WEDNESDAY, WEDNESDAY_1700, workspaceOf,
} from './support.ts';

test.describe('B5.3 Reflect on Trade Detail', () => {
  test('should show Due in the Review after next before, Deferred, answered with Tuesday 12:30 after, and list no reflection for it in Wednesday’s Review', async ({ profile }) => {
    const { context, page } = await onboardedAt(profile, TUESDAY_1005);
    await confirmReference(page);
    await deferEntry(page, [{ quantity: '100', price: '50.00', fee: '1.00', time: '2026-10-13T10:00' }]);

    await setClock(context, page, TUESDAY_1230);
    await openTradeFromOpenList(page);
    await openDrawer(page, 'Journal');
    await expect(detail.reflectionOwed(page)).toBeVisible();
    await expect(detail.dueNote(page, 'Due in the Review after next', true)).toBeVisible();
    await detail.reflectNowButton(page).click();
    await fillDebtAnswers(page);
    await answerDebt(page, undefined);

    // After the save, and after a reload: answered later, with the time the trader answered.
    await page.reload();
    await expect(detail.heading(page, 'XYZ')).toBeVisible();
    await openDrawer(page, 'Journal');
    await expect(detail.journal(page).getByText('Deferred, answered', { exact: true })).toBeVisible();
    await expect(detail.journal(page).getByText('Answered', { exact: true })).toBeVisible();
    await expect(detail.journal(page).getByText('2026-10-13 12:30')).toBeVisible();
    await expect(detail.reflectionOwed(page)).toHaveCount(0);
    await expect(detail.dueNote(page, 'Due in the Review after next')).toHaveCount(0);

    const workspace = workspaceOf(await probe(page))!;
    expect(debtsOf(workspace)).toHaveLength(1);
    expect(entriesWithSettledDebt(workspace)).toHaveLength(1);

    // Wednesday's Review lists no reflection for the Trade.
    await setClock(context, page, WEDNESDAY_1700);
    await openReview(page);
    await expect(await markRow(page, 'XYZ', TUESDAY)).toBeVisible();
    await enterMark(page, 'XYZ', TUESDAY, '52.00');
    await enterMark(page, 'XYZ', WEDNESDAY, '52.50');
    await reachCard(page, 'XYZ');
    await expect(tradeCard(page, 'XYZ')).toBeVisible();
    await expect(await reflectionsOf(page, 'XYZ')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^Reflect on / })).toHaveCount(0);
    await expect(completion(page)).toHaveText('Incomplete');
    await expect(page.getByRole('region', { name: 'Review status' })).not.toContainText('eflection');
    await context.close();
  });
});
