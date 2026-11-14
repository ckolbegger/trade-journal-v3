import { confirmOptionPlan, detail, expect, firstPage, launchAt, MONDAY_0900, OC, onboardedAt, openDrawer, test } from '../d7/support.ts';

test.use({ actionTimeout: 15_000 });

// Monday 2026-10-12 to Friday 2026-12-18.
const EXPIRES_LINE = 'Expires Fri 18 Dec 2026 (67 days)';

test.describe('B8P.3 Expires right after confirm (tech debt item 23)', () => {
  test('should show the Expires line on a just-confirmed option Plan, and again after a reload', async ({ profile }) => {
    test.setTimeout(240_000);
    const { context: first, page } = await onboardedAt(profile, MONDAY_0900);
    await confirmOptionPlan(page, { ...OC, expiration: '2026-12-18' });
    // The handed-over Detail, before any read.
    await expect(detail.identityCard(page).getByText(EXPIRES_LINE, { exact: true })).toBeVisible();
    const url = page.url();
    await first.close();

    const context = await launchAt(profile, MONDAY_0900);
    const reloaded = await firstPage(context);
    await reloaded.goto(url);
    await expect(detail.heading(reloaded, 'XYZ')).toBeVisible();
    await expect(detail.identityCard(reloaded).getByText(EXPIRES_LINE, { exact: true })).toBeVisible();
    await context.close();
  });
});

test.describe('B7 the Planned Journal is the Plan card (W11, T8P.22 revision 96)', () => {
  test('should show the Plan card, "Planned Mon Oct 12, 9:00 am", and no old Plan Reflection region or Journal heading', async ({ profile }) => {
    test.setTimeout(240_000);
    const { context, page } = await onboardedAt(profile, MONDAY_0900);
    await confirmOptionPlan(page, { ...OC, expiration: '2026-12-18' });
    await openDrawer(page, 'Journal');
    const plan = detail.planReflection(page);
    await expect(plan).toBeVisible();
    await expect(plan.getByRole('heading', { name: 'Plan', exact: true })).toBeVisible();
    await expect(plan.getByText(/^Planned Mon Oct 12, /)).toBeVisible();
    await expect(plan.locator('dl.answers dd').first()).toBeVisible();
    // Gone, not hidden: the old region, its heading and the old count heading are not in the DOM, hidden drawer panels included.
    await expect(page.locator('.trade-detail #reflection-heading')).toHaveCount(0);
    await expect(detail.anywhere(() => page.locator('.trade-detail').getByRole('region', { name: 'Plan Reflection', exact: true }))).toHaveCount(0);
    await expect(detail.anywhere(() => page.locator('.trade-detail').getByRole('heading', { name: /^Journal \(/ }))).toHaveCount(0);
    await context.close();
  });
});
