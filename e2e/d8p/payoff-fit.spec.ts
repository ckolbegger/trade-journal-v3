import type { Page } from '@playwright/test';
import { expectNoSidewaysScroll, setWidth } from '../d7p/support.ts';
import { buildOc3, detail, expect, openDetailAt, openDrawer, test, THURSDAY_1800 } from './support.ts';

test.use({ actionTimeout: 15_000 });

// T8P.26-B1 (W14, A217): at 1280 px the whole Payoff chart, legend included, is in view without scrolling; at 375 and 320 px it keeps scrolling inside its own box.
const geometry = (page: Page) =>
  detail.payoffChart(page).evaluate((svg) => {
    const box = svg.closest('.payoff-chart-scroll')!;
    const frame = box.getBoundingClientRect();
    const now = [...svg.querySelectorAll('text')].find((t) => t.textContent === 'Now')!.getBoundingClientRect();
    const lines = [...svg.querySelectorAll('polyline')].map((p) => p.getBoundingClientRect().right);
    return {
      scrollWidth: box.scrollWidth,
      clientWidth: box.clientWidth,
      nowOutside: now.right > frame.right + 0.5,
      lineOutside: lines.some((right) => right > frame.right + 0.5),
    };
  });

test.describe('T8P.26-B1 the Payoff chart fits its box', () => {
  test('should show the whole Payoff chart, the Now legend and both lines, inside its box at 1280 px, and keep scrolling inside the box at 375 and 320 px', async ({ profile }) => {
    test.setTimeout(300_000);
    const trade = await buildOc3(profile);
    const { context, page } = await openDetailAt(profile, THURSDAY_1800, trade, 1280);
    await openDrawer(page, 'Payoff');
    await page.evaluate(() => document.fonts.ready.then(() => undefined));
    await expect.poll(() => geometry(page), { message: 'chart geometry at 1280 px' }).toMatchObject({ nowOutside: false, lineOutside: false });
    const wide = await geometry(page);
    expect(wide.scrollWidth).toBe(wide.clientWidth);

    for (const width of [375, 320]) {
      await setWidth(page, width);
      await expect.poll(async () => (await geometry(page)).scrollWidth > (await geometry(page)).clientWidth, { message: `chart scrolls in its box at ${width} px` }).toBe(true);
      await expectNoSidewaysScroll(page, `Payoff at ${width} px`);
    }
    await context.close();
  });
});
