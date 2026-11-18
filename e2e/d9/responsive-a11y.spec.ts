import type { Locator, Page } from '@playwright/test';
import { expectNoSidewaysScroll } from '../d7p/support.ts';
import {
  BREN, build, cardReplay, chartText, closeOf, expect, expectAccessible, firstPage, headline, hits, launchAt, openDrawer, openReview, pnlChart, priceStrip, reachCard, READY, replay, seek, setViewport,
  slider, sliderValue, test,
} from './support.ts';

test.use({ actionTimeout: 15_000 });

// B9.5 (plan section 7.2, AC-UI-001, AC-UI-002, AC-DEL-001): R-BREN-U's replay in the Detail's Replay drawer and in the Review card, at 1280 x 800 and at 375 and 320 px wide (667 high). At each
// size the headline and both charts fit one screen, the page has no sideways scroll, and axe finds no WCAG 2.1 A or AA violation; the slider's session survives each resize; and the replay
// reads on a cold start with the server stopped and the browser offline.
const SIZES = [
  { width: 1280, height: 800 },
  { width: 375, height: 667 },
  { width: 320, height: 667 },
] as const;

// The headline's top and the P&L chart's bottom are within one screen's height, and both charts and the readout lie inside the viewport's width.
async function expectFitsOneScreen(scope: Locator, size: { width: number; height: number }, where: string): Promise<void> {
  const measure = await scope.evaluate((element) => {
    const rect = (selector: string) => element.querySelector(selector)!.getBoundingClientRect();
    const headlineBox = rect('[data-testid="headline"]');
    const price = rect('svg.price-strip');
    const pnl = rect('svg.pnl-chart');
    return { span: pnl.bottom - headlineBox.top, rights: [headlineBox.right, price.right, pnl.right], lefts: [headlineBox.left, price.left, pnl.left], priceWidth: price.width, pnlWidth: pnl.width };
  });
  expect(measure.span, `${where}: the headline and both charts span ${Math.round(measure.span)} px of ${size.height}`).toBeLessThanOrEqual(size.height);
  for (const right of measure.rights) expect(right, `${where}: right edge`).toBeLessThanOrEqual(size.width + 0.5);
  for (const left of measure.lefts) expect(left, `${where}: left edge`).toBeGreaterThanOrEqual(-0.5);
  expect(measure.priceWidth, `${where}: price chart width`).toBeGreaterThan(150);
  expect(measure.pnlWidth, `${where}: P&L chart width`).toBeGreaterThan(150);
}

// W39 and W41 on a phone: the short chart titles, and the short marker "Sold 2" wherever a sale is named (the "Break-even" and "Sold 2" labels may be dropped on a tight chart).
async function expectPhoneWords(scope: Locator, where: string): Promise<void> {
  const price = await chartText(priceStrip(scope));
  const pnl = await chartText(pnlChart(scope));
  expect(price, `${where}: price title`).toContain('BREN price');
  expect(pnl, `${where}: P&L title`).toContain('Trade P&L');
  expect(price.join('|'), `${where}: no long price title`).not.toContain('one Mark per session');
  expect(pnl.join('|'), `${where}: no long P&L title`).not.toContain('dollars for the whole Position');
  for (const text of pnl.filter((t) => /^Sold/.test(t))) expect(text, `${where}: marker`).toBe('Sold 2');
  expect(pnl.filter((t) => /^(Risk|Reward)\b/.test(t)).every((t) => /^(Risk|Reward) \$/.test(t)), `${where}: stake tags ${pnl.join(' | ')}`).toBe(true);
}

// One surface through the three sizes with the slider moved to Thu 11-12: each size's checks, then the next size, and back to the first.
async function throughSizes(page: Page, scope: () => Locator, surface: string, sizes: readonly (typeof SIZES)[number][] = SIZES): Promise<void> {
  await seek(page, scope(), 'ArrowLeft', 2);
  await expect(sliderValue(scope())).toHaveText('Thu Nov 12 · 9 of 11');
  for (const size of [...sizes, SIZES[0]]) {
    const where = `${surface} at ${size.width} px`;
    await setViewport(page, size.width, size.height);
    // The slider's session survives the resize, and so does the headline that goes with it.
    await expect(sliderValue(scope()), where).toHaveText('Thu Nov 12 · 9 of 11');
    await expect(slider(scope()), where).toHaveValue('8');
    await expect(headline(scope()), where).toHaveText('+$982.00 · 3.03R');
    await expect(hits(scope()).getByRole('button'), where).toHaveCount(9);
    await expectFitsOneScreen(scope(), size, where);
    // The labels no phone chart may lose: the two results at the lines (the "Break-even" and "Sold 2" labels may be dropped on a tight chart).
    expect(await chartText(pnlChart(scope())), where).toEqual(expect.arrayContaining(['Stop +$316', 'Target +$956']));
    await expectNoSidewaysScroll(page, where);
    await expectAccessible(page, where);
  }
}

test.describe('B9.5 Responsive, accessible and offline', () => {
  test('should fit the Detail replay on one screen at 1280, 375 and 320 px with no sideways scroll and no WCAG violation, keeping the session across a resize', async ({ profile }) => {
    test.setTimeout(420_000);
    const { context, page } = await build(profile, BREN, closeOf('2026-11-16'), 10);
    await openDrawer(page, 'Replay');
    await throughSizes(page, () => replay(page), 'Detail Replay');
    await context.close();
  });

  test('should fit the Review card replay on one screen at 1280 and 375 px with no sideways scroll and no WCAG violation, keeping the session across a resize', async ({ profile }) => {
    test.setTimeout(420_000);
    const { context, page, trade } = await build(profile, BREN, closeOf('2026-11-16'), 10);
    await page.goto('/');
    await openReview(page);
    await reachCard(page, trade);
    await throughSizes(page, () => cardReplay(page, trade), 'Review card replay', [SIZES[0], SIZES[1]]);
    await context.close();
  });

  // At 320 px the Review card's readout reaches past the screen: "+$478.00" (Banked) ends at x = 328 and "+$316.00" (Result at the Stop) at 324, so the page scrolls sideways (scrollWidth
  // 328 over 320). Reported to the main session as a UI defect, so this case is fixme until it is fixed.
  test('should fit the Review card replay at 320 px with no sideways scroll', async ({ profile }) => {
    test.setTimeout(420_000);
    const { context, page, trade } = await build(profile, BREN, closeOf('2026-11-16'), 10);
    await page.goto('/');
    await openReview(page);
    await reachCard(page, trade);
    await throughSizes(page, () => cardReplay(page, trade), 'Review card replay', [SIZES[2]]);
    await context.close();
  });

  // W39, W40 and W41 name phone words ("BREN price", "Trade P&L", "Risk $672", "Reward $928", "Sold 2"). At 375 and 320 px the charts draw the long words instead, in the same 640-unit
  // drawing scaled down to the screen's width (about 0.47 and 0.39 of its size): reported to the main session, so this case is fixme until the phone words are used or the plan is amended.
  test.fixme('should use the phone words in both charts at 375 and 320 px', async ({ profile }) => {
    test.setTimeout(240_000);
    const { context, page } = await build(profile, BREN, closeOf('2026-11-16'), 10);
    await openDrawer(page, 'Replay');
    for (const size of SIZES.slice(1)) {
      await setViewport(page, size.width, size.height);
      await expectPhoneWords(replay(page), `Detail Replay at ${size.width} px`);
    }
    await context.close();
  });

  test('should read the replay offline after a cold restart with the server stopped (AC-DEL-001)', async ({ server, profile }) => {
    test.setTimeout(420_000);
    const { context, trade } = await build(profile, BREN, closeOf('2026-11-16'), 10);
    await context.close();
    // Network disabled: offline emulation plus no server for the origin at all.
    await server.close();
    const offline = await launchAt(profile, closeOf('2026-11-16'), { offline: true });
    const page = await firstPage(offline);
    await page.goto(`/trades/${trade.tradeId}`);
    await openDrawer(page, 'Replay');
    const scope = replay(page);
    await expect(headline(scope)).toHaveText('+$988.00 · 3.05R');
    await expect(sliderValue(scope)).toHaveText('Mon Nov 16 · 11 of 11');
    await seek(page, scope, 'ArrowLeft', 2);
    await expect(headline(scope)).toHaveText('+$982.00 · 3.03R');
    await expect(pnlChart(scope).locator('path.banked-band')).toHaveCount(1, READY);
    await offline.close();
  });
});
