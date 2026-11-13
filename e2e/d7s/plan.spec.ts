import { confirmBothKinds, detail, expect, factsOf, fillBothKinds, firstPage, launchAt, MONDAY_0900, MONDAY_1105, OC2, onboardedAt, openDrawer, OS2, probe, stopOptionLabel, targetOptionLabel, test, tradesOf, workspaceOf } from './support.ts';

test.use({ actionTimeout: 15_000 });

const UNDERLYING_STOP = /^Stop \((?!option price)/;
const UNDERLYING_TARGET = /^Target \((?!option price)/;

test.describe('B7S.1 Plan a Cash-Secured Put with both kinds', () => {
  test('should show 1R $480.00 and Reward : risk 0.29 after confirming O-S2 with all four price fields, list the four condition lines on Detail after a relaunch, and store four conditions with their kinds and prices', async ({ profile }) => {
    test.setTimeout(240_000);
    // Monday 09:00: New Plan, Cash-Secured Put, O-S2's terms in all four price fields, reflection; confirm.
    const { context: first, page } = await onboardedAt(profile, MONDAY_0900);
    const tradeId = await confirmBothKinds(page, OS2);
    await openDrawer(page, 'Plan and Risk');
    await expect(detail.oneR(page)).toHaveText('$480.00');
    await expect(detail.summaryValue(page, 'Reward : risk')).toHaveText('0.29');
    await first.close();

    // Relaunch; open Detail: W6's four lines, one per condition in Plan order.
    const context = await launchAt(profile, MONDAY_1105);
    const reopened = await firstPage(context);
    await reopened.goto(`/trades/${tradeId}`);
    await expect(detail.heading(reopened, 'MNO')).toBeVisible();
    await openDrawer(reopened, 'Plan and Risk');
    await expect(detail.oneR(reopened)).toHaveText('$480.00');
    // The Summary and the Plan card each show the four lines once (the cockpit shows them in one place).
    for (const where of [detail.summaryValue, detail.planValue]) {
      await expect(where(reopened, 'Stop').locator('div')).toHaveText(['MNO at or below 41.00', 'Option at or above $3.60']);
      await expect(where(reopened, 'Target').locator('div')).toHaveText(['MNO at or above 44.50', 'Option at or below $0.30']);
    }

    // Durable state: four conditions with their kinds and prices, in Plan order.
    const [trade] = tradesOf(workspaceOf(await probe(reopened))!);
    const conditions = (kind: string) => factsOf(trade!, kind).map((fact) => [fact.versions.at(-1)!.value['kind'], fact.versions.at(-1)!.value['price']]);
    expect(conditions('Stop')).toEqual([['UnderlyingPrice', '41'], ['StructureValue', '3.6']]);
    expect(conditions('Target')).toEqual([['UnderlyingPrice', '44.5'], ['StructureValue', '0.3']]);
    await context.close();
  });
});

test.describe('B7S.2 Plan validation', () => {
  test('should reject a Long Call with an option-price Stop of 2.50 and no Target with the Stop error beside the option-price Stop and the Target error beside the Underlying Target, focus on the summary, keep the values, and save nothing after a reload', async ({ profile }) => {
    test.setTimeout(120_000);
    const { context, page } = await onboardedAt(profile, MONDAY_0900);
    await fillBothKinds(page, { ...OC2, stopOption: '2.50', target: '', targetOption: '' });
    await page.getByRole('button', { name: 'Confirm Plan' }).click();

    // The summary takes focus; W4 sits beside the option-price Stop and W3 beside the Underlying Target.
    const summary = page.getByRole('region', { name: 'This Plan can’t be confirmed yet' });
    await expect(summary).toBeFocused();
    const stopOption = page.getByLabel(stopOptionLabel(OC2), { exact: true });
    const target = page.getByLabel(UNDERLYING_TARGET);
    const W4 = 'The option-price Stop must be below the intended entry price to calculate Risk properly.';
    const W3 = 'Enter a Target on XYZ, an option price, or both.';
    await expect(summary).toContainText(W4);
    await expect(summary).toContainText(W3);
    await expect(stopOption).toHaveAttribute('aria-invalid', 'true');
    await expect(stopOption).toHaveAccessibleDescription(new RegExp(W4.replace(/[.]/g, '\\.')));
    await expect(target).toHaveAttribute('aria-invalid', 'true');
    await expect(target).toHaveAccessibleDescription(new RegExp(W3.replace(/[.]/g, '\\.')));

    // The values are kept.
    await expect(page.getByLabel(UNDERLYING_STOP)).toHaveValue('48.00');
    await expect(stopOption).toHaveValue('2.50');
    await expect(target).toHaveValue('');
    await expect(page.getByLabel(targetOptionLabel(OC2), { exact: true })).toHaveValue('');
    await expect(page.getByLabel('Strike')).toHaveValue('55');
    await expect(page.getByLabel('Expiration date')).toHaveValue('2026-12-18');

    // Nothing is saved: after a reload there is no Trade in the Workspace.
    await page.reload();
    await expect(page.getByRole('heading', { name: 'New Plan' })).toBeVisible();
    await page.goto('/');
    await expect(page.getByText('No open trades. Recording an entry on a Planned Trade opens it.')).toBeVisible();
    expect(tradesOf(workspaceOf(await probe(page))!)).toEqual([]);
    await context.close();
  });
});
