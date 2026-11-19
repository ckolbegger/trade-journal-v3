import type { Locator, Page } from '@playwright/test';
import {
  AXIO, BREN, build, chartText, closeOf, CORV, DALE, DALE_HOLD, detail, expect, expectClearOfCursor, hits, MON_1123_1700, openDetailAt, openDrawer, pnlChart, priceStrip, READY, recordExpiration, replay,
  seek, setViewport, sliderValue, test,
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
    const { context, page } = await build(profile, CORV, closeOf('2026-11-11'), 7);
    const scope = await open(page, 0);
    await expect(pnlChart(scope).locator('rect.no-mark')).toHaveCount(1);
    for (const back of [0, 1]) {
      if (back > 0) await seek(page, scope, 'ArrowLeft');
      expect(await key(scope), `the key on ${await sliderValue(scope).textContent()}`).toContain('No Mark');
    }
    await context.close();
  });

  // T9AR.24-B6 (critic-1 defect 6; A280, W66): a bar or hatch is drawn with its label or not at all, no label over another, and the key names
  // "Past the Stop" and "At stake" while they are drawn.
  test('should draw each stake bar and hatch on AXIO Mon Nov 16 with its label and no label over another, and name both in the key, at 1280 and 1440', async ({ profile }) => {
    test.setTimeout(240_000);
    const { context, page } = await build(profile, AXIO, closeOf('2026-11-16'), 10);
    let scope = await open(page, 0);
    await expect(sliderValue(scope)).toHaveText('Mon Nov 16 · 11 of 11');
    for (const width of [1280, 1440]) {
      await setViewport(page, width, 900);
      scope = replay(page);
      const chart = pnlChart(scope);
      const drawn = await chart.evaluate((svg: SVGSVGElement) => {
        const cursor = Number(/^M([\d.]+)/.exec(svg.querySelector('path.cursor')!.getAttribute('d')!)![1]);
        const boxes = [...svg.querySelectorAll('text')].map((t) => {
          const r = t.getBoundingClientRect();
          return { text: t.textContent ?? '', l: r.left, r: r.right, t: r.top, b: r.bottom };
        });
        const clashes = boxes.flatMap((a, i) => boxes.slice(i + 1).filter((b) => a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b).map((b) => `"${a.text}" over "${b.text}"`));
        const hatches = [...svg.querySelectorAll('rect.hatch')].filter((h) => Number(h.getAttribute('x')) < cursor && cursor < Number(h.getAttribute('x')) + Number(h.getAttribute('width')));
        return {
          clashes,
          hatchAtCursor: hatches.length,
          pastLabels: svg.querySelectorAll('text.past-label').length,
          risk: [svg.querySelectorAll('path.stake-beam.risk').length, svg.querySelectorAll('text.stake-tag.risk').length],
          reward: [svg.querySelectorAll('path.stake-beam.reward').length, svg.querySelectorAll('text.stake-tag.reward').length],
        };
      });
      expect(drawn.clashes, `${width}: no label over another`).toEqual([]);
      expect(drawn.pastLabels, `${width}: the hatch at the cursor has its label`).toBe(drawn.hatchAtCursor);
      expect(drawn.risk[1], `${width}: a risk bar has its tag`).toBe(drawn.risk[0]);
      expect(drawn.reward[1], `${width}: a reward bar has its tag`).toBe(drawn.reward[0]);
      const listed = await key(scope);
      if (drawn.hatchAtCursor > 0) expect(listed, `${width}: the hatch is named`).toContain('Past the Stop');
      if (drawn.risk[0]! + drawn.reward[0]! > 0) expect(listed, `${width}: the bar is named`).toContain('At stake');
      // P148: a figure left off the drawing is still on the page, in the readout.
      await expect(scope.getByTestId('readout')).toContainText('Past the Stop by $300.00');
      await expect(scope.getByTestId('readout')).toContainText('$1,200');
    }
    await context.close();
  });

  // T9AR.24-B7 (critic-1 defect 7; T9AR.19, W64): the Stop breached flag, once drawn, stays on every later session, in the chart and in the key; P145: no flag before it.
  test('should keep AXIO’s Stop breached flag on the P&L chart and in the key on every session from Mon Nov 9 to Mon Nov 16, and none before', async ({ profile }) => {
    test.setTimeout(240_000);
    const { context, page } = await build(profile, AXIO, closeOf('2026-11-16'), 10);
    let scope = await open(page, 0);
    await expect(sliderValue(scope)).toHaveText('Mon Nov 16 · 11 of 11');
    for (const width of [1280, 1440, 1920]) {
      await setViewport(page, width, 900);
      scope = replay(page);
      await seek(page, scope, 'Home');
      scope = replay(page);
      const seen: string[] = [];
      for (let i = 0; i < 11; i++) {
        if (i > 0) await seek(page, scope, 'ArrowRight');
        scope = replay(page);
        const day = (await sliderValue(scope).textContent()) ?? '';
        const flagged = (await pnlChart(scope).locator('g.first-crossing.stop').count()) > 0 && (await chartText(pnlChart(scope))).includes('Stop breached');
        const named = (await key(scope)).includes('Stop breached');
        seen.push(`${day}: chart ${flagged}, key ${named}`);
        const before = i < 5;
        expect(flagged, `${width}, ${day}: the flag is ${before ? 'not yet' : 'still'} on the chart (${seen.join(' | ')})`).toBe(!before);
        expect(named, `${width}, ${day}: the key ${before ? 'does not name' : 'still names'} it`).toBe(!before);
        if (before) continue;
        // T9AR.24-B7-B2 and B3: the label is the flag's (the pole runs to it, beside it) and is legible over whatever it sits on: it has its
        // halo (paint-order stroke, 3 px, the card's colour) and nothing is painted after it, so no line or area shows through its words.
        const look = await pnlChart(scope).evaluate((svg: SVGSVGElement) => {
          const label = svg.querySelector('text.crossing-label') as SVGTextElement;
          const b = label.getBBox();
          const style = getComputedStyle(label);
          const poles = [...svg.querySelectorAll('g.first-crossing path.flag-pole')].map((p) => (p as SVGGraphicsElement).getBBox());
          const poleTop = Math.min(...poles.map((p) => p.y));
          const poleBottom = Math.max(...poles.map((p) => p.y + p.height));
          const poleX = poles[0]!.x;
          const after = [...svg.querySelectorAll('path, rect, circle')].filter((e) => !(label.compareDocumentPosition(e) & Node.DOCUMENT_POSITION_PRECEDING)).map((e) => e.getAttribute('class'));
          const cursor = svg.querySelector<SVGPathElement>('path.cursor');
          const cursorX = cursor ? cursor.getBBox().x : null;
          return {
            halo: style.paintOrder.startsWith('stroke') && parseFloat(style.strokeWidth) >= 3 && style.stroke !== 'none',
            tied: b.y + b.height / 2 >= poleTop && b.y + b.height / 2 <= poleBottom && Math.abs(Math.min(Math.abs(b.x - poleX), Math.abs(b.x + b.width - poleX)) - 6) < 3,
            after,
            crossesCursor: cursorX !== null && b.x < cursorX && cursorX < b.x + b.width,
            at: `label ${Math.round(b.x)},${Math.round(b.y)} pole ${Math.round(poleX)}, ${Math.round(poleTop)} to ${Math.round(poleBottom)}`,
          };
        });
        expect(look.halo, `${width}, ${day}: the label has its halo`).toBe(true);
        expect(look.tied, `${width}, ${day}: the pole runs to the label (${look.at})`).toBe(true);
        expect(look.after, `${width}, ${day}: nothing is drawn over the label`).toEqual([]);
        expect(look.crossesCursor, `${width}, ${day}: the label is off the cursor line (${look.at})`).toBe(false);
      }
    }
    await context.close();
  });

  test('should name the hatch and the stake bar in the key on BREN, where both are drawn with their labels', async ({ profile }) => {
    test.setTimeout(240_000);
    const { context, page } = await build(profile, BREN, closeOf('2026-11-16'), 10);
    const scope = await open(page, 0);
    await expect(sliderValue(scope)).toHaveText('Mon Nov 16 · 11 of 11');
    await expect(pnlChart(scope).locator('text.past-label')).toHaveText(/past the Target$/);
    const listed = await key(scope);
    expect(listed).toContain('Past the Target');
    expect(listed).toContain('At stake');
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

  // T9AR.24-B8 (critic-1 defect 8; T9AR.10, W66): the key is one line at 1280, 1440 and 1920 on every session (so on the busiest), and lists no Execution where none is drawn.
  const WIDE = [1280, 1440, 1920] as const;
  async function expectKeyOnOneLine(page: Page, sessions: number, where: string): Promise<void> {
    for (const width of WIDE) {
      await setViewport(page, width, 900);
      let scope = replay(page);
      await seek(page, scope, 'Home');
      for (let i = 0; i < sessions; i++) {
        scope = replay(page);
        if (i > 0) await seek(page, scope, 'ArrowRight');
        scope = replay(page);
        const day = (await sliderValue(scope).textContent()) ?? '';
        const tops = await scope.locator('ul.replay-key li').evaluateAll((items) => items.map((li) => Math.round(li.getBoundingClientRect().top)));
        const room = await scope.locator('ul.replay-key').evaluate((ul) => `box ${Math.round(ul.getBoundingClientRect().width)}, items ${Math.round([...ul.children].reduce((n, li) => n + li.getBoundingClientRect().width, 0))}`);
        expect(new Set(tops).size, `${where} at ${width}, ${day}: the key is one line (tops ${tops.join(', ')}; ${room}; ${(await key(scope)).join(' | ')})`).toBe(1);
      }
    }
  }

  for (const [name, fixture, through, close, sessions] of [
    ['BREN', BREN, 10, '2026-11-16', 11],
    ['AXIO', AXIO, 10, '2026-11-16', 11],
    ['DALE-hold', DALE_HOLD, 10, '2026-11-16', 11],
    ['CORV', CORV, 7, '2026-11-11', 8],
  ] as const) {
    test(`should keep ${name}’s key on one line at 1280, 1440 and 1920 on every session`, async ({ profile }) => {
      test.setTimeout(480_000);
      const { context, page } = await build(profile, fixture, closeOf(close), through);
      await open(page, 0);
      await expectKeyOnOneLine(page, sessions, name);
      await context.close();
    });
  }

  test('should keep R-DALE-U’s key on one line on every session, and name no Execution after the Expiration, which is the only marker drawn', async ({ profile }) => {
    test.setTimeout(600_000);
    const built = await build(profile, DALE, closeOf('2026-11-19'), 13, 0);
    await built.context.close();
    const { context, page } = await openDetailAt(profile, MON_1123_1700, built.trade);
    await expect(detail.settlementDueHeading(page)).toBeVisible(READY);
    await detail.recordExpirationLink(page).click();
    await recordExpiration(page);
    await page.getByRole('link', { name: 'Back to the Trade' }).click();
    await expect(detail.heading(page, 'DALE')).toBeVisible(READY);
    const scope = await open(page, 0);
    await expect(sliderValue(scope)).toHaveText('Fri Nov 20 · 15 of 15');
    await expect(pnlChart(scope).locator('path.marker-line')).toHaveCount(1);
    const listed = await key(scope);
    expect(listed, 'the Expired marker is drawn and W66 has no entry for it').not.toContain('Execution');
    await expectKeyOnOneLine(page, 15, 'DALE-U');
    await context.close();
  });
});
