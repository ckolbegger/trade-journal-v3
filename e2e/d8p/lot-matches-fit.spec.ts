import type { Locator, Page } from '@playwright/test';
import { expectNoSidewaysScroll, setWidth } from '../d7p/support.ts';
import { buildOc3, closeTheTrade, createTrades, detail, expect, FOUR_TRADES, fillRows, firstPage, launchAt, MONDAY_1700, onboardedAt, openDrawer, openExitForm, READY, sell, test, THURSDAY_1800 } from './support.ts';

test.use({ actionTimeout: 15_000 });

// T8P.26-B2 (T8P.17, T8P.31, C8P.2, C8P.5): at 1280 px every Lot Matches column, Realized included, is in view without scrolling; at 375 and 320 px the table
// may scroll inside its own box, with no sideways page scroll.
const lotMatchesBox = (page: Page): Locator => page.locator('#drawer-panel-position').getByRole('region', { name: 'Matched lots' });

const geometry = (box: Locator) =>
  box.evaluate((el) => {
    const frame = el.getBoundingClientRect();
    const realized = [...el.querySelectorAll('tr')].map((row) => row.lastElementChild!.getBoundingClientRect());
    return {
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
      outside: realized.filter((r) => r.right > frame.right + 0.5 || r.left < frame.left - 0.5).length,
      cells: realized.length,
    };
  });

async function expectFitsAt1280(page: Page, realized: string): Promise<void> {
  await openDrawer(page, 'Position');
  const box = lotMatchesBox(page);
  await expect(box.getByRole('cell', { name: realized })).toBeVisible();
  await setWidth(page, 1280);
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  await expect.poll(async () => (await geometry(box)).scrollWidth - (await geometry(box)).clientWidth, { message: 'Lot Matches overflows its box at 1280 px' }).toBeLessThanOrEqual(0);
  await expect.poll(async () => (await geometry(box)).outside, { message: 'Realized cells outside the box at 1280 px' }).toBe(0);
  await expectNoSidewaysScroll(page, 'Position at 1280 px');
  for (const width of [375, 320] as const) {
    await setWidth(page, width);
    await expectNoSidewaysScroll(page, `Position at ${width} px`);
    await expect(box.getByRole('cell', { name: realized })).toHaveCount(1);
  }
}

test.describe('T8P.26-B2 the Lot Matches fit in the Position drawer', () => {
  test('should show every Lot Matches column in view at 1280 px on DEF Closed by sale, with the table scrolling inside its box at 375 and 320 px', async ({ profile }) => {
    test.setTimeout(420_000);
    const { context: setup, page: setupPage } = await onboardedAt(profile, MONDAY_1700);
    const [, , def] = await createTrades(setupPage, FOUR_TRADES);
    await setupPage.goto(`/trades/${def}`);
    await openExitForm(setupPage);
    await fillRows(setupPage, [sell('100', '44.00', '1.00', '2026-10-12T15:00')]);
    await closeTheTrade(setupPage, 'now');
    await setupPage.getByRole('button', { name: 'Save exit' }).click();
    await expect(setupPage.getByRole('heading', { name: 'Exit recorded', level: 1 })).toBeVisible(READY);
    await setup.close();

    const context = await launchAt(profile, MONDAY_1700, { width: 1280 });
    const page = await firstPage(context);
    await page.goto(`/trades/${def}`);
    await expect(detail.heading(page, 'DEF')).toBeVisible(READY);
    await expectFitsAt1280(page, '+$398.00');
    await context.close();
  });

  test('should show every Lot Matches column in view at 1280 px on O-C3, with the table scrolling inside its box at 375 and 320 px', async ({ profile }) => {
    test.setTimeout(600_000);
    const trade = await buildOc3(profile);
    const context = await launchAt(profile, THURSDAY_1800, { width: 1280 });
    const page = await firstPage(context);
    await page.goto(`/trades/${trade.tradeId}`);
    await expect(detail.heading(page, trade.symbol)).toBeVisible(READY);
    await expectFitsAt1280(page, '+$98.70');
    await context.close();
  });
});
