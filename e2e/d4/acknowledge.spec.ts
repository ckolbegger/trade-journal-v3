import { acknowledgeMark, completion, continueToTrades, createTrades, enterMark, expect, FOUR_TRADES, markEntry, MONDAY_1700, observationsOf, onboardedAt, openReview, probe, reloadReview, saveAction, status, test, tradesFamily, workspaceOf } from './support.ts';

const DATE = 'Mon Oct 12';

test.describe('B4.3 Can\'t get a price', () => {
  test('should complete with Unavailable Marks naming DEF, go Incomplete when withdrawn, and complete after the Mark with the acknowledgment history kept', async ({ profile }) => {
    const { context, page } = await onboardedAt(profile, MONDAY_1700);
    await createTrades(page, [FOUR_TRADES[0]!, FOUR_TRADES[2]!]);
    await openReview(page);
    await enterMark(page, 'XYZ', DATE, '52.00');
    await acknowledgeMark(page, 'DEF', DATE, 'No quote available.');
    await continueToTrades(page);
    await tradesFamily(page).getByRole('button', { name: 'Review XYZ' }).click();
    await saveAction(page, 'Hold');
    await tradesFamily(page).getByRole('button', { name: 'Review DEF' }).click();
    await saveAction(page, 'Hold');

    // Complete with Unavailable Marks, naming DEF (here and after a reload from stored facts).
    for (const reload of [false, true]) {
      if (reload) await reloadReview(page);
      await expect(completion(page)).toHaveText('Complete with Unavailable Marks');
      const unavailable = page.getByRole('group', { name: 'Unavailable Marks' });
      await expect(unavailable).toContainText('Instruments: DEF');
      await expect(unavailable).toContainText('Trades: DEF');
      await expect(markEntry(page, 'DEF', DATE)).toContainText('Acknowledged Unavailable');
    }

    // Withdrawn: the Mark is missing again and the Review Incomplete.
    await markEntry(page, 'DEF', DATE).getByRole('button', { name: 'Withdraw' }).click();
    await expect(markEntry(page, 'DEF', DATE)).toContainText('Missing');
    await reloadReview(page);
    await expect(completion(page)).toHaveText('Incomplete');
    await expect(status(page)).toContainText('Mark missing for DEF on Mon Oct 12');

    // A Mark makes it Complete, with no unavailability left.
    await enterMark(page, 'DEF', DATE, '40.50');
    await reloadReview(page);
    await expect(completion(page)).toHaveText('Complete');
    await expect(page.getByRole('group', { name: 'Unavailable Marks' })).toHaveCount(0);

    // The acknowledgment history is kept beside the Mark.
    const def = observationsOf(workspaceOf(await probe(page))!).find((o) => o.instrumentKey === 'DEF')!;
    expect(def.acknowledgments.map((a) => [a.kind, a.reason])).toEqual([['Asserted', 'No quote available.'], ['Withdrawn', undefined]]);
    expect(def.marks.map((m) => m.price)).toEqual(['40.5']);
    await context.close();
  });
});
