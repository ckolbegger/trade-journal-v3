import {
  answerIn, closeTheTrade, createTA, exitReflection, expect, factsOf, fillRows, firstPage, launchAt, MONDAY_1700, onboardedAt, openClosedTab, openExitForm, openTradeFromOpenList, probe, receiptResult,
  sell, test, tradesOf, TUESDAY_1405, TUESDAY_1405_LOCAL, TUESDAY_1000_LOCAL, valueOf, workspaceOf,
} from './support.ts';

test.use({ actionTimeout: 15_000 });

const NOT_WRITABLE = { name: /Read only/ };

test.describe('B6.8 Offline cold restart (AC-DEL-001)', () => {
  test('should record a partial and then a full exit offline after a full stop, and keep both across another offline restart', async ({ server, profile }) => {
    test.setTimeout(240_000);
    const { context: setup, page: setupPage } = await onboardedAt(profile, MONDAY_1700);
    await createTA(setupPage);
    await setup.close();
    // Network disabled: offline emulation plus no server for the origin at all.
    await server.close();

    const offline = await launchAt(profile, TUESDAY_1405, { offline: true });
    const page = await firstPage(offline);
    await page.goto('/');
    await expect(page.getByRole('region', NOT_WRITABLE)).toHaveCount(0);
    await openTradeFromOpenList(page, 'XYZ');

    // The partial exit: 30 of 100 shares, with its reflection.
    await openExitForm(page);
    await fillRows(page, [sell('30', '52.00', '0.60', TUESDAY_1000_LOCAL)]);
    await answerIn(exitReflection(page));
    await page.getByRole('button', { name: 'Save exit' }).click();
    await expect(page.getByRole('heading', { name: 'Exit recorded', level: 1 })).toBeVisible();
    await expect(valueOf(receiptResult(page), 'Realized to date')).toContainText('$55.90');
    await page.getByRole('link', { name: 'Back to the Trade' }).click();
    await expect(valueOf(page, 'Position')).toHaveText('70 shares of XYZ');

    // The full exit of the remaining 70, closing the Trade.
    await openExitForm(page);
    await fillRows(page, [sell('70', '53.00', '1.40', TUESDAY_1405_LOCAL)]);
    await closeTheTrade(page, 'now');
    await page.getByRole('button', { name: 'Save exit' }).click();
    await expect(page.getByRole('heading', { name: 'Exit recorded', level: 1 })).toBeVisible();
    await expect(valueOf(receiptResult(page), 'Lifecycle')).toHaveText('Closed');
    await offline.close();

    // Another offline restart: both exits, the Close Reason, and the Closed lifecycle survive.
    const again = await launchAt(profile, TUESDAY_1405, { offline: true });
    const reopened = await firstPage(again);
    await openClosedTab(reopened);
    await expect(reopened.getByRole('region', NOT_WRITABLE)).toHaveCount(0);
    const row = reopened.getByRole('table', { name: 'Closed Trades' }).locator('tbody tr', { hasText: 'XYZ' });
    await expect(row).toContainText('Target Reached');
    await row.getByRole('link', { name: 'XYZ', exact: true }).click();
    await expect(valueOf(reopened, 'Terminal Disposition')).toHaveText('Closed via sale of 100 shares');
    await expect(valueOf(reopened, 'Close Reason')).toHaveText('Target Reached');
    await expect(reopened.getByRole('table', { name: 'Lot Matches' }).locator('tbody tr')).not.toHaveCount(0);
    const workspace = workspaceOf(await probe(reopened))!;
    const [trade] = tradesOf(workspace);
    expect(trade!.lifecycle).toBe('Closed');
    const executions = factsOf(trade!, 'Execution').map((f) => f.versions.at(-1)!.value);
    expect(executions.filter((e) => e['action'] === 'Sell').map((e) => e['quantity'])).toEqual(['30', '70']);
    await again.close();
  });
});
