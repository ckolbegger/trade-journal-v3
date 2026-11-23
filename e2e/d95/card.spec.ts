import type { Locator } from '@playwright/test';
import { expectNoSidewaysScroll, setWidth } from '../d7p/support.ts';
import { createTrades, expect, FOUR_TRADES, MONDAY_1700, onboardedAt, openReview, test } from '../d4/support.ts';

const boxOf = async (locator: Locator) => (await locator.boundingBox())!;

test.describe('B95.4 The card', () => {
  test('should wrap a long unbroken Thesis inside the Plan box at 375 wide with no sideways scroll', async ({ profile }) => {
    test.setTimeout(300_000);
    const { context, page } = await onboardedAt(profile, MONDAY_1700);
    const long = 'Unbroken'.repeat(14);
    await createTrades(page, [{ ...FOUR_TRADES[1]!, plan: { ...FOUR_TRADES[1]!.plan, thesis: long } }]);
    await openReview(page);
    const plan = page.getByRole('region', { name: 'Plan' });
    await setWidth(page, 375);
    await expect(plan.getByText(long, { exact: true })).toBeVisible();
    await expectNoSidewaysScroll(page, 'Review card Plan box with a long Thesis at 375 px');
    await context.close();
  });

  test('should wrap Entry, Stop and Target to two lines at 375 wide and keep every value', async ({ profile }) => {
    test.setTimeout(300_000);
    const { context, page } = await onboardedAt(profile, MONDAY_1700);
    // ABC: 100 shares at $30.00, a Stop at $28.00 and a Target at $36.00. Its card is the one open on load.
    await createTrades(page, [FOUR_TRADES[1]!]);
    await openReview(page);
    const plan = page.getByRole('region', { name: 'Plan' });
    await expect(plan).toBeVisible();
    const values = { Entry: '100 shares at $30.00', Stop: 'ABC at or below $28.00', Target: 'ABC at or above $36.00', Risk: '$200.00 (1R)', Reward: '$600.00' };
    const row = (term: string) => plan.locator('dl > div').filter({ has: page.getByText(term, { exact: true }) });

    for (const width of [1280, 375]) {
      await setWidth(page, width);
      // The same values at both widths, each whole inside the viewport.
      for (const [term, text] of Object.entries(values)) {
        const value = row(term).locator('dd strong');
        await expect(value, `${term} at ${width}`).toHaveText(text);
        const box = await boxOf(value);
        expect(box.x + box.width, `${term} inside ${width} px`).toBeLessThanOrEqual(width);
      }
    }
    // At 375 the label sits over its value for Entry, Stop and Target.
    for (const term of ['Entry', 'Stop', 'Target']) {
      const [label, value] = [await boxOf(row(term).locator('dt')), await boxOf(row(term).locator('dd'))];
      expect(value.y, `${term}: the value on a second line`).toBeGreaterThanOrEqual(label.y + label.height - 1);
    }
    await expectNoSidewaysScroll(page, 'Review card Plan box at 375 px');
    await context.close();
  });
});
