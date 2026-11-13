import {
  AT_10, checkForUpdate, closeTheTrade, confirmReference, deferEntry, detail, expect, fillRows, identity, launchAt, MONDAY_1700, onboardedPage, openClosedTab, openExitForm, openTradeFromOpenList, probe,
  recordEntry, reloadFromNotice, rootOf, sell, SECOND_PLAN, test, valueOf, watchUpdatingAcrossDocuments, workspaceNames,
} from './support.ts';

test.use({ actionTimeout: 15_000 });

test.describe('B6.6 Update from D5R2 with data', { tag: '@release-history' }, () => {
  test('should show Updating your journal, keep two Open Trades and the deferred reflection, close a Trade with a full exit, show schema 5 in About, and point to the new database with the old one gone', async ({ server, profile }) => {
    test.setTimeout(240_000);
    server.use('dist-releases/d5r2');
    const context = await launchAt(profile, MONDAY_1700);
    const updating = await watchUpdatingAcrossDocuments(context);
    const page = await onboardedPage(context);

    // Two Open Trades on the previous release, one with a deferred reflection.
    await confirmReference(page);
    await recordEntry(page, [AT_10]);
    await confirmReference(page, SECOND_PLAN);
    await deferEntry(page, [AT_10]);
    // The update's Reload reloads the page it is on.
    await page.goto('/');
    await expect(page.getByRole('table', { name: 'Open Trades' }).getByRole('link', { name: 'XYZ', exact: true })).toBeVisible();
    await expect(page.getByRole('table', { name: 'Open Trades' }).getByRole('link', { name: 'ABC', exact: true })).toBeVisible();
    const before = await probe(page);
    const oldDatabase = rootOf(before).current;
    expect(workspaceNames(before)).toEqual([oldDatabase]);

    server.use('dist-releases/d6');
    expect(await checkForUpdate(page)).toEqual({ waiting: 'installed' });
    await reloadFromNotice(page);
    await expect.poll(() => updating.seen(), { timeout: 3000 }).toBe(true);

    // The earlier data is intact: both Trades are Open, and the deferred reflection is still owed.
    await expect(page.getByRole('table', { name: 'Open Trades' }).getByRole('link', { name: 'XYZ', exact: true })).toBeVisible();
    await openTradeFromOpenList(page, 'ABC');
    await expect(detail.reflectionOwed(page)).toBeVisible();

    // A full exit closes the Trade.
    await page.goto('/');
    await openTradeFromOpenList(page, 'XYZ');
    await openExitForm(page);
    await fillRows(page, [sell('100', '53.00', '1.00', '')]);
    await closeTheTrade(page, 'later');
    await page.getByRole('button', { name: 'Save exit' }).click();
    await expect(page.getByRole('heading', { name: 'Exit recorded', level: 1 })).toBeVisible();
    await expect(valueOf(page.getByRole('region', { name: 'Result' }), 'Lifecycle')).toHaveText('Closed');
    await openClosedTab(page);
    await expect(page.getByRole('table', { name: 'Closed Trades' }).getByRole('link', { name: 'XYZ', exact: true })).toBeVisible();

    // About: the current release at schema 5.
    await page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'About' }).click();
    await expect(page.locator('.identity')).toHaveText(identity('d6'));
    await expect(page.locator('dt:has-text("Schema version") + dd')).toHaveText('5');

    const after = await probe(page);
    const { current, candidates } = rootOf(after);
    expect(current).not.toBe(oldDatabase);
    expect(workspaceNames(after)).toEqual([current]);
    expect(candidates).toEqual([]);
    await context.close();
  });
});
