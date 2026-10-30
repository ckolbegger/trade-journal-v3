import {
  actionEntriesOf, AT_10, checkForUpdate, completion, confirmReference, continueToTrades, deferEntry, enterMark, expect, identity, launchAt, MONDAY, MONDAY_1700, onboardedPage, openReview, probe, READY, recordEntry,
  reflectionsOf, reloadFromNotice, rootOf, saveAction, SECOND_PLAN, setClock, test, tradeCard, TUESDAY, TUESDAY_1700, tradesFamily, watchUpdatingAcrossDocuments, workspaceNames, workspaceOf,
} from './support.ts';

test.describe('B5.6 Update from D4 with data', () => {
  test('should show Updating your journal, keep two Open Trades with their Actions, list a new deferred reflection as due, show schema 4 in About, and point to the new database with the old one gone', async ({ server, profile }) => {
    server.use('dist-releases/d4');
    const context = await launchAt(profile, MONDAY_1700);
    const updating = await watchUpdatingAcrossDocuments(context);
    const page = await onboardedPage(context);

    // Two Open Trades with Actions, on the previous release.
    await confirmReference(page);
    await recordEntry(page, [AT_10]);
    await confirmReference(page, SECOND_PLAN);
    await recordEntry(page, [AT_10]);
    await openReview(page);
    await enterMark(page, 'XYZ', MONDAY, '52.00');
    await enterMark(page, 'ABC', MONDAY, '27.50');
    await continueToTrades(page);
    for (const symbol of ['ABC', 'XYZ']) {
      await tradesFamily(page).getByRole('button', { name: `Review ${symbol}` }).click();
      await saveAction(page, 'Hold');
    }
    await expect(completion(page)).toHaveText('Complete');
    // The update's Reload reloads the page it is on.
    await page.goto('/');
    await expect(page.getByRole('table', { name: 'Open Trades' }).getByRole('link', { name: 'ABC', exact: true })).toBeVisible(READY);
    const before = await probe(page);
    const oldDatabase = rootOf(before).current;
    expect(workspaceNames(before)).toEqual([oldDatabase]);
    expect(actionEntriesOf(workspaceOf(before)!)).toHaveLength(2);

    server.use('dist-releases/d5');
    expect(await checkForUpdate(page)).toEqual({ waiting: 'installed' });
    await reloadFromNotice(page);
    await expect.poll(() => updating.seen(), { timeout: 3000 }).toBe(true);

    // The earlier data is intact: both Trades are Open and Monday's Review is Complete with both Actions.
    await expect(page.getByRole('table', { name: 'Open Trades' }).getByRole('link', { name: 'XYZ', exact: true })).toBeVisible(READY);
    await expect(page.getByRole('table', { name: 'Open Trades' }).getByRole('link', { name: 'ABC', exact: true })).toBeVisible(READY);
    await openReview(page);
    await expect(completion(page)).toHaveText('Complete');
    await continueToTrades(page);
    for (const symbol of ['ABC', 'XYZ']) {
      await expect(tradesFamily(page).getByRole('listitem').filter({ hasText: `Review ${symbol}` })).toContainText('Action saved');
    }

    // A deferred entry dated Monday afternoon is due in Tuesday's Review.
    await setClock(context, page, TUESDAY_1700);
    await page.getByRole('table', { name: 'Open Trades' }).getByRole('link', { name: 'XYZ', exact: true }).click();
    await deferEntry(page, [{ quantity: '20', price: '51.00', fee: '1.00', time: '2026-10-12T14:00' }]);
    await openReview(page);
    await enterMark(page, 'XYZ', TUESDAY, '52.50');
    await enterMark(page, 'ABC', TUESDAY, '27.80');
    await continueToTrades(page);
    await tradesFamily(page).getByRole('button', { name: 'Review XYZ' }).click();
    await expect(tradeCard(page, 'XYZ')).toBeVisible();
    await expect(reflectionsOf(page, 'XYZ').getByText('Due', { exact: true })).toBeVisible();

    // About: the d5 release at schema 4.
    await page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'About' }).click();
    await expect(page.locator('.identity')).toHaveText(identity('d5'));
    await expect(page.locator('dt:has-text("Schema version") + dd')).toHaveText('4');

    const after = await probe(page);
    const { current, candidates } = rootOf(after);
    expect(current).not.toBe(oldDatabase);
    expect(workspaceNames(after)).toEqual([current]);
    expect(candidates).toEqual([]);
    expect(actionEntriesOf(workspaceOf(after)!)).toHaveLength(2);
    await context.close();
  });
});
