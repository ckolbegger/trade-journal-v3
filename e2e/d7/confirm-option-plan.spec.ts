import { expect, fillOptionPlan, MONDAY_0900, OC, onboardedAt, test, valueOf } from './support.ts';

test.use({ actionTimeout: 15_000 });

test.describe('T7.31-F1 confirming an option Plan', () => {
  test('should render the confirmed option Plan Detail with its Planned payoff and 1R straight after Confirm Plan, with no page error', async ({ server, profile }) => {
    // The suite's default is the d6 release; this case measures the current source.
    server.use('dist-faults');
    const { context, page } = await onboardedAt(profile, MONDAY_0900);
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await fillOptionPlan(page, OC);
    await page.getByRole('button', { name: 'Confirm Plan' }).click();
    await expect(page.getByRole('heading', { name: 'XYZ', level: 1 })).toBeVisible();
    await expect(valueOf(page, '1R (original risk)')).toHaveText('$400.00');
    await expect(page.getByRole('region', { name: 'Planned Expiration Payoff' })).toContainText('Breakeven 57.00');
    expect(errors).toEqual([]);
    await context.close();
  });
});
