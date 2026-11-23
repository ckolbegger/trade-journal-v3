// Shared support for the D9A-R browser suite (plan section 7.2): D9's helpers (the overlay's opener, the session cards, the stake grid, the Trades built through the UI), and what this
// breakdown adds: DALE-hold on R-DALE-D's Marks, a Review holding three Trades, a touch launch, `expectOneLine`, `expectClearOfCursor` and the carried responsive checks.
import { answerSlipQuestions, marksStepOf, saveMarksButton } from '../d4/support.ts';
import type { BrowserContext, Locator, Page } from '@playwright/test';
import { REPLAY_SESSION_DATES } from '../../src/domain/trade-analysis/reference-trade.ts';
import { R_DALE_D } from '../../src/domain/trade-analysis/option-trade.ts';
import { expectShownInFull } from '../d7p/support.ts';
import {
  AXIO, BREN, closeOf, currentTradeId, DALE, detail, expect, fillOptionPlan, fillOptionRows, fillPlan, fillRows, label, onboardedAt, openExitForm, openReview, pinClock, pnlChart, priceStrip, LAUNCH,
  answerIn, exitReflection, reachPanel, recordEntry, recordOptionEntry, savedUnlessRefused, seek, slider, sliderValue, type Fixture, type Profile, type TradeRef,
} from '../d9/support.ts';

export * from '../d9/support.ts';

// Where the specs write their screenshots: the git-ignored test-results, so a run never rewrites D9A-R's committed evidence/D09AR/screenshots.
export const SCREENSHOTS = 'test-results/d9ar-screenshots';

// R-DALE-D's Marks with the six short held to the end: no buyback on Tue 11-10 (the Stop's line is crossed Thu 11-12 and stays crossed).
export const DALE_HOLD: Fixture = { ...DALE, changes: [], series: R_DALE_D };

// ---- A Review holding several Trades, built in one launch -------------------------------------------------------------------------------------------------

// Plans, enters and Marks one Trade on the page, its Position Changes (partial sales only) recorded before its Marks, ending on the Trade's Detail.
async function enterTrade(page: Page, fixture: Fixture, through: number): Promise<TradeRef> {
  if ('stock' in fixture.plan) {
    await page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'New Plan' }).click();
    await fillPlan(page, fixture.plan.stock);
    await page.getByLabel('Plan time').fill('2026-11-02T09:00');
    await page.getByRole('button', { name: 'Confirm Plan' }).click();
  } else {
    await fillOptionPlan(page, fixture.plan.option);
    if (fixture.plan.stopOption !== undefined) await page.getByLabel(/^Stop \(option price at or/).fill(fixture.plan.stopOption);
    if (fixture.plan.targetOption !== undefined) await page.getByLabel(/^Target \(option price at or/).fill(fixture.plan.targetOption);
    await page.getByRole('button', { name: 'Confirm Plan' }).click();
  }
  await expect(detail.heading(page, fixture.symbol)).toBeVisible();
  const trade: TradeRef = { symbol: fixture.symbol, tradeId: await currentTradeId(page), label: fixture.symbol };
  if ('stock' in fixture.plan) await recordEntry(page, [{ ...fixture.entry, fee: '0.00' }]);
  else await recordOptionEntry(page, [fixture.entry]);
  for (const change of fixture.changes) {
    if (change.kind !== 'sell') throw new Error('enterTrade records partial sales only');
    await page.goto(`/trades/${trade.tradeId}`);
    await expect(detail.heading(page, fixture.symbol)).toBeVisible(LAUNCH);
    await openExitForm(page);
    if ('stock' in fixture.plan) await fillRows(page, [change.row]);
    else await fillOptionRows(page, [change.row]);
    await answerIn(exitReflection(page));
    await page.getByRole('button', { name: 'Save exit' }).click();
    await expect(page.getByRole('heading', { name: 'Exit recorded', level: 1 })).toBeVisible();
  }
  await page.goto('/');
  await openReview(page);
  const panel = await reachPanel(page, trade, 'Marks');
  // The earlier sessions are columns only once asked for.
  const addSkipped = panel.getByRole('button', { name: 'Add the skipped sessions' });
  if ((await addSkipped.count()) > 0) await addSkipped.click();
  let count = 0;
  for (const [i, date] of REPLAY_SESSION_DATES.slice(0, through + 1).entries()) {
    const when = label(date);
    const stock = fixture.series.underlying[i];
    const held = fixture.series.held[i];
    if (stock !== null && stock !== undefined) {
      await panel.getByRole('textbox', { name: `${fixture.symbol} Mark, ${when}`, exact: true }).fill(stock);
      count += 1;
    }
    if (fixture.contract !== undefined && held !== null && held !== undefined) {
      await panel.getByRole('textbox', { name: `${fixture.contract} Mark, ${when}`, exact: true }).fill(held);
      count += 1;
    }
  }
  await answerSlipQuestions(page);
  await panel.getByRole('button', { name: `Save Marks (${count})`, exact: true }).click();
  await savedUnlessRefused('enterTrade', marksStepOf(page), () =>
    expect(saveMarksButton(page)).toHaveText('Save Marks (0)', LAUNCH),
  );
  return trade;
}

// The three-Trade Review of B9AR.2: BREN (R-BREN-U), AXIO (R-AXIO-D) and DALE-hold, each Marked to Mon 11-16 (index 10), on the Review.
export async function buildReview(profile: Profile, fixtures: readonly Fixture[] = [BREN, AXIO, DALE_HOLD], through = 10): Promise<{ context: BrowserContext; page: Page; trades: TradeRef[] }> {
  const { context, page } = await onboardedAt(profile, closeOf(REPLAY_SESSION_DATES[through]!));
  const trades: TradeRef[] = [];
  for (const fixture of fixtures) trades.push(await enterTrade(page, fixture, through));
  await page.goto('/');
  await openReview(page);
  return { context, page, trades };
}

// A touch context (a phone's taps) on the profile at the instant, the clock pinned as `launchAt` pins it.
export async function launchTouchAt(profile: Profile, instant: string, width = 375): Promise<BrowserContext> {
  const context = await profile.launch({ touch: true, width });
  await pinClock(context, instant);
  return context;
}

// ---- The overlay ------------------------------------------------------------------------------------------------------------------------------------------

export const closeButton = (scope: Locator): Locator => scope.getByRole('button', { name: 'Close', exact: true });
export const detailReplayButton = (page: Page): Locator => page.locator('.trade-detail').getByRole('button', { name: 'Replay', exact: true });
// The overlay's dialog box, and the readout's, as rectangles.
export const boxOf = async (locator: Locator): Promise<{ x: number; y: number; width: number; height: number }> => (await locator.boundingBox())!;
export const activeElementDescription = (page: Page): Promise<string> =>
  page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    return el ? `${el.tagName.toLowerCase()}${el.className ? `.${String(el.className).split(' ').join('.')}` : ''} "${(el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 40)}"` : 'none';
  });

// The readout's "Position" group (not "At stake from here, whole Position"): what is held and each Execution or Expiration of the session.
export const positionGroup = (scope: Locator): Locator => scope.locator('.replay-readout-group').filter({ has: scope.page().getByRole('heading', { name: 'Position', exact: true }) });

// ---- Measures ---------------------------------------------------------------------------------------------------------------------------------------------

// An element's text lies in one line box: every rectangle of its text is within one line's height.
export async function expectOneLine(element: Locator, where: string): Promise<void> {
  const measure = await element.evaluate((el) => {
    const range = document.createRange();
    range.selectNodeContents(el);
    const rects = [...range.getClientRects()].filter((r) => r.width > 0 && r.height > 0);
    const font = parseFloat(getComputedStyle(el).fontSize);
    if (rects.length === 0) return { span: 0, line: font, text: el.textContent ?? '' };
    return { span: Math.max(...rects.map((r) => r.bottom)) - Math.min(...rects.map((r) => r.top)), line: font, text: (el.textContent ?? '').replace(/\s+/g, ' ').trim() };
  });
  expect(measure.span, `${where}: "${measure.text}" is ${Math.round(measure.span)} px high on a ${Math.round(measure.line)} px font, so it runs onto a second line`).toBeLessThanOrEqual(measure.line * 1.6);
}

// No level label lies on the cursor's line (A280). What belongs to the cursor stays: the text naming its session, the slider's value, the current Mark's label, the stake tags ("Current Risk $352") and
// the "past" label, which are drawn at the cursor on purpose.
export async function expectClearOfCursor(chart: Locator, where: string): Promise<void> {
  const overlapping = await chart.evaluate((svg: SVGSVGElement) => {
    const cursor = svg.querySelector('path.cursor');
    if (!cursor) return ['no cursor drawn'];
    const c = cursor.getBoundingClientRect();
    return [...svg.querySelectorAll('text')]
      .filter((t) => !/\b(cursor-label|slider-value|mark-label|stake-tag|past-label)\b/.test(t.getAttribute('class') ?? ''))
      .filter((t) => {
        const r = t.getBoundingClientRect();
        return r.right > c.left - 1 && r.left < c.right + 1 && r.bottom > c.top && r.top < c.bottom;
      })
      .map((t) => `${t.textContent} (${t.getAttribute('class')})`);
  });
  expect(overlapping, `${where}: chart text on the cursor`).toEqual([]);
}

// ---- Sweeps over every session of the open overlay (D9AR-retro-1) -------------------------------------------------------------------------------------------

// The loose figure pattern of T9AR.24-B1, -B2 and -B12: a "$", a "%", an R multiple, "to 1" odds, a lone sign at a line's end. Words outside every .card-figure must hold none of these.
export const STRAY = String.raw`\$|%|\dR\b|\d to \d|[−+–]\s*$`;

// Every figure in the whole dialog: each .card-figure is one line box, and no text node outside a .card-figure holds a figure mark. Left out, because they are not figures by design and the charts own their
// checks: the text of the two charts' svgs (axis ticks and labels are drawn, not wrapped), and text that is not shown (no client rectangles). A hit names its region (the nearest of the header, the
// headline, the Plan block, the readout, a session card, or the dialog's other parts) and the words.
export async function brokenFiguresInDialog(scope: Locator): Promise<string[]> {
  return scope.evaluate((dialog, stray) => {
    const region = (el: Element): string => {
      const named = el.closest('h2, [data-testid="headline"], section.replay-plan, .replay-readout, article.replay-session-card');
      if (!named) return 'dialog';
      if (named.tagName === 'H2') return 'header';
      if (named.tagName === 'ARTICLE') return `card ${named.querySelector('h4')?.textContent?.trim() ?? ''}`;
      return named.getAttribute('data-testid') ?? named.className.split(' ')[0]!;
    };
    const broken: string[] = [];
    // The elements the page marks as one figure: .card-figure (Words), the headline's .replay-figure (one line by its CSS) and the stake grid's cells (T9AR.24-B2 measures the same cells).
    const MARKED = '.card-figure, .replay-figure, .replay-stake-grid tr:not(.replay-past-line) td';
    for (const figure of dialog.querySelectorAll(MARKED)) {
      const range = document.createRange();
      range.selectNodeContents(figure);
      const rects = [...range.getClientRects()].filter((r) => r.width > 0 && r.height > 0);
      const font = parseFloat(getComputedStyle(figure).fontSize);
      if (rects.length && Math.max(...rects.map((r) => r.bottom)) - Math.min(...rects.map((r) => r.top)) > font * 1.6) broken.push(`${region(figure)}: broken "${figure.textContent}"`);
    }
    const walker = document.createTreeWalker(dialog, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const parent = n.parentElement as Element;
      if (parent.closest(MARKED) || parent.closest('svg') || parent.closest('.visually-hidden')) continue;
      const range = document.createRange();
      range.selectNodeContents(n);
      if (range.getClientRects().length === 0) continue;
      if (new RegExp(stray).test((n as Text).data)) broken.push(`${region(parent)}: unmarked figure in "${(n as Text).data.trim()}"`);
    }
    return broken;
  }, STRAY);
}

// One chart label drawn over, as found: the chart, the label's class and words, and what is drawn through it.
export type DrawnOver = { chart: 'price strip' | 'P&L chart'; label: string; text: string; over: string };

// The chart texts that are labels: every text with a class (the axis ticks have none), in either chart.
// An obstacle is a thing drawn that a label must stay off: a stroke (the lines, the Mark line, the cursor, the flags' poles, the stake beams), a marker or dot, a hatch, a flag's pennant. Left out: the grid lines and the
// hover column and the area fills (a label sits on those by design), the banked band, the "No Mark" column (the cursor rule covers its label) and the axis ticks.
// The cursor is checked as expectClearOfCursor checks it: the labels that belong to it (its session's name, the slider value, the current Mark's label, the stake tags, the "past" label) are exempt.
export async function labelsDrawnOver(scope: Locator): Promise<DrawnOver[]> {
  return scope.evaluate((dialog) => {
    const found: { chart: 'price strip' | 'P&L chart'; label: string; text: string; over: string }[] = [];
    const OWN_CURSOR = /\b(cursor-label|slider-value|mark-label|stake-tag|past-label)\b/;
    // A text's box is the font's (ascent to descent); the ink is the middle of it, so a line grazing the empty top or bottom is not through the words.
    const inked = (r: DOMRect) => ({ left: r.left + 1, right: r.right - 1, top: r.top + r.height * 0.2, bottom: r.bottom - r.height * 0.2 });
    for (const svg of dialog.querySelectorAll<SVGSVGElement>('svg.price-strip, svg.pnl-chart')) {
      const chart = svg.classList.contains('price-strip') ? 'price strip' : 'P&L chart';
      const labels = [...svg.querySelectorAll<SVGTextElement>('text[class]')].map((t) => ({ t, cls: t.getAttribute('class')!, r: inked(t.getBoundingClientRect()), text: (t.textContent ?? '').trim() }));
      const boxes: { name: string; cls: string; left: number; right: number; top: number; bottom: number }[] = [];
      const points: { name: string; cls: string; x: number; y: number; own: boolean }[] = [];
      // The cursor's own session: its dot (the current Mark's, or the current P&L dot). A line through that dot is the session's own line (its marker line, the Mark line, the price line the Mark sits on, the
      // break-even line at a P&L of nothing, the Target line at the Target), and the Mark label and the slider value may touch it.
      const dot = svg.querySelector('circle.current')?.getBoundingClientRect();
      const dotAt = dot ? { x: (dot.left + dot.right) / 2, y: (dot.top + dot.bottom) / 2 } : null;
      for (const el of svg.querySelectorAll<SVGElement>('path[class], rect.hatch, circle')) {
        const cls = el.getAttribute('class') ?? '';
        const name = `${el.tagName} ${cls}`.trim();
        if (/\b(grid|area|banked-band|hover-column|no-mark)\b/.test(cls)) continue;
        if (el.tagName === 'rect' || el.tagName === 'circle' || /flag-pennant/.test(cls)) {
          const r = el.getBoundingClientRect();
          boxes.push({ name, cls, left: r.left, right: r.right, top: r.top, bottom: r.bottom });
          continue;
        }
        const path = el as unknown as SVGPathElement;
        const m = path.getScreenCTM()!;
        const length = path.getTotalLength();
        const drawn: { x: number; y: number }[] = [];
        for (let at = 0; at <= length; at += 1.5) {
          const p = path.getPointAtLength(at);
          drawn.push({ x: m.a * p.x + m.c * p.y + m.e, y: m.b * p.x + m.d * p.y + m.f });
        }
        const own = dotAt !== null && drawn.some((p) => Math.hypot(p.x - dotAt.x, p.y - dotAt.y) <= 2);
        for (const p of drawn) points.push({ name, cls, ...p, own });
      }
      for (const a of labels) {
        const inside = (x: number, y: number): boolean => x >= a.r.left - 0.5 && x <= a.r.right + 0.5 && y >= a.r.top && y <= a.r.bottom;
        const hit = new Set<string>();
        const ownLines = /\b(mark-label|slider-value)\b/.test(a.cls);
        for (const p of points) if (inside(p.x, p.y) && !(/\b(cursor|stake-beam)\b/.test(p.cls) && OWN_CURSOR.test(a.cls)) && !(p.own && ownLines)) hit.add(p.name);
        for (const b of boxes) if (a.r.right > b.left && a.r.left < b.right && a.r.bottom > b.top && a.r.top < b.bottom) {
          // The current Mark's dot, and the current P&L dot, are what their own labels are drawn beside.
          const own = (/\bmark current\b/.test(b.cls) && /\bmark-label\b/.test(a.cls)) || (/\bpnl-dot current\b/.test(b.cls) && /\b(slider-value|stake-tag|past-label)\b/.test(a.cls));          if (!own) hit.add(b.name);
        }
        for (const name of hit) found.push({ chart, label: a.cls, text: a.text, over: name });
      }
      for (const [i, a] of labels.entries()) {
        for (const b of labels.slice(i + 1)) {
          if (a.r.right > b.r.left && a.r.left < b.r.right && a.r.bottom > b.r.top && a.r.top < b.r.bottom) found.push({ chart, label: a.cls, text: a.text, over: `text ${b.cls} "${b.text}"` });
        }
      }
    }
    return found;
  });
}

// At each session of the open overlay (Home, then ArrowRight to the end), `visit` is run with the session's name and index, after the charts are redrawn.
export async function atEverySession(page: Page, scope: Locator, visit: (at: string, index: number) => Promise<void>): Promise<number> {
  await seek(page, scope, 'Home');
  const count = Number(await slider(scope).getAttribute('max')) + 1;
  for (let index = 0; index < count; index += 1) {
    if (index > 0) await seek(page, scope, 'ArrowRight');
    await expect(slider(scope)).toHaveValue(String(index));
    await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    await visit((((await sliderValue(scope).textContent()) ?? '').trim()), index);
  }
  return count;
}

type Size = { width: number; height: number };

// The overlay's header, the headline and both charts fit one screen, and everything lies inside the viewport's width.
export async function expectFitsOneScreen(scope: Locator, size: Size, where: string, checkHeight = true): Promise<void> {
  // The charts are drawn at their box's width (not below 200) before the heights are read: a viewport change is redrawn a moment later.
  await expect.poll(() => scope.evaluate((element) => {
    const box = element.querySelector('.replay-plot-frame')!.clientWidth;
    const want = Math.max(box, 200);
    return ['svg.price-strip', 'svg.pnl-chart'].map((selector) => Number(element.querySelector(selector)!.getAttribute('width')) - want);
  }), { message: `${where}: charts drawn at their box's width` }).toEqual([0, 0]);
  const measure = await scope.evaluate((element) => {
    const rect = (selector: string) => element.querySelector(selector)!.getBoundingClientRect();
    const header = rect('.replay-overlay-header');
    const headlineBox = rect('[data-testid="headline"]');
    const price = rect('svg.price-strip');
    const pnl = rect('svg.pnl-chart');
    return { span: pnl.bottom - header.top, rights: [headlineBox.right, price.right, pnl.right], lefts: [headlineBox.left, price.left, pnl.left], priceWidth: price.width, pnlWidth: pnl.width };
  });
  if (checkHeight) expect(measure.span, `${where}: the header, the headline and both charts span ${Math.round(measure.span)} px of ${size.height}`).toBeLessThanOrEqual(size.height);
  for (const right of measure.rights) expect(right, `${where}: right edge`).toBeLessThanOrEqual(size.width + 0.5);
  for (const left of measure.lefts) expect(left, `${where}: left edge`).toBeGreaterThanOrEqual(-0.5);
  expect(measure.priceWidth, `${where}: price chart width`).toBeGreaterThan(150);
  expect(measure.pnlWidth, `${where}: P&L chart width`).toBeGreaterThan(150);
}

// Every readout value is shown in full (not clipped by itself or an ancestor) and lies inside the viewport's width.
export async function expectReadoutShownInFull(scope: Locator, size: Size, where: string): Promise<void> {
  const values = scope.locator('.replay-readout .replay-value, .replay-readout .replay-r, .replay-readout .replay-pnl-value');
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

// Every figure a chart draws is readable in full: each text's box lies inside its svg's box.
export async function expectChartTextInside(scope: Locator, where: string): Promise<void> {
  for (const chart of [priceStrip(scope), pnlChart(scope)]) {
    const outside = await chart.evaluate((svg: SVGSVGElement) => {
      const box = svg.getBoundingClientRect();
      return [...svg.querySelectorAll('text')].flatMap((t) => {
        const r = t.getBoundingClientRect();
        const sideways = r.left < box.left - 0.5 || r.right > box.right + 0.5;
        const vertical = r.top < box.top - 0.5 || r.bottom > box.bottom + 0.5;
        return sideways || vertical ? [`${t.textContent} (${r.left.toFixed(1)} to ${r.right.toFixed(1)} of ${box.left.toFixed(1)} to ${box.right.toFixed(1)}; ${r.top.toFixed(1)} to ${r.bottom.toFixed(1)} of ${box.top.toFixed(1)} to ${box.bottom.toFixed(1)})`] : [];
      });
    });
    expect(outside, `${where}: chart text outside its chart`).toEqual([]);
  }
}

// The smallest chart text, as drawn on the screen (its font size times the drawing's scale), in pixels.
export async function smallestChartText(chart: Locator): Promise<number> {
  return chart.evaluate((svg: SVGSVGElement) => {
    const scale = svg.getBoundingClientRect().width / svg.viewBox.baseVal.width;
    return Math.min(...[...svg.querySelectorAll('text')].map((t) => parseFloat(getComputedStyle(t).fontSize) * scale));
  });
}
export async function expectSmallestChartTextAtLeast(scope: Locator, px: number, where: string): Promise<void> {
  for (const chart of [priceStrip(scope), pnlChart(scope)]) expect(await smallestChartText(chart), `${where}: smallest chart text`).toBeGreaterThanOrEqual(px);
}

// ---- The overlay's wide layout across the slider ----------------------------------------------------------------------------------------------------------

type Layout = { chart: { left: number; width: number }; readout: { left: number; right: number; width: number }; gridRights: number[] };

const layoutOf = (scope: Locator): Promise<Layout> =>
  scope.evaluate((element) => {
    const box = (selector: string) => element.querySelector(selector)!.getBoundingClientRect();
    const chart = box('svg.pnl-chart');
    const readout = box('.replay-readout');
    return {
      chart: { left: chart.left, width: chart.width },
      readout: { left: readout.left, right: readout.right, width: readout.width },
      gridRights: [...element.querySelectorAll('.replay-readout .replay-stake-grid')].map((grid) => grid.getBoundingClientRect().right),
    };
  });

// merge6-S1: at every session of the open overlay (from the first on, by the slider's arrow), the P&L chart is at least `minChart` wide, the chart and the readout are as wide and as far left as at the first
// session (nothing moves with the slider), and each stake grid ends inside the readout's column and inside the viewport.
export async function expectWideLayoutAtEverySession(page: Page, scope: Locator, size: Size, minChart: number, where: string): Promise<void> {
  await seek(page, scope, 'Home');
  const count = Number(await slider(scope).getAttribute('max')) + 1;
  expect(count, `${where}: sessions`).toBeGreaterThan(1);
  let first: Layout | undefined;
  for (let index = 0; index < count; index += 1) {
    if (index > 0) await seek(page, scope, 'ArrowRight');
    await expect(slider(scope), where).toHaveValue(String(index));
    await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    const at = `${where}, session ${index + 1} of ${count} (${((await sliderValue(scope).textContent()) ?? '').trim()})`;
    const now = await layoutOf(scope);
    first ??= now;
    expect(now.chart.width, `${at}: the P&L chart is ${now.chart.width} wide`).toBeGreaterThanOrEqual(minChart);
    expect(now.chart, `${at}: the chart's width and left edge are the first session's`).toEqual(first.chart);
    expect(now.readout, `${at}: the readout's width and edges are the first session's`).toEqual(first.readout);
    for (const right of now.gridRights) {
      expect(right, `${at}: the stake grid ends at ${right}, past the readout's ${now.readout.right}`).toBeLessThanOrEqual(now.readout.right + 0.5);
      expect(right, `${at}: the stake grid ends at ${right}, past the viewport's ${size.width}`).toBeLessThanOrEqual(size.width + 0.5);
    }
  }
}
