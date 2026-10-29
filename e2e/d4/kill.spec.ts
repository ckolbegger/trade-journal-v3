import { actionEntriesOf, BASE_URL, completion, continueToTrades, createTrades, enterMark, expect, firstPage, FOUR_TRADES, MONDAY_1700, observationsOf, onboardedPage, openReview, pinClock, probe, saveAction, spawnedBrowser, test, tradesFamily, workspaceOf } from './support.ts';

test.describe('B4.8 Kill after commit', () => {
  test('should keep the Action after the browser is killed once its save result renders, and resume the Review from it', async ({ profile }) => {
    const killed = await spawnedBrowser(profile.dir, 9339);
    try {
      await pinClock(killed.context, MONDAY_1700);
      const page = await onboardedPage(killed.context);
      await createTrades(page, [FOUR_TRADES[0]!]);
      await openReview(page);
      await enterMark(page, 'XYZ', 'Mon Oct 12', '52.00');
      await continueToTrades(page);
      await tradesFamily(page).getByRole('button', { name: 'Review XYZ' }).click();
      // saveAction returns once the save result has rendered; the browser is killed right after.
      await saveAction(page, 'Exit', 'Take the profit.');
      await expect(completion(page)).toHaveText('Complete');
    } finally {
      await killed.kill();
    }

    const relaunched = await spawnedBrowser(profile.dir, 9340);
    try {
      await pinClock(relaunched.context, MONDAY_1700);
      const page = await firstPage(relaunched.context);
      await page.goto(`${BASE_URL}/`);
      await openReview(page);
      // The Review resumes from the stored Action: Complete, the Action shown for the Trade.
      await expect(completion(page)).toHaveText('Complete');
      await continueToTrades(page);
      await expect(tradesFamily(page).getByRole('listitem').filter({ hasText: 'Review XYZ' })).toContainText('Action saved');
      await tradesFamily(page).getByRole('button', { name: 'Review XYZ' }).click();
      await expect(page.getByRole('region', { name: 'Saved Action' })).toContainText('Saved Action: Exit');

      const workspace = workspaceOf(await probe(page))!;
      const entries = actionEntriesOf(workspace);
      expect(entries).toHaveLength(1);
      expect(entries[0]!.obligationKey?.slice(0, 2)).toEqual(['DailyTradeReview', '2026-10-12']);
      expect(observationsOf(workspace).map((o) => o.instrumentKey)).toEqual(['XYZ']);
    } finally {
      await relaunched.kill();
    }
  });
});
