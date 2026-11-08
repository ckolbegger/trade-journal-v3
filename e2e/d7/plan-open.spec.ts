import { confirmOptionPlan, currentTradeId, expect, factsOf, firstPage, launchAt, MONDAY_0900, MONDAY_1105, OC, onboardedAt, probe, recordOptionEntry, test, tradesOf, valueOf, workspaceOf } from './support.ts';

test.use({ actionTimeout: 15_000 });

test.describe('B7.1 Plan and open a Long Call', () => {
  test('should show 1R $400.00 and the Planned payoff with Breakeven 57.00 after confirmation, then Open with 2 contracts, Entry Quality risk $401.30 and the Current payoff Breakeven 57.01 after two entries, and store the option Instrument, conditions holding only their triggers and Exercise Intent NotAuthorized after a relaunch', async ({ profile }) => {
    test.setTimeout(240_000);
    // Monday 09:00: New Plan, Long Call, O-C's terms, reflection; confirm.
    const { context: first, page } = await onboardedAt(profile, MONDAY_0900);
    await confirmOptionPlan(page, OC);
    const tradeId = await currentTradeId(page);
    await expect(valueOf(page, '1R (original risk)')).toHaveText('$400.00');
    await expect(page.getByRole('region', { name: 'Planned Expiration Payoff' })).toContainText('Breakeven 57.00');
    await first.close();

    // Monday 11:05: Record entry 1 @ 2.10 and 1 @ 1.90.
    const context = await launchAt(profile, MONDAY_1105);
    const again = await firstPage(context);
    await again.goto(`/trades/${tradeId}`);
    await expect(again.getByRole('heading', { name: 'XYZ', level: 1 })).toBeVisible();
    await recordOptionEntry(again, [
      { quantity: '1', price: '2.10', fee: '0.65', time: '2026-10-12T10:00' },
      { quantity: '1', price: '1.90', fee: '0.65', time: '2026-10-12T11:00' },
    ]);
    await context.close();

    // Relaunch; open Detail.
    const relaunched = await launchAt(profile, MONDAY_1105);
    const detail = await firstPage(relaunched);
    await detail.goto(`/trades/${tradeId}`);
    await expect(detail.getByRole('heading', { name: 'XYZ', level: 1 })).toBeVisible();
    await expect(detail.locator('header').getByText('Open', { exact: true })).toBeVisible();
    await expect(valueOf(detail, 'Position')).toHaveText('Long 2 contracts of XYZ 20 Nov 2026 55 Call');
    await expect(valueOf(detail.getByRole('region', { name: 'Entry Quality' }), 'Actual initial risk')).toContainText('$401.30');
    await expect(detail.getByRole('region', { name: 'Current Expiration Payoff' })).toContainText('Breakeven 57.01');

    // Durable state: the option Instrument, conditions holding only their triggers, Exercise Intent NotAuthorized.
    const [trade] = tradesOf(workspaceOf(await probe(detail))!);
    const value = (kind: string) => factsOf(trade!, kind)[0]!.versions.at(-1)!.value;
    expect(trade!.lifecycle).toBe('Open');
    expect(value('PlannedLeg')).toEqual({
      side: 'Long',
      instrument: { kind: 'Option', symbol: 'XYZ', root: 'XYZ', expiration: '2026-11-20', strike: '55', right: 'Call', multiplier: 100 },
      quantity: '2',
      intendedEntry: '2',
    });
    expect(value('Stop')).toEqual({ kind: 'UnderlyingPrice', price: '48' });
    expect(value('Target')).toEqual({ kind: 'UnderlyingPrice', price: '60' });
    expect(value('Plan')['exerciseIntent']).toBe('NotAuthorized');
    await relaunched.close();
  });
});
