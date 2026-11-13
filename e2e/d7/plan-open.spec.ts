import { expectNoSidewaysScroll, setWidth } from '../d7p/support.ts';
import { confirmOptionPlan, currentTradeId, detail, expect, factsOf, fillOptionPlan, firstPage, launchAt, MONDAY_0900, MONDAY_1105, OC, onboardedAt, openDrawer, probe, recordOptionEntry, test, tradesOf, workspaceOf } from './support.ts';

test.use({ actionTimeout: 15_000 });

test.describe('B7.1 Plan and open a Long Call', () => {
  test('should show 1R $400.00 and the Planned payoff with Breakeven 57.00 after confirmation, then Open with 2 contracts, Entry Quality risk $401.30 and the Current payoff Breakeven 57.01 after two entries, and store the option Instrument, conditions holding only their triggers and Exercise Intent NotAuthorized after a relaunch', async ({ profile }) => {
    test.setTimeout(240_000);
    // Monday 09:00: New Plan, Long Call, O-C's terms, reflection; confirm.
    const { context: first, page } = await onboardedAt(profile, MONDAY_0900);
    await confirmOptionPlan(page, OC);
    const tradeId = await currentTradeId(page);
    await openDrawer(page, 'Plan and Risk');
    await expect(detail.oneR(page)).toHaveText('$400.00');
    await openDrawer(page, 'Payoff');
    await expect(detail.payoff(page, 'Planned')).toContainText('Breakeven 57.00');
    await first.close();

    // Monday 11:05: Record entry 1 @ 2.10 and 1 @ 1.90.
    const context = await launchAt(profile, MONDAY_1105);
    const again = await firstPage(context);
    await again.goto(`/trades/${tradeId}`);
    await expect(detail.heading(again, 'XYZ')).toBeVisible();
    await recordOptionEntry(again, [
      { quantity: '1', price: '2.10', fee: '0.65', time: '2026-10-12T10:00' },
      { quantity: '1', price: '1.90', fee: '0.65', time: '2026-10-12T11:00' },
    ]);
    await context.close();

    // Relaunch; open Detail.
    const relaunched = await launchAt(profile, MONDAY_1105);
    const reopened = await firstPage(relaunched);
    await reopened.goto(`/trades/${tradeId}`);
    await expect(detail.heading(reopened, 'XYZ')).toBeVisible();
    await expect(detail.lifecycleBadge(reopened)).toHaveText('Long Call, Open');
    await openDrawer(reopened, 'Position');
    await expect(detail.positionValue(reopened)).toHaveText('Long 2 contracts of XYZ 20 Nov 2026 55 Call');
    await openDrawer(reopened, 'Plan and Risk');
    await expect(detail.actualInitialRisk(reopened)).toContainText('$401.30');
    await openDrawer(reopened, 'Payoff');
    await expect(detail.payoff(reopened, 'Current')).toContainText('Breakeven 57.01');

    // Durable state: the option Instrument, conditions holding only their triggers, Exercise Intent NotAuthorized.
    const [trade] = tradesOf(workspaceOf(await probe(reopened))!);
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

test.describe('BUG-2 Expiration date', () => {
  test('should show the Expiration error beside an empty date, clear it as soon as 2026-11-20 is filled, and then confirm to a Trade Detail reading Expires Fri 20 Nov 2026', async ({ profile }) => {
    test.setTimeout(240_000);
    const { context: first, page } = await onboardedAt(profile, MONDAY_0900);
    await fillOptionPlan(page, { ...OC, expiration: '' });
    const expiration = page.getByLabel('Expiration date');
    await expect(expiration).toHaveAttribute('type', 'date');
    await page.getByRole('button', { name: 'Confirm Plan' }).click();
    await expect(expiration).toHaveAttribute('aria-invalid', 'true');
    await expect(page.locator('.field', { has: expiration })).toContainText('Enter an expiration date in the years 2000 to 2099.');
    await expiration.fill('2026-11-20');
    await expect(expiration).not.toHaveAttribute('aria-invalid', 'true');
    await expect(page.locator('.field', { has: expiration })).not.toContainText('Enter an expiration date');
    await page.getByRole('button', { name: 'Confirm Plan' }).click();
    await expect(detail.heading(page, 'XYZ')).toBeVisible();
    const tradeId = await currentTradeId(page);
    await first.close();

    // The contract's expiration line shows on the Open Trade (D7 row 23.19).
    const context = await launchAt(profile, MONDAY_1105);
    const reopened = await firstPage(context);
    await reopened.goto(`/trades/${tradeId}`);
    await expect(detail.heading(reopened, 'XYZ')).toBeVisible();
    await recordOptionEntry(reopened, [{ quantity: '2', price: '2.00', fee: '0.65', time: '2026-10-12T10:00' }]);
    await reopened.goto(`/trades/${tradeId}`);
    await expect(detail.summary(reopened).getByText('Expires Fri 20 Nov 2026')).toBeVisible();
    await context.close();
  });
});

test.describe('BUG-1 Exercise Intent checkbox', () => {
  test('should draw the Exercise Intent checkbox small, beside its label text, in a row at least 44 px tall, without sideways scroll at 1280, 375 and 320 px', async ({ profile }) => {
    test.setTimeout(240_000);
    const { page } = await onboardedAt(profile, MONDAY_0900);
    await fillOptionPlan(page, OC);
    const box = page.getByRole('checkbox', { name: 'I plan to exercise this option if it is in the money' });
    const row = page.locator('label', { has: box });
    await box.scrollIntoViewIfNeeded();
    for (const width of [1280, 375, 320]) {
      await setWidth(page, width);
      const where = `at ${width} px`;
      const checkbox = (await box.boundingBox())!;
      expect(checkbox.width, `checkbox width ${where}`).toBeLessThanOrEqual(32);
      // The label text's first line box, measured by a range over its text node.
      const firstLine = await row.evaluate((label) => {
        const text = [...label.childNodes].find((n) => n.nodeType === Node.TEXT_NODE)!;
        const range = document.createRange();
        range.selectNodeContents(text);
        const line = range.getClientRects()[0]!;
        return { top: line.top, bottom: line.bottom };
      });
      const centre = checkbox.y + checkbox.height / 2;
      expect(centre, `checkbox centre ${where} is within the text's first line`).toBeGreaterThanOrEqual(firstLine.top);
      expect(centre, `checkbox centre ${where} is within the text's first line`).toBeLessThanOrEqual(firstLine.bottom);
      expect((await row.boundingBox())!.height, `label row height ${where}`).toBeGreaterThanOrEqual(44);
      await expectNoSidewaysScroll(page, where);
    }
    await page.context().close();
  });
});
