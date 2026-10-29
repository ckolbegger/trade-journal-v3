import { completion, continueToTrades, createTradeAt, enterMark, expect, FOUR_TRADES, markEntry, MONDAY_1700, observationsOf, onboardedAt, openReview, probe, reloadReview, saveAction, setClock, test, tradesFamily, workspaceOf } from './support.ts';

const MNO = { ...FOUR_TRADES[0]!.plan, symbol: 'MNO' };
const WEDNESDAY_1700 = '2026-10-07T21:00:00Z';
const THURSDAY_1700 = '2026-10-08T21:00:00Z';
const EARLIER = 'Earlier sessions without Marks — optional';

test.describe('B4.6 Skipped sessions', () => {
  test('should list Friday as optional, reach Complete without it, and show an empty list after Friday is entered', async ({ profile }) => {
    const { context, page } = await onboardedAt(profile, WEDNESDAY_1700);
    await createTradeAt(page, MNO, '2026-10-07T09:30', [['100', '50.00', '2026-10-07T10:00']]);
    await openReview(page);
    await enterMark(page, 'MNO', 'Wed Oct 7', '50.50');
    await setClock(context, page, THURSDAY_1700);
    await openReview(page);
    await enterMark(page, 'MNO', 'Thu Oct 8', '51.00');

    // Monday 17:00: Friday was skipped and is listed as an optional gap, beside Monday's task.
    await setClock(context, page, MONDAY_1700);
    await openReview(page);
    const earlier = page.getByRole('group', { name: EARLIER });
    await expect(earlier).toContainText('These sessions do not block the Review.');
    await expect(markEntry(page, 'MNO', 'Fri Oct 9')).toBeVisible();
    await expect(earlier).not.toContainText('Wed Oct 7');
    await expect(earlier).not.toContainText('Thu Oct 8');

    // Monday's Mark and an Action complete the Review without Friday.
    await enterMark(page, 'MNO', 'Mon Oct 12', '52.00');
    await continueToTrades(page);
    await tradesFamily(page).getByRole('button', { name: 'Review MNO' }).click();
    await saveAction(page, 'Hold');
    await expect(completion(page)).toHaveText('Complete');
    await reloadReview(page);
    await expect(completion(page)).toHaveText('Complete');
    await expect(markEntry(page, 'MNO', 'Fri Oct 9')).toContainText('Missing');

    // Friday's Mark from the optional list empties it.
    await enterMark(page, 'MNO', 'Fri Oct 9', '51.50');
    await reloadReview(page);
    await expect(completion(page)).toHaveText('Complete');
    await expect(page.getByRole('group', { name: EARLIER })).toHaveCount(0);
    await expect(markEntry(page, 'MNO', 'Fri Oct 9')).toHaveCount(0);
    expect(observationsOf(workspaceOf(await probe(page))!).map((o) => [o.tradingDate, o.marks[0]!.price])).toEqual([['2026-10-07', '50.5'], ['2026-10-08', '51'], ['2026-10-09', '51.5'], ['2026-10-12', '52']]);
    await context.close();
  });
});
