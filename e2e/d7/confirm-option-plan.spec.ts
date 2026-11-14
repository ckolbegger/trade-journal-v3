import { detail, expect, fillOptionPlan, MONDAY_0900, OC, onboardedAt, openDrawer, test } from './support.ts';

test.use({ actionTimeout: 15_000 });

test.describe('T7.31-F1 confirming an option Plan', () => {
  test('should render the confirmed option Plan Detail with its Planned payoff and 1R straight after Confirm Plan, with no page error', async ({ server, profile }) => {
    // The suite's default is the checked-out build (dist-releases/current); this case measures the current source.
    server.use('dist-faults');
    const { context, page } = await onboardedAt(profile, MONDAY_0900);
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await fillOptionPlan(page, OC);
    await page.getByRole('button', { name: 'Confirm Plan' }).click();
    await expect(detail.heading(page, 'XYZ')).toBeVisible();
    await openDrawer(page, 'Plan and Risk');
    await expect(detail.oneR(page)).toHaveText('$400.00');
    await openDrawer(page, 'Payoff');
    await expect(detail.payoff(page, 'Planned')).toContainText('Breakeven 57.00');
    expect(errors).toEqual([]);
    await context.close();
  });
});
