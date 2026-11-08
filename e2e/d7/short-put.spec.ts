import {
  confirmOptionPlan, currentTradeId, expect, factsOf, fillOptionExit, firstPage, launchAt, MONDAY_0900, MONDAY_1105, onboardedAt, OS, probe, receiptResult, recordOptionEntry, test, tradesOf, TUESDAY_1030, valueOf,
  workspaceOf,
} from './support.ts';

test.use({ actionTimeout: 15_000 });

test.describe('B7.2 Cash-Secured Put', () => {
  test('should refuse Buy to close 3 of 2 short contracts with the position-only-has-2 error and save nothing, then close 1 @ 0.60 to Open with 1 short contract and realized $63.70', async ({ profile }) => {
    test.setTimeout(240_000);
    // Plan O-S (Monday 09:00).
    const { context: first, page } = await onboardedAt(profile, MONDAY_0900);
    await confirmOptionPlan(page, OS);
    const tradeId = await currentTradeId(page);
    await first.close();

    // Monday 11:05: Sell to open 2 @ 1.25, fee 1.30 (S1, Monday 10:00).
    const second = await launchAt(profile, MONDAY_1105);
    const entryPage = await firstPage(second);
    await entryPage.goto(`/trades/${tradeId}`);
    await expect(entryPage.getByRole('heading', { name: 'MNO', level: 1 })).toBeVisible();
    await recordOptionEntry(entryPage, [{ quantity: '2', price: '1.25', fee: '1.30', time: '2026-10-12T10:00' }]);
    await second.close();

    // Tuesday 10:30: Buy to close 3 is refused with its error beside the row, and the exit is not saved.
    const context = await launchAt(profile, TUESDAY_1030);
    const page2 = await firstPage(context);
    await page2.goto(`/trades/${tradeId}`);
    await expect(valueOf(page2, 'Position')).toHaveText('Short 2 contracts of MNO 20 Nov 2026 45 Put');
    await fillOptionExit(page2, [{ quantity: '3', price: '0.60', fee: '0.65', time: '2026-10-13T10:00' }]);
    await page2.getByRole('button', { name: 'Save exit' }).click();
    await expect(page2.getByRole('heading', { name: 'This exit can’t be saved yet' })).toBeVisible();
    await expect(page2.getByText('Execution 1: The position has only 2 contracts.').first()).toBeVisible();
    await expect(page2.getByRole('heading', { name: 'Exit recorded' })).toHaveCount(0);
    await page2.reload();
    const stored = tradesOf(workspaceOf(await probe(page2))!)[0]!;
    expect(factsOf(stored, 'Execution')).toHaveLength(1);

    // Then Buy to close 1 @ 0.60.
    await page2.goto(`/trades/${tradeId}`);
    await fillOptionExit(page2, [{ quantity: '1', price: '0.60', fee: '0.65', time: '2026-10-13T10:00' }]);
    await page2.getByRole('button', { name: 'Save exit' }).click();
    await expect(page2.getByRole('heading', { name: 'Exit recorded', level: 1 })).toBeVisible();
    await expect(valueOf(receiptResult(page2), 'Lifecycle')).toHaveText('Open');
    await expect(valueOf(receiptResult(page2), 'Realized to date')).toContainText('$63.70');
    await context.close();

    // Relaunch: the Trade is Open with 1 short contract and the realized amount, from stored facts.
    const relaunched = await launchAt(profile, TUESDAY_1030);
    const detail = await firstPage(relaunched);
    await detail.goto(`/trades/${tradeId}`);
    await expect(valueOf(detail, 'Position')).toHaveText('Short 1 contract of MNO 20 Nov 2026 45 Put');
    await expect(valueOf(detail, 'Realized to date')).toContainText('$63.70');
    await expect(detail.locator('header').getByText('Open', { exact: true })).toBeVisible();
    const final = tradesOf(workspaceOf(await probe(detail))!)[0]!;
    expect(final.lifecycle).toBe('Open');
    expect(factsOf(final, 'Execution').map((f) => [f.versions.at(-1)!.value['action'], f.versions.at(-1)!.value['quantity']])).toEqual([['Sell', '2'], ['Buy', '1']]);
    await relaunched.close();
  });
});
