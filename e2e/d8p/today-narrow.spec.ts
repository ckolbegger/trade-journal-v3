import type { Locator, Page } from '@playwright/test';
import { confirmOptionPlan, createTradeAt, currentTradeId, detail, enterMark, expect, firstPage, launchAt, MONDAY, MONDAY_1700, OC, onboardedAt, openDrawer, openReview, optionMarkRow, PLAN, recordOptionEntry, saveMarkPrice, savedOptionMarkRow, test, TUESDAY, TUESDAY_1700 } from '../d7/support.ts';
import { expectNoSidewaysScroll, setWidth } from '../d7p/support.ts';

test.use({ actionTimeout: 15_000 });

const CALL = 'XYZ 20 Nov 2026 55 Call';
const WIDTHS = [375, 320] as const;

// T8P.23-B14 and B14-B1 (W8): at 375 and 320 px the comparison's current column and its Change lie inside the scroll box at load, and
// no figure, sign, date or time breaks inside itself (text wraps only at spaces).
async function openTodayComparison(page: Page, tradeId: string): Promise<Locator> {
  await page.goto(`/trades/${tradeId}`);
  await expect(detail.heading(page, 'XYZ')).toBeVisible();
  await openDrawer(page, 'Today');
  const region = page.locator('.trade-detail #drawer-panel-today .table-scroll').first();
  await expect(region.locator('thead th')).toHaveCount(3);
  // The layout is settled when the fonts are loaded and the table's width is the same in two frames running.
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  return region;
}

// The cells of the current and Change columns (header and body) that reach outside the scroll box's visible rect.
const cellsOutside = (region: Locator) =>
  region.evaluate((box) => {
    const frame = box.getBoundingClientRect();
    const cells = [...box.querySelectorAll('tr')].flatMap((row) => [...row.children].slice(2));
    return cells
      .filter((cell) => {
        const r = cell.getBoundingClientRect();
        return r.left < frame.left - 0.5 || r.right > frame.right + 0.5;
      })
      .map((cell) => `${cell.textContent} ${Math.round(cell.getBoundingClientRect().right)} > ${Math.round(frame.right)}`);
  });

// T8P.26-B4: the row labels whose left edge lies left of the scroll box's visible left edge (their first glyph is cut).
const labelsClipped = (region: Locator) =>
  region.evaluate((box) => {
    const frame = box.getBoundingClientRect();
    return [...box.querySelectorAll('tbody th')]
      .filter((th) => th.getBoundingClientRect().left < frame.left - 0.5)
      .map((th) => `${th.textContent} ${Math.round(th.getBoundingClientRect().left)} < ${Math.round(frame.left)}`);
  });

// Every space-separated token of every cell, header and body, that sits on more than one line.
const brokenTokens = (region: Locator) =>
  region.evaluate((box) => {
    const broken: string[] = [];
    for (const cell of box.querySelectorAll('th, td')) {
      const walker = document.createTreeWalker(cell, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const text = node.textContent ?? '';
        for (const match of text.matchAll(/\S+/g)) {
          const range = document.createRange();
          range.setStart(node, match.index);
          range.setEnd(node, match.index + match[0].length);
          const tops = new Set([...range.getClientRects()].map((rect) => Math.round(rect.top)));
          if (tops.size > 1) broken.push(match[0]);
        }
      }
    }
    return broken;
  });

async function expectFitsWhole(page: Page, region: Locator): Promise<void> {
  for (const width of WIDTHS) {
    await setWidth(page, width);
    // Polled: a real overflow or split stays, a reflow still under way does not.
    await expect.poll(() => cellsOutside(region), { message: `cells outside the scroll box at ${width} px` }).toEqual([]);
    await expect.poll(() => labelsClipped(region), { message: `row labels cut at the scroll box's left edge at ${width} px` }).toEqual([]);
    await expect.poll(() => brokenTokens(region), { message: `tokens broken across lines at ${width} px` }).toEqual([]);
    await expectNoSidewaysScroll(page, `Today at ${width} px`);
  }
}

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
    await saveMarkPrice(page, oc, await optionMarkRow(page, oc, CALL, TUESDAY), '8.00');
    await savedOptionMarkRow(page, oc, CALL, TUESDAY);
    await enterMark(page, oc, TUESDAY, '57.00');
    const region = await openTodayComparison(page, oc.tradeId);
    // The Change column carries Mark changes (the table has no P&L row), here the widest option change, +$5.50.
    await expect(region).toContainText('+$5.50');
    await expectFitsWhole(page, region);
    await context.close();
  });

  test('should keep a three-digit stock Mark, a negative change and the provenance date and time whole at 375 and 320 px', async ({ profile }) => {
    test.setTimeout(300_000);
    const { context: setup, page: setupPage } = await onboardedAt(profile, MONDAY_1700);
    const xyz = { symbol: 'XYZ', tradeId: await createTradeAt(setupPage, { ...PLAN, symbol: 'XYZ', quantity: '100', entry: '400', stop: '380', target: '450' }, '2026-10-12T09:30', [['100', '400.00', '2026-10-12T10:00']]) };
    await openReview(setupPage);
    await enterMark(setupPage, xyz, MONDAY, '418.60');
    await setup.close();

    const context = await launchAt(profile, TUESDAY_1700);
    const page = await firstPage(context);
    await page.goto('/');
    await openReview(page);
    await enterMark(page, xyz, TUESDAY, '412.35');
    const region = await openTodayComparison(page, xyz.tradeId);
    await expect(region).toContainText('$412.35');
    await expect(region).toContainText('−$6.25');
    await expectFitsWhole(page, region);
    await context.close();
  });
});
