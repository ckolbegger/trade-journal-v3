import {
  createShortPutTrade, expect, factsOf, firstPage, FRIDAY_NOV_1700, launchAt, MONDAY_0900, onboardedAt, openClosedTab, probe, receiptResult, recordExpiration, test, tradesOf, valueOf, workspaceOf,
} from './support.ts';

test.use({ actionTimeout: 15_000 });

const NOT_WRITABLE = { name: /Read only/ };

test.describe('B7.9 Offline cold restart (AC-DEL-001)', () => {
  test('should confirm an option Plan, record an entry, and record an Expiration offline after a full stop, and keep all three across another offline restart', async ({ server, profile }) => {
    test.setTimeout(300_000);
    // Online once, so the app is installed; then closed.
    const { context: setup } = await onboardedAt(profile, MONDAY_0900);
    await setup.close();
    // Network disabled: offline emulation plus no server for the origin at all.
    await server.close();

    const offline = await launchAt(profile, FRIDAY_NOV_1700, { offline: true });
    const page = await firstPage(offline);
    await page.goto('/');
    await expect(page.getByRole('region', NOT_WRITABLE)).toHaveCount(0);
    const tradeId = await createShortPutTrade(page);
    await page.getByRole('link', { name: 'Record expiration' }).click();
    await recordExpiration(page);
    await expect(valueOf(receiptResult(page), 'Lifecycle')).toHaveText('Closed');
    await offline.close();

    // Another offline restart: the Plan, the entry and the Expiration survive.
    const again = await launchAt(profile, FRIDAY_NOV_1700, { offline: true });
    const reopened = await firstPage(again);
    await openClosedTab(reopened);
    await expect(reopened.getByRole('region', NOT_WRITABLE)).toHaveCount(0);
    const row = reopened.getByRole('table', { name: 'Closed Trades' }).locator('tbody tr', { hasText: 'MNO' });
    await row.getByRole('link', { name: 'MNO', exact: true }).click();
    await expect(valueOf(reopened, 'Terminal Disposition')).toHaveText('Closed via expiration of 2 contracts');
    const workspace = workspaceOf(await probe(reopened))!;
    const [trade] = tradesOf(workspace);
    expect(trade!.tradeId).toBe(tradeId);
    expect(trade!.lifecycle).toBe('Closed');
    expect(factsOf(trade!, 'Plan')).toHaveLength(1);
    expect(factsOf(trade!, 'Execution')).toHaveLength(1);
    expect(factsOf(trade!, 'Expiration')).toHaveLength(1);
    await again.close();
  });
});
