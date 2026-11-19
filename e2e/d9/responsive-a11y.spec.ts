import type { Locator, Page } from '@playwright/test';
import { expectNoSidewaysScroll, expectShownInFull } from '../d7p/support.ts';
import {
  BREN, build, cardReplay, chartText, closeOf, expect, expectAccessible, firstPage, headline, hits, launchAt, openDrawer, openReview, pnlChart, priceStrip, reachCard, READY, replay, seek, setViewport,
  slider, sliderValue, test,
} from './support.ts';
import { tradeCard } from '../d8r/support.ts';

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
  // B12: the charts are drawn at their box's width (at its box's own width at every size, not below 200) before the heights are read: a viewport change is redrawn a moment later.
  await expect.poll(() => scope.evaluate((element) => {
    const box = element.querySelector('.replay-plot-frame')!.clientWidth;
    const want = Math.max(box, 200);
    return ['svg.price-strip', 'svg.pnl-chart'].map((selector) => Number(element.querySelector(selector)!.getAttribute('width')) - want);
  }), { message: `${where}: charts drawn at their box's width` }).toEqual([0, 0]);
  const measure = await scope.evaluate((element) => {
    const rect = (selector: string) => element.querySelector(selector)!.getBoundingClientRect();
    const headlineBox = rect('[data-testid="headline"]');
    const price = rect('svg.price-strip');
    const pnl = rect('svg.pnl-chart');
    // The fixed bottom navigation (a bar along the foot, not the wide layout's side column) covers the screen's lowest part.
    const nav = document.querySelector('.shell > .nav');
    const navBox = nav && getComputedStyle(nav).position === 'fixed' ? nav.getBoundingClientRect() : null;
    const covered = navBox && navBox.width >= window.innerWidth * 0.9 ? window.innerHeight - navBox.top : 0;
    return { covered, span: pnl.bottom - headlineBox.top, rights: [headlineBox.right, price.right, pnl.right], lefts: [headlineBox.left, price.left, pnl.left], priceWidth: price.width, pnlWidth: pnl.width };
  });
  expect(measure.span, `${where}: the headline and both charts span ${Math.round(measure.span)} px of ${size.height - measure.covered} (${size.height} less ${Math.round(measure.covered)} under the bottom navigation)`).toBeLessThanOrEqual(size.height - measure.covered);
  for (const right of measure.rights) expect(right, `${where}: right edge`).toBeLessThanOrEqual(size.width + 0.5);
  for (const left of measure.lefts) expect(left, `${where}: left edge`).toBeGreaterThanOrEqual(-0.5);
  expect(measure.priceWidth, `${where}: price chart width`).toBeGreaterThan(150);
  expect(measure.pnlWidth, `${where}: P&L chart width`).toBeGreaterThan(150);
}

// Every readout value is shown in full (not clipped by itself or an ancestor) and lies inside the viewport's width: the document's scrollWidth alone would miss a value clipped by an ancestor.
async function expectReadoutShownInFull(scope: Locator, size: { width: number; height: number }, where: string): Promise<void> {
  const values = scope.locator('.replay-readout-row .replay-value');
  const count = await values.count();
  expect(count, `${where}: readout values`).toBeGreaterThan(0);
  for (let index = 0; index < count; index += 1) {
    const value = values.nth(index);
    const text = ((await value.textContent()) ?? '').replace(/\s+/g, ' ').trim();
    expect(text, `${where}: readout value ${index + 1} has text`).not.toBe('');
    await expectShownInFull(value, text, `${where}: readout value ${index + 1} (${text})`);
    const box = (await value.boundingBox())!;
    expect(box.x, `${where}: readout value ${text} left edge`).toBeGreaterThanOrEqual(-0.5);
    expect(box.x + box.width, `${where}: readout value ${text} right edge`).toBeLessThanOrEqual(size.width + 0.5);
  }
}

// W39 and W41 on a phone: the short chart titles, and the short marker "Sold 2" wherever a sale is named (the "Break-even" and "Sold 2" labels may be dropped on a tight chart).
async function expectPhoneWords(scope: Locator, where: string): Promise<void> {
  const price = await chartText(priceStrip(scope));
  const pnl = await chartText(pnlChart(scope));
  expect(price, `${where}: price title`).toContain('BREN price');
  expect(pnl, `${where}: P&L title`).toContain('Trade P&L');
  expect(price.join('|'), `${where}: no long price title`).not.toContain('one Mark per session');
  expect(pnl.join('|'), `${where}: no long P&L title`).not.toContain('dollars for the whole Position');
  // T9AR.12: the line labels are in the strip under the P&L drawing, in the phone words, and none is on the drawing.
  const strip = (((await scope.locator('.replay-strip-labels').textContent()) ?? '').split(' · '));
  expect(pnl.filter((t) => /^(Sold|Stop|Target|Banked|Risk|Reward)\b/.test(t)), `${where}: no line label on the drawing`).toEqual([]);
  for (const text of strip.filter((t) => /^Sold/.test(t))) expect(text, `${where}: marker`).toBe('Sold 2');
  expect(strip.filter((t) => /^(Risk|Reward)\b/.test(t)).every((t) => /^(Risk|Reward) \$/.test(t)), `${where}: stake tags ${strip.join(' | ')}`).toBe(true);
  expect(strip, `${where}: the Thu 11-12 labels`).toEqual(expect.arrayContaining(['Stop +$316', 'Banked +$478', 'Target +$956', 'Sold 2']));
  // The text is drawn at its real size, not shrunk with a scaled-down drawing: its size on the screen is its font size times the drawing's scale.
  for (const chart of [priceStrip(scope), pnlChart(scope)]) {
    const smallest = await chart.evaluate((svg: SVGSVGElement) => {
      const scale = svg.getBoundingClientRect().width / svg.viewBox.baseVal.width;
      return Math.min(...[...svg.querySelectorAll('text')].map((t) => parseFloat(getComputedStyle(t).fontSize) * scale));
    });
    console.log(`${where}: smallest chart text ${smallest.toFixed(2)} px`);
    expect(smallest, `${where}: smallest chart text`).toBeGreaterThanOrEqual(10);
  }
}

// B6: every figure a chart draws is readable in full: each text's box lies inside its svg's box (a tick's minus sign or a price's last digit is not cut off).
async function expectChartTextInside(scope: Locator, where: string): Promise<void> {
  for (const chart of [priceStrip(scope), pnlChart(scope)]) {
    const outside = await chart.evaluate((svg: SVGSVGElement) => {
      const box = svg.getBoundingClientRect();
      return [...svg.querySelectorAll('text')].flatMap((t) => {
        const r = t.getBoundingClientRect();
        const sideways = r.left < box.left - 0.5 || r.right > box.right + 0.5;
        const vertical = r.top < box.top - 0.5 || r.bottom > box.bottom + 0.5;
        return sideways || vertical
          ? [`${t.textContent} (${r.left.toFixed(1)} to ${r.right.toFixed(1)} of ${box.left.toFixed(1)} to ${box.right.toFixed(1)}; ${r.top.toFixed(1)} to ${r.bottom.toFixed(1)} of ${box.top.toFixed(1)} to ${box.bottom.toFixed(1)})`]
          : [];
      });
    });
    expect(outside, `${where}: chart text outside its chart`).toEqual([]);
  }
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
    await expectReadoutShownInFull(scope(), size, where);
    if (size.width < 460) await expectChartTextInside(scope(), where);
    // T9.19-B8: the phone words and the real-size text (at least 10 px) on the Review card too, not on the Detail alone.
    if (size.width < 460) await expectPhoneWords(scope(), where);
    // The labels no phone chart may lose: the two results at the lines, which a phone lists in the strip under the drawing (T9AR.12) and a wide drawing keeps on the lines.
    const strip = scope().locator('.replay-strip-labels');
    const results = (await strip.count()) > 0 ? ((await strip.textContent()) ?? '').split(' · ') : await chartText(pnlChart(scope()));
    expect(results, where).toEqual(expect.arrayContaining(['Stop +$316', 'Target +$956']));
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
  // 328 over 320). Reported to the main session as a UI defect; T9.18-F2 fixed it and this case now runs.
  test('should fit the Review card replay at 320 px with no sideways scroll', async ({ profile }) => {
    test.setTimeout(420_000);
    const { context, page, trade } = await build(profile, BREN, closeOf('2026-11-16'), 10);
    await page.goto('/');
    await openReview(page);
    await reachCard(page, trade);
    // The card as it opens (Review Date Mon 11-16, the slider at its last session), the headline scrolled to the top: it and both charts clear the bottom navigation.
    await setViewport(page, SIZES[2].width, SIZES[2].height);
    await expect(headline(cardReplay(page, trade))).toHaveText('+$988.00 · 3.05R');
    await headline(cardReplay(page, trade)).evaluate((element) => element.scrollIntoView({ block: 'start' }));
    await expectFitsOneScreen(cardReplay(page, trade), SIZES[2], 'Review card replay at 320 px, Mon 11-16');
    await throughSizes(page, () => cardReplay(page, trade), 'Review card replay', [SIZES[2]]);
    await context.close();
  });

  // T9.19-B7 (AC-UI-002, C9.4): Tabbing through the Review card's replay controls on a phone, none sits under the fixed bottom navigation, where its control and value cannot be seen.
  test('should keep a focused replay control clear of the bottom navigation on a phone', async ({ profile }) => {
    test.setTimeout(240_000);
    const { context, page, trade } = await build(profile, BREN, closeOf('2026-11-16'), 10);
    await page.goto('/');
    await openReview(page);
    await reachCard(page, trade);
    for (const size of SIZES.slice(1)) {
      const where = `Review card replay at ${size.width} px`;
      await setViewport(page, size.width, size.height);
      const scope = cardReplay(page, trade);
      await expect(headline(scope)).toBeVisible();
      await page.evaluate(() => window.scrollTo(0, 0));
      // From the Action panel's header, Tab through every replay control.
      await tradeCard(page, trade).getByRole('button', { name: /^Action/ }).first().focus();
      const seen: string[] = [];
      for (let step = 0; step < 40; step += 1) {
        await page.keyboard.press('Tab');
        const result = await page.evaluate(() => {
          const focused = document.activeElement as HTMLElement;
          const inReplay = !!focused.closest('section.review-card-replay');
          const nav = document.querySelector('.shell > .nav')!.getBoundingClientRect();
          const box = focused.getBoundingClientRect();
          const hidden = box.bottom > nav.top && box.top < nav.bottom && box.right > nav.left && box.left < nav.right;
          return { inReplay, hidden, label: focused.getAttribute('aria-label') ?? focused.textContent?.trim().slice(0, 30) ?? '', top: Math.round(box.top), bottom: Math.round(box.bottom), navTop: Math.round(nav.top) };
        });
        if (!result.inReplay) {
          if (seen.length > 0) break;
          continue;
        }
        seen.push(result.label);
        expect(result.hidden, `${where}: "${result.label}" (y ${result.top} to ${result.bottom}) is under the bottom navigation (top ${result.navTop})`).toBe(false);
      }
      expect(seen.length, `${where}: replay controls reached`).toBeGreaterThan(3);
    }
    await context.close();
  });

  // W39, W40 and W41 name phone words ("BREN price", "Trade P&L", "Risk $672", "Reward $928", "Sold 2"). In a box under 460 px wide (a phone) the charts are drawn at their real width with those words, so
  // their text keeps its size; at the full drawing the long words stay.
  test('should use the phone words in both charts at 375 and 320 px', async ({ profile }) => {
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
