import { actionEntriesOf, checkForUpdate, completion, confirmReference, continueToTrades, enterMark, expect, identity, launchAt, markEntry, MONDAY_1700, onboardedPage, openReview, probe, READY, recordEntry, reloadFromNotice, rootOf, SECOND_PLAN, test, tradesFamily, saveAction, watchUpdatingAcrossDocuments, workspaceNames, workspaceOf } from './support.ts';

const AT_10 = { quantity: '100', price: '50.00', fee: '1.00', time: '2026-10-12T10:00' };

test.describe('B4.7 update from D2 with data', () => {
  test('should show Updating your journal, then the Review with both Instruments, a working Mark and Action, About at schema 3 with the session policy, and the new database pointed to with the old one gone', async ({ server, profile }) => {
    server.use('dist-releases/d2');
    const context = await launchAt(profile, MONDAY_1700);
    const updating = await watchUpdatingAcrossDocuments(context);
    const page = await onboardedPage(context);
    await confirmReference(page);
    await recordEntry(page, [AT_10]);
    await confirmReference(page, SECOND_PLAN);
    await recordEntry(page, [AT_10]);
    // The update's Reload reloads the page it is on.
    await page.goto('/');
    await expect(page.getByRole('table', { name: 'Open Trades' }).getByRole('link', { name: 'ABC', exact: true })).toBeVisible(READY);
    const before = await probe(page);
    const oldDatabase = rootOf(before).current;
    expect(workspaceNames(before)).toEqual([oldDatabase]);

    server.use('dist-releases/d4');
    expect(await checkForUpdate(page)).toEqual({ waiting: 'installed' });
    await reloadFromNotice(page);
    await expect.poll(() => updating.seen(), { timeout: 3000 }).toBe(true);

    // The Review lists both Instruments' Marks; a Mark and an Action save.
    await openReview(page);
    await expect(completion(page)).toHaveText('Incomplete');
    await expect(markEntry(page, 'XYZ', 'Mon Oct 12')).toContainText('Missing');
    await expect(markEntry(page, 'ABC', 'Mon Oct 12')).toContainText('Missing');
    await enterMark(page, 'XYZ', 'Mon Oct 12', '52.00');
    await continueToTrades(page);
    await tradesFamily(page).getByRole('button', { name: 'Review XYZ' }).click();
    await saveAction(page, 'Hold');
    await expect(tradesFamily(page).getByRole('listitem').filter({ hasText: 'Review XYZ' })).toContainText('Action saved');

    // About: the d4 release at schema 3 with the session policy.
    await page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'About' }).click();
    await expect(page.locator('.identity')).toHaveText(identity('d4'));
    await expect(page.locator('dt:has-text("Schema version") + dd')).toHaveText('3');
    await expect(page.locator('dd.policy-id')).toHaveText('nyse');

    const after = await probe(page);
    const { current, candidates } = rootOf(after);
    expect(current).not.toBe(oldDatabase);
    expect(workspaceNames(after)).toEqual([current]);
    expect(candidates).toEqual([]);
    expect(actionEntriesOf(workspaceOf(after)!)).toHaveLength(1);
    await context.close();
  });
});
