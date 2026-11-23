import type { Locator } from '@playwright/test';
import { expectNoSidewaysScroll, setWidth } from '../d7p/support.ts';
import { backToTrade, createTrades, detail, enterMark, expect, fillRows, FOUR_TRADES, MONDAY_1700, onboardedAt, openReview, test } from '../d4/support.ts';

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

  test('should draw the Now box with its labels, arrows and captions whole inside the viewport at 1280, 375 and 320 wide', async ({ profile }) => {
    test.setTimeout(300_000);
    const { context, page } = await onboardedAt(profile, MONDAY_1700);
    // ABC: 100 shares at $30.00, a Stop at $28.00 and a Target at $36.00; a Mark of $29.00 puts it inside its lines, at -$101.00 with the fee.
    await createTrades(page, [FOUR_TRADES[1]!]);
    await openReview(page);
    await enterMark(page, 'ABC', 'Mon Oct 12', '29.00');
    const now = page.getByRole('region', { name: 'Now · Mon Oct 12' });
    await expect(now).toBeVisible();
    await expect(now.locator('.now-marks')).toContainText('ABC $29.00');

    for (const width of [1280, 375, 320]) {
      await setWidth(page, width);
      const drawing = now.locator('.now-draw').getByRole('img');
      await expect(drawing, `the drawing at ${width}`).toHaveAccessibleName(/^P&L −\$101\.00, \d+% of the way to the Stop\./);
      // A red arrow to the Stop, running left, and a green one to the Target, running right, each captioned.
      await expect(now.locator('[data-arrow="stop"]')).toHaveAttribute('data-direction', 'left');
      await expect(now.locator('[data-arrow="target"]')).toHaveAttribute('data-direction', 'right');
      await expect(now.locator('[data-caption="stop"]')).toHaveText(/^−\$1\.00 to Stop \(lose another −\$\d[\d,.]*\)$/);
      await expect(now.locator('[data-caption="target"]')).toHaveText(/^\+\$7\.00 to Target \(gain \$\d[\d,.]*\)$/);
      // Every piece of the drawing is whole inside the viewport, and the two labels do not run into each other.
      for (const piece of ['.now-label[data-line="stop"]', '.now-label[data-line="target"]', '[data-caption="stop"]', '[data-caption="target"]', '.now-draw .meter']) {
        const box = await boxOf(now.locator(piece));
        expect(box.x, `${piece} left edge at ${width}`).toBeGreaterThanOrEqual(-0.5);
        expect(box.x + box.width, `${piece} right edge at ${width}`).toBeLessThanOrEqual(width + 0.5);
      }
      const [stop, target] = [await boxOf(now.locator('.now-label[data-line="stop"]')), await boxOf(now.locator('.now-label[data-line="target"]'))];
      expect(stop.x + stop.width, `the Stop and Target labels apart at ${width}`).toBeLessThanOrEqual(target.x);
      await expectNoSidewaysScroll(page, `Review card Now box at ${width} px`);    }
    await context.close();
  });

  test('should keep the Stop and Target labels apart when the two lines sit close on the meter at 1280 and 375 wide', async ({ profile }) => {
    test.setTimeout(300_000);
    const { context, page } = await onboardedAt(profile, MONDAY_1700);
    // ABC: 100 shares at $30.00, a Stop at $28.00 and a Target at $36.00. Selling 90 at $40.00 banks about $900, so the results at the Stop and at
    // the Target are both about $900 above break-even and the meter's track (which always holds $0) puts them within a tenth of its length.
    await createTrades(page, [FOUR_TRADES[1]!]);
    await backToTrade(page, 'ABC');
    await detail.recordExitLink(page).click();
    await expect(page.getByRole('heading', { name: 'Record exit', level: 1 })).toBeVisible();
    await fillRows(page, [{ quantity: '90', price: '40.00', fee: '1.00', time: '2026-10-12T11:00' }]);
    await page.getByRole('region', { name: 'Reflection on this exit' }).getByLabel('Reflect later').check();
    await page.getByRole('button', { name: 'Save exit' }).click();
    await expect(page.getByRole('heading', { name: 'Exit recorded', level: 1 })).toBeVisible();
    await openReview(page);
    await enterMark(page, 'ABC', 'Mon Oct 12', '33.00');
    const now = page.getByRole('region', { name: 'Now · Mon Oct 12' });
    await expect(now.locator('.now-label[data-line="target"]')).toBeVisible();
    for (const width of [1280, 375]) {
      await setWidth(page, width);
      const [stop, target] = [await boxOf(now.locator('.now-label[data-line="stop"]')), await boxOf(now.locator('.now-label[data-line="target"]'))];
      const apart = stop.x + stop.width <= target.x || target.x + target.width <= stop.x || stop.y + stop.height <= target.y || target.y + target.height <= stop.y;
      expect(apart, `the Stop label ${JSON.stringify(stop)} and the Target label ${JSON.stringify(target)} apart at ${width}`).toBe(true);
      for (const box of [stop, target]) {
        expect(box.x, `a label's left edge at ${width}`).toBeGreaterThanOrEqual(-0.5);
        expect(box.x + box.width, `a label's right edge at ${width}`).toBeLessThanOrEqual(width + 0.5);
      }
    }
    await context.close();
  });
});
