import { expect, fillOptionPlan, MONDAY_0900, OC, onboardedAt, probe, test, tradesOf, workspaceOf } from './support.ts';

test.use({ actionTimeout: 15_000 });

test.describe('B7.5 Plan validation', () => {
  test('should reject a Long Call Stop of 61 above the breakeven and the Target 60 with both errors beside the Stop and focus on the summary, keep the values, and save nothing after a reload', async ({ profile }) => {
    test.setTimeout(120_000);
    const { context, page } = await onboardedAt(profile, MONDAY_0900);
    await fillOptionPlan(page, { ...OC, stop: '61' });
    await page.getByRole('button', { name: 'Confirm Plan' }).click();

    // The summary takes focus and both rejections sit beside the Stop field.
    const summary = page.getByRole('region', { name: 'This Plan can’t be confirmed yet' });
    await expect(summary).toBeFocused();
    await expect(summary).toContainText('The Stop must be below the breakeven, 57.00, so the Plan has a positive risk.');
    await expect(summary).toContainText('The Stop must be below the Target.');
    const stopError = page.locator('#stop-error');
    await expect(stopError).toContainText('The Stop must be below the breakeven, 57.00, so the Plan has a positive risk.');
    await expect(stopError).toContainText('The Stop must be below the Target.');
    await expect(page.getByLabel(/^Stop \((?!option price)/)).toHaveAttribute('aria-invalid', 'true');

    // The values are kept.
    await expect(page.getByLabel(/^Stop \((?!option price)/)).toHaveValue('61');
    await expect(page.getByLabel(/^Target \((?!option price)/)).toHaveValue('60');
    await expect(page.getByLabel('Strike')).toHaveValue('55');
    await expect(page.getByLabel('Expiration date')).toHaveValue('2026-11-20');
    await expect(page.getByLabel('Contracts')).toHaveValue('2');

    // Nothing is saved: after a reload there is no Trade in the Workspace.
    await page.reload();
    await expect(page.getByRole('heading', { name: 'New Plan' })).toBeVisible();
    await page.goto('/');
    await expect(page.getByText('No open trades. Recording an entry on a Planned Trade opens it.')).toBeVisible();
    expect(tradesOf(workspaceOf(await probe(page))!)).toEqual([]);
    await context.close();
  });
});
