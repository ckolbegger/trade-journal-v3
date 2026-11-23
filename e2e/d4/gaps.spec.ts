import { expectMark, marksPanelOf, markEditorOf, completion, createTradeAt, enterMark, expect, FOUR_TRADES, MONDAY_1700, observationsOf, onboardedAt, openReview, probe, reachCard, reloadReview, saveAction, setClock, test, workspaceOf } from './support.ts';

const MNO = { ...FOUR_TRADES[0]!.plan, symbol: 'MNO' };
const WEDNESDAY_1700 = '2026-10-07T21:00:00Z';
const THURSDAY_1700 = '2026-10-08T21:00:00Z';
const EARLIER = "Earlier sessions don't block the Review.";

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
    const marks = await marksPanelOf(page, 'MNO');
    await expect(marks).toContainText(EARLIER);
    await expect(await markEditorOf(page, 'MNO', 'Fri Oct 9')).toBeVisible();
    await expect(marks).not.toContainText('Wed Oct 7');
    await expect(marks).not.toContainText('Thu Oct 8');

    // Monday's Mark and an Action complete the Review without Friday.
    await enterMark(page, 'MNO', 'Mon Oct 12', '52.00');
    await reachCard(page, 'MNO');
    await saveAction(page, 'Hold', undefined, 'MNO');
    await expect(completion(page)).toHaveText('Complete');
    await reloadReview(page);
    await expect(completion(page)).toHaveText('Complete');
    await reachCard(page, 'MNO');
    await expectMark(page, 'MNO', 'Fri Oct 9', 'Missing');

    // Friday's Mark from the optional list empties it.
    await enterMark(page, 'MNO', 'Fri Oct 9', '51.50');
    await reloadReview(page);
    await expect(completion(page)).toHaveText('Complete');
    await expect(await marksPanelOf(page, 'MNO')).not.toContainText(EARLIER);
    // Friday stays as the Previous column, with its Mark.
    await expectMark(page, 'MNO', 'Fri Oct 9', 'Manual');
    expect(observationsOf(workspaceOf(await probe(page))!).map((o) => [o.tradingDate, o.marks[0]!.price])).toEqual([['2026-10-07', '50.5'], ['2026-10-08', '51'], ['2026-10-09', '51.5'], ['2026-10-12', '52']]);
    await context.close();
  });
});
