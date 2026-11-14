import { confirmOptionPlan, currentTradeId, detail, enterMark, expect, firstPage, launchAt, MONDAY, MONDAY_1700, OC, onboardedAt, openDrawer, openReview, optionMarkRow, recordOptionEntry, saveMarkPrice, savedOptionMarkRow, test, TUESDAY, TUESDAY_1700 } from '../d7/support.ts';
import { expectNoSidewaysScroll, setWidth } from '../d7p/support.ts';

test.use({ actionTimeout: 15_000 });

const CALL = 'XYZ 20 Nov 2026 55 Call';

// T8P.23-B14 (W8): at 375 and 320 px the comparison's current column and its Change lie inside the scroll box at load.
test.describe('T8P.23-B14 the Today comparison at narrow widths', () => {
  test('should show the current date column and the Change column inside the comparison scroll box at 375 and 320 px, with no sideways page scroll', async ({ profile }) => {
    test.setTimeout(300_000);
    const { context: setup, page: setupPage } = await onboardedAt(profile, MONDAY_1700);
    await confirmOptionPlan(setupPage, { ...OC, planTime: '2026-10-12T09:00' });
    const oc = { symbol: 'XYZ', tradeId: await currentTradeId(setupPage) };
    await recordOptionEntry(setupPage, [{ quantity: '2', price: '2.00', fee: '1.30', time: '2026-10-12T10:00' }]);
    await openReview(setupPage);
    await saveMarkPrice(setupPage, oc, await optionMarkRow(setupPage, oc, CALL, MONDAY), '2.50');
    await savedOptionMarkRow(setupPage, oc, CALL, MONDAY);
    await enterMark(setupPage, oc, MONDAY, '56.00');
    await setup.close();

    const context = await launchAt(profile, TUESDAY_1700);
    const page = await firstPage(context);
    await page.goto('/');
    await openReview(page);
    await saveMarkPrice(page, oc, await optionMarkRow(page, oc, CALL, TUESDAY), '2.80');
    await savedOptionMarkRow(page, oc, CALL, TUESDAY);
    await enterMark(page, oc, TUESDAY, '57.00');
    await page.goto(`/trades/${oc.tradeId}`);
    await expect(detail.heading(page, 'XYZ')).toBeVisible();
    await openDrawer(page, 'Today');
    const region = page.locator('.trade-detail #drawer-panel-today .table-scroll').first();
    await expect(region.locator('thead th')).toHaveCount(3);
    for (const width of [375, 320]) {
      await setWidth(page, width);
      const outside = await region.evaluate((box) => {
        const frame = box.getBoundingClientRect();
        // Columns 3 (current) and 4 (Change): the header and every cell, after the empty label and the earlier column.
        const cells = [...box.querySelectorAll('tr')].flatMap((row) => [...row.children].slice(2));
        return cells
          .filter((cell) => {
            const r = cell.getBoundingClientRect();
            return r.left < frame.left - 0.5 || r.right > frame.right + 0.5;
          })
          .map((cell) => `${cell.textContent} ${Math.round(cell.getBoundingClientRect().right)} > ${Math.round(frame.right)}`);
      });
      expect(outside, `cells outside the scroll box at ${width} px`).toEqual([]);
      await expectNoSidewaysScroll(page, `Today at ${width} px`);
    }
    await context.close();
  });
});
