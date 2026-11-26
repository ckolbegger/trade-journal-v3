import type { Locator, Page } from '@playwright/test';
import { expectNoSidewaysScroll } from '../d7p/support.ts';
import {
  actionFormOf, AXIO, BREN, buildReview, copyStandardTrade, openStandardDetail, openStandardReviewOf, cardReplayButton, cardRows, chartText, checkForUpdate, closeButton, closeOf, detailReplayButton, expect, expectAccessible, expectChartTextInside, expectFitsOneScreen,
  expectReadoutShownInFull, expectSmallestChartTextAtLeast, expectWideLayoutAtEverySession, CORV, DALE, DALE_HOLD, firstPage, headline, hits, launchAt, launchTouchAt, notice, openCardReplay, openDrawer, openReview, pnlChart, priceStrip, reachCard, LAUNCH, replay, seek,
  SCREENSHOTS, sessionCard, sessionCards, setViewport, slider, sliderValue, smallestChartText, test, type TradeRef,
} from './support.ts';

test.use({ actionTimeout: 15_000 });

// B9AR.7 (plan section 7.2, AC-UI-001, AC-UI-002, AC-DEL-001, AC-JOUR-001): the overlay from Trade Detail and from the Review card at 1280, 1440 and 1920 by 800 and at 375 and 320 by 667. At each size the header,
// the headline and both charts fit one screen, nothing scrolls sideways, axe finds no WCAG 2.1 A or AA violation, and the slider's session survives the resize; on a phone the overlay covers the bottom navigation, the
// labels are in the strip, the smallest chart text is at least 10 pixels and none is cut. Tab never leaves the overlay; a tap moves the slider and leaves no hover box; the overlay reads offline; after a resize across
// the breakpoint, Close shows the page in the new width's layout and a started Action is still there; a phone's controls are at least 44 pixels high; a staged update's notice is unchanged by opening and closing.
const SIZES = [
  { width: 1280, height: 800 },
  { width: 1440, height: 800 },
  { width: 1920, height: 800 },
  { width: 375, height: 667 },
  { width: 320, height: 667 },
] as const;
type Size = (typeof SIZES)[number];
const WIDE = SIZES.slice(0, 3);
// R-DALE-U's Marks with no Expiration recorded (a Review's builder records partial sales only).
const DALE_R_U = { ...DALE, changes: [] };
const INTENT ='The Target is reached; take the profit.';

// W69: the drawing's labels as one line of text under the P&L chart, and none of them on the drawing.
async function expectPhoneLabels(scope: Locator, where: string): Promise<void> {
  const drawn = await chartText(pnlChart(scope));
  expect(drawn.filter((t) => /^(Sold|Stop|Target|Realized|Risk|Reward)\b/.test(t)), `${where}: no line label on the drawing`).toEqual([]);
  // The strip lists every label the drawing left out, so it holds at least the four W69 names for Thu 11-12.
  const strip = ((await scope.locator('.replay-strip-labels').textContent()) ?? '').split(' · ');
  expect(strip, `${where}: the strip`).toEqual(expect.arrayContaining(['Stop +$316', 'Realized +$478', 'Target +$956', 'Sold 2']));
  // W39, W40 and W41 (moved here from the removed d9 responsive case, TD.3): the short chart titles and no long ones, "Sold 2" wherever a sale is named, and the stake tags start with "$".
  const price = await chartText(priceStrip(scope));
  expect(price, `${where}: price title`).toContain('BREN price');
  expect(drawn, `${where}: P&L title`).toContain('Trade P&L');
  expect(price.join('|'), `${where}: no long price title`).not.toContain('one Mark per session');
  expect(drawn.join('|'), `${where}: no long P&L title`).not.toContain('dollars for the whole Position');
  for (const text of strip.filter((t) => /^Sold/.test(t))) expect(text, `${where}: marker`).toBe('Sold 2');
  expect(strip.filter((t) => /^(Risk|Reward)\b/.test(t)).every((t) => /^(Risk|Reward) \$/.test(t)), `${where}: stake tags ${strip.join(' | ')}`).toBe(true);
}

// Every match is at least 44 pixels high (the UI contract's touch target).
async function expectTall(locator: Locator, name: string): Promise<void> {
  const count = await locator.count();
  expect(count, `${name}: found`).toBeGreaterThan(0);
  for (let i = 0; i < count; i += 1) expect((await locator.nth(i).boundingBox())!.height, `${name} ${i + 1}`).toBeGreaterThanOrEqual(44);
}

// The bottom navigation, where the page lays one out, lies under the overlay: what is at its centre belongs to the dialog.
async function expectOverlayCoversNavigation(page: Page, where: string): Promise<void> {
  const covered = await page.evaluate(() => {
    const nav = document.querySelector('.shell > .nav');
    if (!nav) return 'no navigation in the page';
    const box = nav.getBoundingClientRect();
    const hit = document.elementFromPoint((box.left + box.right) / 2, (box.top + box.bottom) / 2);
    return hit?.closest('[role=dialog]') ? 'covered' : `the navigation shows at its centre (${hit?.tagName})`;
  });
  expect(covered, `${where}: the overlay covers the navigation`).toBe('covered');
}

// T9.19-B7 (moved here from the removed d9 responsive case, TD.3): Tab from Close through every control of the overlay; nothing covers the centre of the focused control, so it can be seen.
async function expectFocusedControlsUncovered(page: Page, where: string): Promise<void> {
  await closeButton(replay(page)).focus();
  const seen: string[] = [];
  for (let step = 0; step < 40; step += 1) {
    await page.keyboard.press('Tab');
    const result = await page.evaluate(() => {
      const focused = document.activeElement as HTMLElement;
      const box = focused.getBoundingClientRect();
      const covering = document.elementFromPoint((box.left + box.right) / 2, (box.top + box.bottom) / 2);
      return { inside: !!focused.closest('[role=dialog]'), hidden: covering === null || !focused.contains(covering), label: focused.getAttribute('aria-label') ?? focused.textContent?.trim().slice(0, 30) ?? '', top: Math.round(box.top), bottom: Math.round(box.bottom) };
    });
    expect(result.inside, `${where}: Tab left the overlay (on "${result.label}")`).toBe(true);
    seen.push(result.label);
    expect(result.hidden, `${where}: "${result.label}" (y ${result.top} to ${result.bottom}) has something over its centre`).toBe(false);
  }
  expect(new Set(seen).size, `${where}: replay controls reached`).toBeGreaterThan(3);
}

// Whether the page lays its navigation along the foot (the phone's layout) or as a side column.
const navAtFoot = (page: Page): Promise<boolean> =>
  page.evaluate(() => {
    const nav = document.querySelector('.shell > .nav');
    if (!nav) return false;
    const box = nav.getBoundingClientRect();
    return getComputedStyle(nav).position === 'fixed' && box.width >= window.innerWidth * 0.9 && box.top > window.innerHeight / 2;
  });

// One surface through the sizes with the slider moved to Thu 11-12: each size's checks, and back to the first. The overlay stays open throughout.
async function throughSizes(page: Page, surface: string): Promise<void> {
  const scope = replay(page);
  // A318: a Review card's overlay opens on the Trade's first crossing, so every surface starts from the newest session.
  await seek(page, scope, 'End');
  await seek(page, scope, 'ArrowLeft', 2);
  await expect(sliderValue(scope)).toHaveText('Thu Nov 12 · 9 of 11');
  for (const size of [...SIZES, SIZES[0]]) {
    const where = `${surface} at ${size.width} px`;
    await setViewport(page, size.width, size.height);
    await expect(replay(page), `${where}: the overlay survives`).toBeVisible();
    await expect(sliderValue(replay(page)), where).toHaveText('Thu Nov 12 · 9 of 11');
    await expect(slider(replay(page)), where).toHaveValue('8');
    await expect(headline(replay(page)), where).toHaveText('+$982.00 · 3.03R');
    await expect(hits(replay(page)).getByRole('button'), where).toHaveCount(9);
    // At 320 by 667 the height check has its own case below (it is expected to fail until the phone's header, headline and stake sentence are shorter); the widths are checked here.
    await expectFitsOneScreen(replay(page), size, where, size.width !== 320);
    await expectReadoutShownInFull(replay(page), size, where);
    if (size.width < 460) {
      await expectChartTextInside(replay(page), where);
      await expectPhoneLabels(replay(page), where);
      await expectSmallestChartTextAtLeast(replay(page), 10, where);
      await expectOverlayCoversNavigation(page, where);
      await expectFocusedControlsUncovered(page, where);
    } else {
      // The two results stay on the lines of a wide drawing (a phone lists them in the strip, checked in expectPhoneLabels).
      expect(await chartText(pnlChart(replay(page))), `${where}: the results at the lines`).toEqual(expect.arrayContaining(['Stop +$316', 'Target +$956']));
    }
    await expectNoSidewaysScroll(page, where);
    await expectAccessible(page, where);
  }
}

test.describe('B9AR.7 Responsive, touch, accessible and offline', () => {
  test('should fit the Detail overlay on one screen at every size, keeping the session across each resize', async ({ profile, copySetup }) => {
    test.setTimeout(480_000);
    const { context, page } = await openStandardDetail(profile, copySetup, BREN);
    await openDrawer(page, 'Replay');
    await throughSizes(page, 'Detail overlay');
    await context.close();
  });

  test('should fit the Review card’s overlay on one screen at every size, keeping the session across each resize', async ({ profile, copySetup }) => {
    test.setTimeout(480_000);
    const { context, page, trades } = await openStandardReviewOf(profile, copySetup, [BREN]);
    await reachCard(page, trades[0]!);
    await openCardReplay(page, trades[0]!);
    await throughSizes(page, 'Review card overlay');
    await context.close();
  });

  for (const surface of ['Detail', 'Review card'] as const) {
    test(`should fit the ${surface} overlay’s header, headline and both charts on one 320 by 667 screen`, async ({ profile, copySetup }) => {
      test.setTimeout(240_000);
      // T9AR.12 names this outcome: the header, the headline, the stake sentence and a 200 high P&L chart span 708 px of the 667 (reported to the main session).
      if (surface === 'Detail') {
        const { context, page } = await openStandardDetail(profile, copySetup, BREN);
        await setViewport(page, 320, 667);
        await openDrawer(page, 'Replay');
        await page.screenshot({ path: `${SCREENSHOTS}/B9AR.7-detail-320.png` });
        await expectFitsOneScreen(replay(page), SIZES[4], 'Detail overlay at 320 px');
        await context.close();
      } else {
        const { context, page, trades } = await openStandardReviewOf(profile, copySetup, [BREN]);
        await setViewport(page, 320, 667);
        await reachCard(page, trades[0]!);
        await openCardReplay(page, trades[0]!);
        await expectFitsOneScreen(replay(page), SIZES[4], 'Review card overlay at 320 px');
        await context.close();
      }
    });
  }

  test('should draw the P&L chart at least 800 wide at 1280 and wider at 1440 and 1920, with its text the same size at each', async ({ profile, copySetup }) => {
    test.setTimeout(240_000);
    const { context, page } = await openStandardDetail(profile, copySetup, BREN);
    await openDrawer(page, 'Replay');
    const widths: number[] = [];
    const texts: number[] = [];
    for (const size of WIDE) {
      await setViewport(page, size.width, size.height);
      await expectFitsOneScreen(replay(page), size, `${size.width} px`);
      widths.push((await pnlChart(replay(page)).boundingBox())!.width);
      texts.push(await smallestChartText(pnlChart(replay(page))));
    }
    expect(widths[0], `the chart at 1280 is ${widths[0]}`).toBeGreaterThanOrEqual(800);
    expect(widths[1], `the chart at 1440 (${widths[1]}) is wider than at 1280 (${widths[0]})`).toBeGreaterThan(widths[0]!);
    expect(widths[2], `the chart at 1920 (${widths[2]}) is wider than at 1440 (${widths[1]})`).toBeGreaterThan(widths[1]!);
    expect(texts[1], 'the text at 1440 is the size it is at 1280').toBeCloseTo(texts[0]!, 1);
    expect(texts[2], 'the text at 1920 is the size it is at 1280').toBeCloseTo(texts[0]!, 1);
    await context.close();
  });

  // merge6-S1: the readout column is one fixed width, so at 1280 the P&L chart keeps 800 px and nothing moves as the slider steps, on every Trade's every session. One Review launch holds R-BREN-U, R-AXIO-D,
  // R-CORV-D and R-DALE-D held; R-DALE-U is DALE too (a Review's Marks panel is found by symbol), so it has its own launch.
  for (const [group, fixtures] of [['R-BREN-U, R-AXIO-D, R-CORV-D and R-DALE-D', [BREN, AXIO, CORV, DALE_HOLD]], ['R-DALE-U', [DALE_R_U]]] as const) {
    test(`should keep the P&L chart 800 wide and still, and each stake grid inside the readout, at every session of ${group} at 1280`, async ({ profile, copySetup }) => {
      test.setTimeout(480_000);
      // The four-Trade group is the standard Review with CORV added on top; R-DALE-U cannot share a profile that holds DALE held, so it keeps its own build.
      const review = group === 'R-DALE-U' ? await buildReview(profile, fixtures) : await openStandardReviewOf(profile, copySetup, fixtures);
      await setViewport(review.page, 1280, 800);
      for (const trade of review.trades) {
        await reachCard(review.page, trade);
        await openCardReplay(review.page, trade);
        await expectWideLayoutAtEverySession(review.page, replay(review.page), SIZES[0], 800, `${trade.symbol} in ${group} at 1280`);
        await closeButton(replay(review.page)).click();
        await expect(replay(review.page)).toHaveCount(0);
      }
      await review.context.close();
    });
  }

  test('should keep Tab inside the overlay, from either end, at 1280 and on a phone', async ({ profile, copySetup }) => {
    test.setTimeout(240_000);
    const { context, page } = await openStandardDetail(profile, copySetup, BREN);
    for (const size of [SIZES[0], SIZES[3]] as readonly Size[]) {
      await setViewport(page, size.width, size.height);
      await openDrawer(page, 'Replay');
      const where = `${size.width} px`;
      await expect(closeButton(replay(page))).toBeFocused();
      const seen = new Set<string>();
      for (const key of ['Tab', 'Shift+Tab'] as const) {
        for (let step = 0; step < 70; step += 1) {
          await page.keyboard.press(key);
          const state = await page.evaluate(() => {
            const el = document.activeElement as HTMLElement;
            return { inside: !!el.closest('[role=dialog]'), label: el.getAttribute('aria-label') ?? el.textContent?.trim().slice(0, 30) ?? '' };
          });
          expect(state.inside, `${where}: ${key} step ${step + 1} left the overlay (on "${state.label}")`).toBe(true);
          seen.add(state.label);
        }
      }
      expect(seen.size, `${where}: controls reached`).toBeGreaterThan(5);
      await page.keyboard.press('Escape');
      await expect(replay(page)).toHaveCount(0);
      await expect(detailReplayButton(page)).toBeFocused();
    }
    await context.close();
  });

  test('should show the page in the new width’s layout after Close, with a started Action still there', async ({ profile, copySetup }) => {
    test.setTimeout(420_000);
    const { context, page, trades } = await openStandardReviewOf(profile, copySetup, [BREN]);
    const bren: TradeRef = trades[0]!;
    await reachCard(page, bren);
    const form = await actionFormOf(page, bren);
    await form.getByRole('radio', { name: 'Exit', exact: true }).check();
    await form.getByLabel(/^Why\?/).fill(INTENT);
    expect(await navAtFoot(page), 'at 1280 the navigation is the side column').toBe(false);
    await openCardReplay(page, bren);
    await setViewport(page, 375, 667);
    await expect(replay(page)).toBeVisible();
    await closeButton(replay(page)).click();
    await expect(replay(page)).toHaveCount(0);
    expect(await navAtFoot(page), 'after Close at 375 the navigation is along the foot').toBe(true);
    await expect(cardReplayButton(page, bren)).toBeFocused();
    const after = await actionFormOf(page, bren);
    await expect(after.getByRole('radio', { name: 'Exit', exact: true })).toBeChecked();
    await expect(after.getByLabel(/^Why\?/)).toHaveValue(INTENT);
    // And back across the breakpoint with the overlay open.
    await openCardReplay(page, bren);
    await setViewport(page, 1280, 800);
    await closeButton(replay(page)).click();
    await expect(replay(page)).toHaveCount(0);
    expect(await navAtFoot(page), 'after Close at 1280 the navigation is the side column again').toBe(false);
    await expect(after.getByLabel(/^Why\?/)).toHaveValue(INTENT);
    await context.close();
  });

  // The UI contract's touch targets on a phone: the Replay buttons, the paging buttons and each card's heading (this case); the overlay's Close button has its own case below.
  test('should make the phone’s Replay buttons, paging buttons and card headings at least 44 pixels high', async ({ profile, copySetup }) => {
    test.setTimeout(420_000);
    const { context, page, trades } = await openStandardReviewOf(profile, copySetup, [BREN]);
    const bren = trades[0]!;
    await setViewport(page, 375, 667);
    await reachCard(page, bren);
    await expectTall(cardReplayButton(page, bren), 'the Review card’s Replay button');
    await openCardReplay(page, bren);
    await expectTall(replay(page).getByRole('button', { name: /^(Newer|Earlier) sessions$/ }), 'the paging buttons');
    await expectTall(sessionCards(replay(page)).locator('h4 button:visible'), 'the card headings');
    await closeButton(replay(page)).click();
    await page.goto(`/trades/${bren.tradeId}`);
    await expect(detailReplayButton(page)).toBeVisible(LAUNCH);
    await expectTall(detailReplayButton(page), 'the Detail’s Replay button');
    await context.close();
  });

  test('should make the overlay’s Close button at least 44 pixels high on a phone', async ({ profile, copySetup }) => {
    test.setTimeout(240_000);
    // Product disagrees with the UI contract's touch targets (reported to the main session): the Close button is 21 px high at 375.
    const { context, page } = await openStandardDetail(profile, copySetup, BREN);
    await setViewport(page, 375, 667);
    await openDrawer(page, 'Replay');
    await page.screenshot({ path: `${SCREENSHOTS}/B9AR.7-phone-close-button.png` });
    await expectTall(closeButton(replay(page)), 'Close');
    await context.close();
  });

  test('should move the slider by a tap on a session and a tap on a card’s heading', async ({ profile, copySetup }) => {
    test.setTimeout(420_000);
    const trade = await copyStandardTrade(copySetup, BREN);
    const context = await launchTouchAt(profile, closeOf('2026-11-16'), 375);
    const page = await firstPage(context);
    await page.goto(`/trades/${trade.tradeId}`);
    await setViewport(page, 375, 667);
    await detailReplayButton(page).tap();
    const scope = replay(page);
    await expect(sliderValue(scope)).toHaveText('Mon Nov 16 · 11 of 11');
    await hits(scope).getByRole('button', { name: 'Wed Nov 11', exact: true }).tap();
    await expect(sliderValue(scope)).toHaveText('Wed Nov 11 · 8 of 11');
    await expect(headline(scope)).toHaveText('+$520.00 · 1.60R');
    // Moved here from the removed "no hover box after a tap" case (TD.3): the tap leaves no hover box and no hover column.
    await page.screenshot({ path: `${SCREENSHOTS}/B9AR.7-tap-hover-box.png` });
    await expect(scope.getByTestId('hover'), 'a tap leaves no hover box').toHaveCount(0);
    await expect(scope.locator('rect.hover-column'), 'a tap leaves no hover column').toHaveCount(0);
    // A tap on the heading of an earlier card (on whichever page it is) moves the slider to it.
    const card = await sessionCard(scope, 'Tue Nov 10');
    await card.getByRole('button', { name: 'Tue Nov 10', exact: true }).tap();
    await expect(sliderValue(scope)).toHaveText('Tue Nov 10 · 7 of 11');
    await expect(cardRows(await sessionCard(scope, 'Tue Nov 10')).first()).toContainText('BREN Mark');
    await context.close();
  });

  // T9AR.24-B5 (critic-1 defect 5): on a phone the tap on the Review card's Replay button must start no hover box or band, and two taps on sessions leave none.
  for (const width of [320]) {
    test(`should show no hover box or band from the Review card's Replay tap and after two taps on sessions at ${width}`, async ({ profile, copySetup }) => {
      test.setTimeout(420_000);
      const trade = await copyStandardTrade(copySetup, BREN);
      const context = await launchTouchAt(profile, closeOf('2026-11-16'), width);
      const page = await firstPage(context);
      await page.goto('/');
      await setViewport(page, width, 667);
      await openReview(page);
      await reachCard(page, trade);
      await cardReplayButton(page, trade).tap();
      const scope = replay(page);
      // A318: BREN is past its Target, first reached on Thu 11-12, so the Replay opens there.
      await expect(sliderValue(scope)).toHaveText('Thu Nov 12 · 9 of 11');
      await expect(scope.getByTestId('hover'), 'no hover box on open').toHaveCount(0);
      await expect(scope.locator('rect.hover-column'), 'no hover band on open').toHaveCount(0);
      await expect(scope.locator('.replay-hit[data-hovered]'), 'no hit marked hovered on open').toHaveCount(0);
      await hits(scope).getByRole('button', { name: 'Thu Nov 12', exact: true }).tap();
      await expect(sliderValue(scope)).toHaveText('Thu Nov 12 · 9 of 11');
      await hits(scope).getByRole('button', { name: 'Wed Nov 11', exact: true }).tap();
      await expect(sliderValue(scope)).toHaveText('Wed Nov 11 · 8 of 11');
      await expect(scope.getByTestId('hover'), 'no hover box after two taps').toHaveCount(0);
      await expect(scope.locator('rect.hover-column'), 'no hover band after two taps').toHaveCount(0);
      await context.close();
    });
  }

  // T9AR.24-B9 (critic-1 defect 9): the Review overlay's Price History link is a touch target, at least 44 pixels high at 375 and at 320.
  for (const width of [375, 320]) {
    test(`should make the Review overlay's Price History link at least 44 pixels high at ${width}`, async ({ profile, copySetup }) => {
      test.setTimeout(420_000);
      const trade = await copyStandardTrade(copySetup, BREN);
      const context = await launchTouchAt(profile, closeOf('2026-11-16'), width);
      const page = await firstPage(context);
      await page.goto('/');
      await setViewport(page, width, 667);
      await openReview(page);
      await reachCard(page, trade);
      await cardReplayButton(page, trade).tap();
      await expect(sliderValue(replay(page))).toHaveText('Thu Nov 12 · 9 of 11');
      await expectTall(replay(page).getByRole('link', { name: 'Price History' }), 'the Review overlay’s Price History link');
      await context.close();
    });
  }

  test('should leave the slider’s value uncovered by any chart element for DALE from Trade Detail at 320', async ({ profile, copySetup }) => {
    test.setTimeout(420_000);
    const trade = await copyStandardTrade(copySetup, DALE_HOLD);
    const context = await launchTouchAt(profile, closeOf('2026-11-16'), 320);
    const page = await firstPage(context);
    await page.goto(`/trades/${trade.tradeId}`);
    await setViewport(page, 320, 667);
    await detailReplayButton(page).tap();
    const scope = replay(page);
    await expect(sliderValue(scope)).toBeVisible();
    await expect(scope.locator('rect.hover-column'), 'no hover band').toHaveCount(0);
    await expect(scope.getByTestId('hover'), 'no hover box').toHaveCount(0);
    const value = (await sliderValue(scope).boundingBox())!;
    const covered = await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.className?.toString() ?? '', { x: value.x + value.width / 2, y: value.y + value.height / 2 });
    expect(covered, 'what is at the slider value’s centre').not.toMatch(/hover|replay-hit|replay-plot/);
    await context.close();
  });

  test('should read the overlay offline after a cold restart with the server stopped (AC-DEL-001)', async ({ server, profile, copySetup }) => {
    test.setTimeout(420_000);
    const trade = await copyStandardTrade(copySetup, BREN);
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
    await expect(pnlChart(scope).locator('path.banked-band')).toHaveCount(1, LAUNCH);
    await expect(priceStrip(scope)).toBeVisible();
    await offline.close();
  });

  test('should leave a staged update’s notice in place and unchanged when the overlay is opened and closed', async ({ server, profile, copySetup }) => {
    test.setTimeout(420_000);
    const { context, page } = await openStandardDetail(profile, copySetup, BREN);
    server.use('dist-releases/v2');
    expect(await checkForUpdate(page)).toEqual({ waiting: 'installed' });
    await expect(notice(page)).toContainText('An update is ready', LAUNCH);
    const before = await notice(page).evaluate((el) => el.outerHTML);
    await openDrawer(page, 'Replay');
    // Under the overlay, not dismissed: still in the page, though the page behind is inert.
    await expect(notice(page)).toHaveCount(1);
    await closeButton(replay(page)).click();
    await expect(replay(page)).toHaveCount(0);
    await expect(notice(page)).toBeVisible();
    await expect(notice(page)).toContainText('An update is ready');
    expect(await notice(page).evaluate((el) => el.outerHTML), 'the notice is unchanged').toBe(before);
    expect(await notice(page).evaluate((el) => !el.closest('[inert]')), 'the notice is usable again').toBe(true);
    await context.close();
  });
});
