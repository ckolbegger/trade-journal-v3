import {
  confirmOptionPlan, currentTradeId, expect, firstPage, launchAt, MONDAY, MONDAY_1700, OC, onboardedAt, openReview, optionMarkRow, reachCard, recordOptionEntry, saveMarkPrice, savedOptionMarkRow, test, tradeCard, TUESDAY_1700,
} from '../d7/support.ts';
import { expectNoSidewaysScroll, setWidth } from '../d7p/support.ts';

test.use({ actionTimeout: 15_000 });

const CALL = 'XYZ Nov 20 $55 Call';

test.describe('B7SP.11 The option dated line in the Review', () => {
  test('should show O-C bought Monday, in the Tuesday 17:00 Review with the calls Monday Mark only, a Mon Oct 12 close group with its figures at 320 and 1280 px and no sideways scroll', async ({ profile }) => {
    test.setTimeout(300_000);
    // Monday 17:00: O-C is planned and bought, and the call's Monday Mark is saved (XYZ gets none).
    const { context: setup, page: setupPage } = await onboardedAt(profile, MONDAY_1700);
    await confirmOptionPlan(setupPage, { ...OC, planTime: '2026-10-12T09:00' });
    const oc = { symbol: 'XYZ', tradeId: await currentTradeId(setupPage) };
    await recordOptionEntry(setupPage, [{ quantity: '2', price: '2.00', fee: '1.30', time: '2026-10-12T10:00' }]);
    await openReview(setupPage);
    await saveMarkPrice(setupPage, oc, await optionMarkRow(setupPage, oc, CALL, MONDAY), '2.50');
    await savedOptionMarkRow(setupPage, oc, CALL, MONDAY);
    await setup.close();

    // Tuesday 17:00: the card's dated line is Monday's close.
    const context = await launchAt(profile, TUESDAY_1700);
    const page = await firstPage(context);
    await page.goto('/');
    await openReview(page);
    for (const width of [320, 1280]) {
      await setWidth(page, width);
      await reachCard(page, oc);
      const group = tradeCard(page, oc).getByRole('region', { name: 'At the Mon Oct 12 Marks' });
      await expect(group, `${width} px`).toBeVisible();
      await expect(group.locator('dt'), `${width} px figures`).toHaveText(['Worst case', 'Max reward', 'Reward to risk', 'Expiration']);
      // Contract-only figures are values; the Underlying-dependent ones read as unavailable (XYZ has no Monday Mark).
      await expect(group.locator('dd').first(), `${width} px worst case`).toHaveText('$500.00 more · 1.25R');
      await expect(group.locator('dd').nth(2), `${width} px reward to risk`).toHaveText(/^Mark missing: XYZ, Mon Oct 12/);
      await expectNoSidewaysScroll(page, `Review card at ${width} px`);
    }
    await context.close();
  });
});
