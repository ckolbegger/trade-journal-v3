import { confirmOptionPlan, currentTradeId, detail, expect, MONDAY_1105, OC, onboardedAt, openDrawer, recordOptionEntry, test } from '../d7/support.ts';

test.use({ actionTimeout: 15_000 });

// T8P.26-B5 (critic-5, defect 1): O-C3's Plan confirmed at Mon Oct 12 09:00, Buy 2 @ 2.00 at 10:00 (fee 1.30) recorded at 11:05, the Detail open
// before any session has ended. Nothing was held at Fri Oct 9's close, so no Mark is due or missing for it: Needs you shows W7's note alone, and the
// Payoff drawer says when the first Marks are due instead of "Mark missing".
test.describe('T8P.26-B5 before the first Marks', () => {
  test('should show only the first-Marks note in Needs you and no Mark missing anywhere on the Detail', async ({ profile }) => {
    test.setTimeout(300_000);
    const { context, page } = await onboardedAt(profile, MONDAY_1105);
    await confirmOptionPlan(page, { ...OC, planTime: '2026-10-12T09:00' });
    const tradeId = await currentTradeId(page);
    await recordOptionEntry(page, [{ quantity: '2', price: '2.00', fee: '1.30', time: '2026-10-12T10:00' }]);
    await page.goto(`/trades/${tradeId}`);
    await expect(detail.heading(page, 'XYZ')).toBeVisible();

    const needs = detail.needsYouCard(page);
    await expect(needs.getByText('First Marks are due once the Mon Oct 12 session ends.', { exact: true })).toBeVisible();
    // Absent from the DOM, the hidden drawer panels included: the link, and the words, on the whole Detail.
    await expect(page.locator('.trade-detail a', { hasText: 'Mark missing' })).toHaveCount(0);
    await expect(page.locator('.trade-detail').getByText(/Mark missing/)).toHaveCount(0);

    await openDrawer(page, 'Payoff');
    await expect(detail.payoffDrawer(page).getByText('First Marks are due once the Mon Oct 12 session ends.', { exact: true })).toBeVisible();
    await expect(page.locator('.trade-detail').getByText(/Mark missing/)).toHaveCount(0);
    await context.close();
  });
});
