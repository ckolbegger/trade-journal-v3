import { acknowledgeMark, completion, createTrades, enterMark, expect, FOUR_TRADES, markRow, MONDAY_1700, observationsOf, onboardedAt, openReview, probe, reachCard, reloadReview, saveAction, status, test, workspaceOf } from './support.ts';

const DATE = 'Mon Oct 12';

test.describe('B4.3 Can\'t get a price', () => {
  test('should complete with Unavailable Marks naming DEF, go Incomplete when withdrawn, and complete after the Mark with the acknowledgment history kept', async ({ profile }) => {
    const { context, page } = await onboardedAt(profile, MONDAY_1700);
    await createTrades(page, [FOUR_TRADES[0]!, FOUR_TRADES[2]!]);
    await openReview(page);
    await enterMark(page, 'XYZ', DATE, '52.00');
    await acknowledgeMark(page, 'DEF', DATE, 'No quote available.');
    await reachCard(page, 'XYZ');
    await saveAction(page, 'Hold', undefined, 'XYZ');
    await reachCard(page, 'DEF');
    await saveAction(page, 'Hold', undefined, 'DEF');

    // Complete with Unavailable Marks, naming DEF (here and after a reload from stored facts).
    for (const reload of [false, true]) {
      if (reload) await reloadReview(page);
      await expect(completion(page)).toHaveText('Complete with Unavailable Marks');
      const unavailable = page.getByRole('group', { name: 'Unavailable Marks' });
      await expect(unavailable).toContainText('Instruments: DEF');
      await expect(unavailable).toContainText('Trades: DEF');
      await reachCard(page, 'DEF');
      await expect(await markRow(page, 'DEF', DATE)).toContainText('Acknowledged Unavailable');
    }

    // Withdrawn: the Mark is missing again and the Review Incomplete.
    await reachCard(page, 'DEF');
    await (await markRow(page, 'DEF', DATE)).getByRole('button', { name: 'Withdraw' }).click();
    await expect(await markRow(page, 'DEF', DATE)).toContainText('Missing');
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
