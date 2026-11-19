import type { Locator, Page } from '@playwright/test';
import {
  AXIO, BREN, build, chartText, closeOf, CORV, DALE_HOLD, expect, expectClearOfCursor, hits, openDrawer, pnlChart, priceStrip, replay, seek, sliderValue, test,
} from './support.ts';

test.use({ actionTimeout: 15_000 });

// B9AR.5 (plan section 7.2, AC-UI-002, AC-MARK-004): the charts. The key lists only what is drawn (W66); the time axis starts with the first session and an option's ends on its expiration (W67); every
// line has its label; the entry session's cursor has no chart text on it; a Worst case below the P&L range is named at the bottom edge (W68); a session with no Mark is a shaded "No Mark" column with
// nothing joined across it; the flags of W64 mark a first crossing; and hovering moves nothing in the readout.
const key = (scope: Locator): Promise<string[]> => scope.locator('ul.replay-key li').allTextContents();

async function open(page: Page, back: number): Promise<Locator> {
  await openDrawer(page, 'Replay');
  const scope = replay(page);
  if (back > 0) await seek(page, scope, 'ArrowLeft', back);
  return scope;
}

// What each key entry stands for in the drawing: the entry is listed exactly when its mark is in the P&L chart.
const DRAWN: Readonly<Record<string, string>> = {
  Banked: 'path.banked-band.gain',
  'Realized loss': 'path.banked-band.loss',
  'Break-even': 'path.break-even',
  'At Stop': 'path.result-line.stop',
  'At Target': 'path.result-line.target',
  Execution: 'path.marker-line',
  'No Mark': 'rect.no-mark',
};

async function expectKeyMatchesDrawing(scope: Locator, where: string): Promise<string[]> {
  const listed = await key(scope);
  expect(listed.length, `${where}: a key`).toBeGreaterThan(0);
  for (const [entry, selector] of Object.entries(DRAWN)) {
    const drawn = (await pnlChart(scope).locator(selector).count()) > 0 || (await priceStrip(scope).locator(selector).count()) > 0;
    expect(listed.includes(entry), `${where}: "${entry}" is ${drawn ? 'drawn' : 'not drawn'} and ${listed.includes(entry) ? 'listed' : 'not listed'} (key: ${listed.join(' | ')})`).toBe(drawn);
  }
  return listed;
}

test.describe('B9AR.5 The chart', () => {
  test('should list in the key only what R-BREN-U has drawn, at Mon 11-02 and Thu 11-12', async ({ profile }) => {
    test.setTimeout(240_000);
    const { context, page } = await build(profile, BREN, closeOf('2026-11-16'), 10);
    let scope = await open(page, 10);
    await expect(sliderValue(scope)).toHaveText('Mon Nov 2 · 1 of 11');
    let listed = await expectKeyMatchesDrawing(scope, 'BREN Mon 11-02');
    expect(listed).toEqual(expect.arrayContaining(['Mark', 'At Stop', 'At Target']));
    for (const absent of ['Banked', 'Execution', 'Realized loss', 'Past the Stop', 'Past the Target', 'No Mark', 'Stop breached', 'Target reached']) expect(listed, `Mon 11-02 has no ${absent}`).not.toContain(absent);
    // W67: the first session's date at the left; an option's expiration at the right.
    // (The time axis is the P&L chart's; the price strip above it shares its columns.)
    await expect(pnlChart(scope).locator('text.axis-start')).toHaveText('Mon Nov 2');
    await expect(pnlChart(scope).locator('text.axis-end')).toHaveText('Expires Fri Nov 20');
    await expectClearOfCursor(priceStrip(scope), 'BREN Mon 11-02 price strip');
    await expectClearOfCursor(pnlChart(scope), 'BREN Mon 11-02 P&L chart');
    await seek(page, scope, 'End');
    await seek(page, scope, 'ArrowLeft', 2);
    scope = replay(page);
    await expect(sliderValue(scope)).toHaveText('Thu Nov 12 · 9 of 11');
    listed = await expectKeyMatchesDrawing(scope, 'BREN Thu 11-12');
    expect(listed).toEqual(expect.arrayContaining(['Banked', 'Execution']));
    await context.close();
  });

  test('should end a stock’s time axis with nothing at the right, and keep the cursor clear of text on its entry session', async ({ profile }) => {
    test.setTimeout(240_000);
    const { context, page } = await build(profile, AXIO, closeOf('2026-11-16'), 10);
    const scope = await open(page, 10);
    await expect(sliderValue(scope)).toHaveText('Mon Nov 2 · 1 of 11');
    await expect(pnlChart(scope).locator('text.axis-start')).toHaveText('Mon Nov 2');
    await expect(pnlChart(scope).locator('text.axis-end')).toHaveCount(0);
    await expectKeyMatchesDrawing(scope, 'AXIO Mon 11-02');
    await expectClearOfCursor(priceStrip(scope), 'AXIO Mon 11-02 price strip');
    await expectClearOfCursor(pnlChart(scope), 'AXIO Mon 11-02 P&L chart');
    await context.close();
  });

  test('should name DALE-hold’s Worst case at the bottom edge with an arrow, with every line labelled and the Stop breached flagged', async ({ profile }) => {
    test.setTimeout(240_000);
    const { context, page } = await build(profile, DALE_HOLD, closeOf('2026-11-16'), 10);
    let scope = await open(page, 10);
    await expect(sliderValue(scope)).toHaveText('Mon Nov 2 · 1 of 11');
    expect(await chartText(pnlChart(scope))).toContain('Worst case −$33,936 ↓');
    await expectKeyMatchesDrawing(scope, 'DALE-hold Mon 11-02');
    await expectClearOfCursor(priceStrip(scope), 'DALE-hold Mon 11-02 price strip');
    await expectClearOfCursor(pnlChart(scope), 'DALE-hold Mon 11-02 P&L chart');
    await seek(page, scope, 'End');
    scope = replay(page);
    await expect(sliderValue(scope)).toHaveText('Mon Nov 16 · 11 of 11');
    const text = await chartText(pnlChart(scope));
    expect(text).toContain('Worst case −$33,936 ↓');
    // Every line has a label: the Stop, the Target and the break-even line in the P&L chart; the Strike and the Stop's and Target's prices in the price strip.
    expect(text).toEqual(expect.arrayContaining(['Break-even', expect.stringMatching(/^Stop /), expect.stringMatching(/^Target /)]));
    const lines = await priceStrip(scope).locator('path.price-line').count();
    expect(lines, 'the price strip draws lines').toBeGreaterThan(0);
    await expect(priceStrip(scope).locator('text.price-line-label')).toHaveCount(lines);
    // W64: a flag at the session a line was first crossed.
    expect(text).toContain('Stop breached');
    expect(await key(scope)).toContain('Stop breached');
    await expect(pnlChart(scope).locator('g.first-crossing')).toHaveCount(1);
    await context.close();
  });

  test('should shade the session with no Mark on R-CORV-D, join nothing across it and flag the Target reached', async ({ profile }) => {
    test.setTimeout(240_000);
    const { context, page } = await build(profile, CORV, closeOf('2026-11-11'), 7);
    const scope = await open(page, 0);
    await expect(sliderValue(scope)).toHaveText('Wed Nov 11 · 8 of 8');
    // The put has no Mark on Tue 11-10 (the Underlying has), so the P&L chart shades that column and names it.
    await expect(pnlChart(scope).locator('rect.no-mark'), 'one shaded column').toHaveCount(1);
    await expect(pnlChart(scope).locator('text.no-mark-label')).toHaveText('No Mark');
    // Nothing is joined across the gap: the P&L area begins again after it.
    expect(await pnlChart(scope).locator('path.area.profit').getAttribute('d')).toMatch(/Z\s*M/);
    // W64: Target first reached Fri 11-06, flagged where it happened.
    expect(await chartText(pnlChart(scope))).toContain('Target reached');
    expect(await key(scope)).toContain('Target reached');
    await expect(pnlChart(scope).locator('g.first-crossing')).not.toHaveCount(0);
    await context.close();
  });

  // W66 lists "No Mark" among the key's entries, and the key lists what is drawn; the P&L chart draws the shaded column from Tue 11-10 on. The product lists "No Mark" only when the Underlying's own
  // Mark is missing (the price strip's gap), so the key leaves out the column the P&L chart shades (reported to the main session as a reading of W66).
  test('should name the shaded No Mark column in the key on R-CORV-D', async ({ profile }) => {
    test.setTimeout(240_000);
    test.fail(true, 'the key does not list the No Mark column the P&L chart draws');
    const { context, page } = await build(profile, CORV, closeOf('2026-11-11'), 7);
    const scope = await open(page, 0);
    await expect(pnlChart(scope).locator('rect.no-mark')).toHaveCount(1);
    for (const back of [0, 1]) {
      if (back > 0) await seek(page, scope, 'ArrowLeft');
      expect(await key(scope), `the key on ${await sliderValue(scope).textContent()}`).toContain('No Mark');
    }
    await context.close();
  });

  test('should leave the top of the readout where it is when a session is hovered', async ({ profile }) => {
    test.setTimeout(240_000);
    const { context, page } = await build(profile, BREN, closeOf('2026-11-16'), 10);
    const scope = await open(page, 0);
    const readout = scope.getByTestId('readout');
    const before = (await readout.boundingBox())!;
    const chartBefore = (await scope.locator('.replay-chart-box').boundingBox())!;
    await expect(scope.getByTestId('hover')).toHaveCount(0);
    for (const date of ['Wed Nov 11', 'Mon Nov 2', 'Thu Nov 12']) {
      await hits(scope).getByRole('button', { name: date, exact: true }).hover();
      await expect(scope.getByTestId('hover')).toBeVisible();
      await expect(scope.getByTestId('hover')).toContainText(date);
      const during = (await readout.boundingBox())!;
      expect(during.y, `the readout's top while ${date} is hovered`).toBe(before.y);
      expect((await scope.locator('.replay-chart-box').boundingBox())!.height, `the charts' height while ${date} is hovered`).toBe(chartBefore.height);
    }
    await context.close();
  });
});
