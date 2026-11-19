import type { Locator, Page } from '@playwright/test';
import {
  AXIO, BREN, build, closeOf, CORV, DALE_HOLD, expect, expectAccessible, expectOneLine, going, openDrawer, pastLine, positionGroup, readoutPnl, readoutR, readoutValue, replay, seek, setViewport, sliderValue, stake, test,
} from './support.ts';

test.use({ actionTimeout: 15_000 });

// B9AR.3 (plan section 7.2, AC-CALC-003, AC-UI-002): the readout's stake grid (W55), the one row past a line (W56), a realized loss (W57), the dollar sign on every Mark (W58), the odds (W59, W60),
// the change line, the extremes' weight (decision 6), the "From here" sentence's colour, and one line per figure. From the full reading: right-aligned tabular figures, each stake row's canonical term
// as its accessible description (A287), and axe on AXIO's readout. The Position group's Execution words belong to T9AR.18 and come with B9AR.4's part 2.
const FIGURES = '.replay-readout .replay-value, .replay-readout .replay-r, .replay-readout .replay-pnl-value';
const css = (locator: Locator, property: string): Promise<string> => locator.evaluate((el, p) => getComputedStyle(el).getPropertyValue(p), property);

async function expectOneLineEach(scope: Locator, where: string): Promise<void> {
  const figures = scope.locator(FIGURES);
  const count = await figures.count();
  await scope.page().screenshot({ path: `evidence/D09AR/screenshots/B9AR.3-${where.replace(/[^\w]+/g, '-')}.png` });
  expect(count, `${where}: figures`).toBeGreaterThan(0);
  for (let i = 0; i < count; i += 1) await expectOneLine(figures.nth(i), `${where}: figure ${i + 1}`);
}

// Where the change line is: only under Trade P&L and the Marks (decision 8).
async function expectChangeLineOnlyOnPnlAndMarks(scope: Locator, where: string): Promise<string[]> {
  // The change line is the "up $261.00 since Mon Nov 9" text; the Plan's own ratio beside the Reward to risk figure is not one.
  const rows = await scope.locator('.replay-readout .replay-change').evaluateAll((els) => els.filter((el) => / since /.test(el.textContent ?? '')).map((el) => el.closest('[data-row]')?.getAttribute('data-row') ?? '(none)'));
  for (const name of rows) expect(name, `${where}: a change line under ${name}`).toMatch(/^(Trade P&L|.* Mark)$/);
  return rows;
}

const openAt = async (page: Page, key: 'ArrowLeft', times: number) => {
  await openDrawer(page, 'Replay');
  const scope = replay(page);
  if (times > 0) await seek(page, scope, key, times);
  return scope;
};

test.describe('B9AR.3 The readout', () => {
  test('should show R-BREN-U’s grid at Wed 11-11 and its past-the-Target row, Marks and odds at Mon 11-16', async ({ profile }) => {
    test.setTimeout(240_000);
    const { context, page } = await build(profile, BREN, closeOf('2026-11-16'), 10);
    // Mon 11-16 first: past the Target.
    const scope = await openAt(page, 'ArrowLeft', 0);
    await expect(pastLine(scope)).toHaveText('Past the Target by $32.00 (0.10R) · at Target +$956.00');
    await expect(scope.locator('.replay-readout [data-row="Reward to risk"]')).toHaveCount(0);
    await expect(scope.locator('.replay-readout [data-row="At Target"]')).toHaveCount(0);
    await expect(readoutValue(scope, 'BREN Mark')).toHaveText(/^\$\d+\.\d\d$/);
    await expect(readoutValue(scope, 'Call Mark')).toHaveText(/^\$\d/);
    await seek(page, scope, 'ArrowLeft', 3);
    await expect(sliderValue(scope)).toHaveText('Wed Nov 11 · 8 of 11');
    // W55: the column headings, and the rows with their three cells.
    expect(await scope.locator('.replay-stake-grid thead th').allTextContents()).toEqual(expect.arrayContaining(['From here', 'R', 'P&L if hit']));
    await expect(readoutValue(scope, 'At Stop')).toHaveText('$844.00');
    await expect(readoutR(scope, 'At Stop')).toHaveText('2.60R');
    await expect(readoutPnl(scope, 'At Stop')).toHaveText('−$324.00');
    await expect(readoutValue(scope, 'At Worst case')).toHaveText('$1,164.00');
    await expect(readoutR(scope, 'At Worst case')).toHaveText('3.59R');
    await expect(readoutPnl(scope, 'At Worst case')).toHaveText('−$644.00');
    await expect(readoutValue(scope, 'At Target')).toHaveText('$436.00');
    await expect(readoutR(scope, 'At Target')).toHaveText('1.35R');
    await expect(readoutPnl(scope, 'At Target')).toHaveText('+$956.00');
    await expect(readoutValue(scope, 'At Max reward')).toHaveText('No cap above');
    await expect(pastLine(scope)).toHaveCount(0);
    // W58: a dollar sign on every Mark.
    const marks = await scope.locator('.replay-readout-row[data-row$="Mark"] .replay-value').allTextContents();
    expect(marks.length).toBeGreaterThanOrEqual(2);
    for (const mark of marks) expect(mark).toMatch(/^\$/);
    await expect(readoutValue(scope, 'BREN Mark')).toHaveText('$101.80');
    // The change line only under Trade P&L and the Marks, and there on Wed 11-11 (it moved from Tue 11-10).
    const changed = await expectChangeLineOnlyOnPnlAndMarks(scope, 'BREN Wed 11-11');
    expect(changed).toEqual(expect.arrayContaining(['Trade P&L', 'BREN Mark', 'Call Mark']));
    await context.close();
  });

  // T9AR.16: the "From here" sentence in normal ink, the status line's own colour. The product draws it in the muted grey (rgb 85, 82, 75 against the status line's 28, 27, 25).
  test('should draw the From here sentence in the status line’s colour', async ({ profile }) => {
    test.setTimeout(240_000);
    const { context, page } = await build(profile, BREN, closeOf('2026-11-16'), 10);
    const scope = await openAt(page, 'ArrowLeft', 3);
    await expect(sliderValue(scope)).toHaveText('Wed Nov 11 · 8 of 11');
    await scope.page().screenshot({ path: 'evidence/D09AR/screenshots/B9AR.3-from-here-colour.png' });
    expect(await css(stake(scope), 'color')).toBe(await css(going(scope), 'color'));
    await context.close();
  });

  test('should show R-AXIO-D past the Stop on Mon 11-16 with a realized loss, a grey Worst case and axe clean; and Mon 11-09 as the first crossing', async ({ profile }) => {
    test.setTimeout(240_000);
    const { context, page } = await build(profile, AXIO, closeOf('2026-11-16'), 10);
    const scope = await openAt(page, 'ArrowLeft', 0);
    await expect(sliderValue(scope)).toHaveText('Mon Nov 16 · 11 of 11');
    await expect(pastLine(scope)).toHaveText('Past the Stop by $300.00 (0.50R) · at Stop −$740.00');
    await expect(scope.locator('.replay-readout [data-row="Reward to risk"]')).toHaveCount(0);
    await expect(scope.locator('.replay-readout [data-row="At Stop"]')).toHaveCount(0);
    // W57: a realized loss reads "Realized", where a gain reads "Banked".
    await expect(scope.locator('.replay-readout-row[data-row="Realized"]')).toHaveText('Realized−$440.00');
    await expect(scope.locator('.replay-readout [data-row="Banked"]')).toHaveCount(0);
    await expect(readoutValue(scope, 'AXIO Mark')).toHaveText(/^\$\d/);
    // The extremes' weight: the Worst case and Max reward rows are smaller and grey beside the main row (At Target here).
    const main = scope.locator('.replay-readout [data-row="At Target"]');
    await expect(main).toHaveCount(1);
    for (const name of ['At Worst case', 'At Max reward']) {
      const extreme = scope.locator(`.replay-readout [data-row="${name}"]`);
      await expect(extreme, name).toHaveCount(1);
      await expect(extreme).toHaveAttribute('data-weight', 'Remote');
      expect(parseFloat(await css(extreme.locator('.replay-value'), 'font-size')), `${name}: smaller`).toBeLessThan(parseFloat(await css(main.locator('.replay-value'), 'font-size')));
      expect(await css(extreme.locator('.replay-value'), 'color'), `${name}: grey`).not.toBe(await css(main.locator('.replay-value'), 'color'));
    }
    // From the full reading: figures right-aligned in tabular numerals; each stake row's canonical term as its accessible description (A287); axe, so the grey type still meets 4.5 to 1.
    for (const cell of [readoutValue(scope, 'At Target'), readoutR(scope, 'At Target'), readoutPnl(scope, 'At Target'), readoutPnl(scope, 'At Worst case')]) {
      expect(['right', 'end']).toContain(await css(cell, 'text-align'));
      expect(await css(cell, 'font-variant-numeric')).toContain('tabular-nums');
    }
    await expect(scope.locator('.replay-readout [data-row="At Target"]')).toHaveAccessibleDescription('Incremental Reward to Target');
    await expect(scope.locator('.replay-readout [data-row="At Worst case"]')).toHaveAccessibleDescription('Worst-Case Ongoing Risk');
    await expect(pastLine(scope)).toHaveAccessibleDescription('Stop Overrun');
    await expectAccessible(page, 'AXIO readout at Mon 11-16');
    // Mon 11-09, the first session below the Stop: the same row, in that session's figures.
    await seek(page, scope, 'ArrowLeft', 5);
    await expect(sliderValue(scope)).toHaveText('Mon Nov 9 · 6 of 11');
    await expect(pastLine(scope)).toHaveText(/^Past the Stop by \$180\.00 \(0\.30R\) · at Stop /);
    await context.close();
  });

  test('should show DALE-hold at Wed 11-11 with full-strength extremes, the odds with the Plan’s, and the change line only under Trade P&L and the Marks', async ({ profile }) => {
    test.setTimeout(240_000);
    const { context, page } = await build(profile, DALE_HOLD, closeOf('2026-11-16'), 10);
    const scope = await openAt(page, 'ArrowLeft', 3);
    await expect(sliderValue(scope)).toHaveText('Wed Nov 11 · 8 of 11');
    // W59, W60: two decimals, the estimated odds, and the Plan's beside them.
    await expect(scope.locator('.replay-readout-row[data-row="Reward to risk"] .replay-value')).toHaveText('11.69 to 1 · about 8% : 92%');
    await expect(scope.locator('.replay-readout-row[data-row="Reward to risk"]')).toContainText('(Plan 0.29 to 1 · 78% : 22%)');
    await expect(stake(scope)).toContainText('11.69 to 1 · about 8% : 92% (the Plan was 0.29 to 1 · 78% : 22%)');
    await expect(scope.locator('.replay-odds-note')).toHaveText('Odds: Target first : Stop first, estimated with no edge and no time limit.');
    // The odds are heard in full: "about 8% chance of the Target first, 92% of the Stop first".
    await expect(scope.locator('.replay-readout-row[data-row="Reward to risk"] [role=img]')).toHaveAccessibleName(/about 8% chance of the Target first, 92% of the Stop first/);
    // The extremes keep full strength where the Plan weighs them as main: the same size and colour as the Stop's row.
    const main = scope.locator('.replay-readout [data-row="At Stop"]');
    for (const name of ['At Worst case', 'At Max reward']) {
      const row = scope.locator(`.replay-readout [data-row="${name}"]`);
      await expect(row, name).toHaveCount(1);
      await expect(row).not.toHaveAttribute('data-weight', 'Remote');
      expect(await css(row.locator('.replay-value'), 'font-size'), `${name}: full size`).toBe(await css(main.locator('.replay-value'), 'font-size'));
      expect(await css(row.locator('.replay-value'), 'color'), `${name}: full colour`).toBe(await css(main.locator('.replay-value'), 'color'));
    }
    await expectChangeLineOnlyOnPnlAndMarks(scope, 'DALE-hold Wed 11-11');
    await context.close();
  });

  // The Position group's Execution words (W63, T9AR.18): each Execution against the Plan. The Expiration's "Expiration, Fri Nov 20" with "Expired" is B9AR.6's R-DALE-U case, in states.spec.ts.
  test('should word R-AXIO-D’s sale below the Stop against the Plan in the Position group', async ({ profile }) => {
    test.setTimeout(300_000);
    const axio = await build(profile, AXIO, closeOf('2026-11-16'), 10);
    await openDrawer(axio.page, 'Replay');
    const scope = replay(axio.page);
    await seek(axio.page, scope, 'ArrowLeft', 5);
    await expect(sliderValue(scope)).toHaveText('Mon Nov 9 · 6 of 11');
    await expect(positionGroup(scope).locator('[data-row="Execution, Mon Nov 9"]')).toHaveText('Execution, Mon Nov 9Sold 100 at $45.60, $1.40 below the Stop');
    await expect(positionGroup(scope).locator('[data-row="Held"]')).toHaveText('Held100 shares');
    await axio.context.close();
  });

  test('should word R-BREN-U’s entry and its sale at the Target against the Plan in the Position group', async ({ profile }) => {
    test.setTimeout(300_000);
    const bren = await build(profile, BREN, closeOf('2026-11-16'), 10);
    await openDrawer(bren.page, 'Replay');
    const scope = replay(bren.page);
    await seek(bren.page, scope, 'Home');
    await expect(sliderValue(scope)).toHaveText('Mon Nov 2 · 1 of 11');
    await expect(positionGroup(scope).locator('[data-row="Execution, Mon Nov 2"]')).toHaveText("Execution, Mon Nov 2Bought 4 at $1.61, at the Plan's entry");
    await seek(bren.page, scope, 'ArrowRight', 8);
    await expect(sliderValue(scope)).toHaveText('Thu Nov 12 · 9 of 11');
    await expect(positionGroup(scope).locator('[data-row="Execution, Thu Nov 12"]')).toHaveText('Execution, Thu Nov 12Sold 2 at $4.00, at the Target');
    // A session with no Execution has none in its Position group.
    await seek(bren.page, scope, 'ArrowRight');
    await expect(positionGroup(scope).locator('[data-row^="Execution"]')).toHaveCount(0);
    await bren.context.close();
  });

  test('should show R-CORV-D at Mon 11-09 with the extremes smaller and grey', async ({ profile }) => {
    test.setTimeout(240_000);
    const { context, page } = await build(profile, CORV, closeOf('2026-11-09'), 5);
    const scope = await openAt(page, 'ArrowLeft', 0);
    await expect(sliderValue(scope)).toHaveText('Mon Nov 9 · 6 of 6');
    const main = scope.locator('.replay-readout [data-row="At Stop"]');
    await expect(main).toHaveCount(1);
    for (const name of ['At Worst case', 'At Max reward']) {
      const extreme = scope.locator(`.replay-readout [data-row="${name}"]`);
      await expect(extreme, name).toHaveCount(1);
      await expect(extreme).toHaveAttribute('data-weight', 'Remote');
      expect(parseFloat(await css(extreme.locator('.replay-value'), 'font-size')), `${name}: smaller`).toBeLessThan(parseFloat(await css(main.locator('.replay-value'), 'font-size')));
      expect(await css(extreme.locator('.replay-value'), 'color'), `${name}: grey`).not.toBe(await css(main.locator('.replay-value'), 'color'));
    }
    await expectChangeLineOnlyOnPnlAndMarks(scope, 'CORV Mon 11-09');
    await context.close();
  });

  test('should show R-CORV-D at Tue 11-10 with the dash named No Mark in the Trade P&L row, and the missing Mark said once on the replay', async ({ profile }) => {
    test.setTimeout(240_000);
    const { context, page } = await build(profile, CORV, closeOf('2026-11-11'), 7);
    const scope = await openAt(page, 'ArrowLeft', 1);
    await expect(sliderValue(scope)).toHaveText('Tue Nov 10 · 7 of 8');
    const readout = scope.locator('.replay-readout');
    await expect(readout).not.toContainText('Mark missing');
    await expect(readout.locator('[data-row="Trade P&L"]').getByRole('img', { name: 'No Mark' })).toHaveText('—');
    expect((await scope.innerText()).match(/No Mark for|Mark missing/g) ?? [], 'the reason is said once on the replay').toHaveLength(1);
    await context.close();
  });

  // The plan's `expectOneLine` on every figure. The Trade P&L figure ("+$642.00 · 2.02R") breaks onto a second line in the readout's narrow column (screenshots in evidence/D09AR/screenshots/B9AR.3-*.png),
  // so the case is expected to fail until the product fits it; kept as the plan writes it.
  const situations = [
    { fixture: BREN, through: 10, back: 0, where: 'BREN Mon 11-16' },
    { fixture: BREN, through: 10, back: 3, where: 'BREN Wed 11-11' },
    { fixture: AXIO, through: 10, back: 0, where: 'AXIO Mon 11-16' },
    { fixture: DALE_HOLD, through: 10, back: 3, where: 'DALE-hold Wed 11-11' },
    { fixture: CORV, through: 5, back: 0, where: 'CORV Mon 11-09' },
  ] as const;
  for (const { fixture, through, back, where } of situations) {
    test(`should keep every readout figure on one line for ${where}`, async ({ profile }) => {
      test.setTimeout(240_000);
      const { context, page } = await build(profile, fixture, closeOf(through === 5 ? '2026-11-09' : '2026-11-16'), through);
      const scope = await openAt(page, 'ArrowLeft', back);
      await expectOneLineEach(scope, where);
      await context.close();
    });
  }
});

// T9AR.24-B2 (critic-1 defect 2, C9AR.2, A278): no figure in the readout or the overlay's header breaks across lines, and no sign parts from its number ("at Stop –" over "$1,536.00"). The check shares no pattern with the
// code that marks the figures: it measures every element the page marks as a figure (.card-figure) and each grid cell, and asserts the words left around them hold no figure mark of any kind ("$", "%", an R
// multiple, "to 1" odds, a lone sign), so a figure the code failed to mark is found as stray words. A row may wrap between figures, never inside one.
const STRAY = String.raw`\$|%|\dR\b|\d to \d|[−+–]\s*$`;
async function brokenReadoutFigures(scope: Locator): Promise<string[]> {
  return scope.evaluate((dialog, stray) => {
    const broken: string[] = [];
    const roots = [dialog.querySelector('h2'), dialog.querySelector('.replay-readout')].filter((r): r is Element => r !== null);
    const gridCell = '.replay-stake-grid tr:not(.replay-past-line) td';
    for (const root of roots) {
      const where = root.tagName === 'H2' ? 'header' : 'readout';
      const font = parseFloat(getComputedStyle(root).fontSize);
      for (const figure of root.querySelectorAll(`.card-figure, ${gridCell}`)) {
        // The text's own line boxes (a cell's padding is not a line).
        const range = document.createRange();
        range.selectNodeContents(figure);
        const rects = [...range.getClientRects()].filter((r) => r.width > 0 && r.height > 0);
        if (rects.length && Math.max(...rects.map((r) => r.bottom)) - Math.min(...rects.map((r) => r.top)) > font * 1.6) broken.push(`${where}: broken "${figure.textContent}"`);
      }
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        const parent = n.parentElement as HTMLElement;
        if (parent.closest('.card-figure') || parent.closest(gridCell)) continue;
        if (new RegExp(stray).test((n as Text).data)) broken.push(`${where}: unmarked figure in "${(n as Text).data.trim()}"`);
      }
    }
    return broken;
  }, STRAY);
}

test.describe('T9AR.24-B2 Figures in the readout and the overlay header', () => {
  const places = [
    { fixture: DALE_HOLD, back: 0, where: 'DALE-hold Mon Nov 16' },
    { fixture: AXIO, back: 0, where: 'AXIO Mon Nov 16' },
    { fixture: DALE_HOLD, back: 2, where: 'DALE-hold Thu Nov 12' },
  ] as const;
  for (const { fixture, back, where } of places) {
    test(`should keep every figure in the readout and the header on one line, sign with its number, at 1280, 1440, 1920, 375 and 320, ${where}`, async ({ profile }) => {
      test.setTimeout(300_000);
      const { context, page } = await build(profile, fixture, closeOf('2026-11-16'), 10);
      const scope = await openAt(page, 'ArrowLeft', back);
      for (const width of [1280, 1440, 1920, 375, 320]) {
        await setViewport(page, width, 800);
        expect(await brokenReadoutFigures(scope), `${where} at ${width}`).toEqual([]);
      }
      await context.close();
    });
  }
});

// T9AR.24-B12 (critic-2 defect 4, C9AR.2, A278): the Plan block's figures ("−$324.00", "25% : 75%", "2.95 to 1") are each one line, and no sign parts from its number ("P&L if hit –" over "$324.00"). It reuses
// B2's loose pattern: every .card-figure is measured, and the words left around them hold no figure mark.
async function brokenPlanFigures(scope: Locator): Promise<string[]> {
  return scope.locator('section.replay-plan').evaluate((root, stray) => {
    const broken: string[] = [];
    const font = parseFloat(getComputedStyle(root).fontSize);
    for (const figure of root.querySelectorAll('.card-figure')) {
      const range = document.createRange();
      range.selectNodeContents(figure);
      const rects = [...range.getClientRects()].filter((r) => r.width > 0 && r.height > 0);
      if (rects.length && Math.max(...rects.map((r) => r.bottom)) - Math.min(...rects.map((r) => r.top)) > font * 1.6) broken.push(`broken "${figure.textContent}"`);
    }
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if ((n.parentElement as HTMLElement).closest('.card-figure')) continue;
      if (new RegExp(stray).test((n as Text).data)) broken.push(`unmarked figure in "${(n as Text).data.trim()}"`);
    }
    return broken;
  }, STRAY);
}

test.describe('T9AR.24-B12 Figures in the Plan block', () => {
  const places = [
    { fixture: BREN, through: 10, day: '2026-11-16', where: 'BREN' },
    { fixture: AXIO, through: 10, day: '2026-11-16', where: 'AXIO' },
    { fixture: CORV, through: 5, day: '2026-11-09', where: 'CORV' },
  ] as const;
  for (const { fixture, through, day, where } of places) {
    test(`should keep every figure in the Plan block on one line, sign with its number, at 375 and 320, ${where}`, async ({ profile }) => {
      test.setTimeout(300_000);
      const { context, page } = await build(profile, fixture, closeOf(day), through);
      const scope = await openAt(page, 'ArrowLeft', 0);
      await expect(scope.locator('section.replay-plan')).toHaveCount(1);
      for (const width of [375, 320]) {
        await setViewport(page, width, 800);
        expect(await brokenPlanFigures(scope), `${where} at ${width}`).toEqual([]);
        expect(await scope.locator('section.replay-plan .card-figure').count(), `${where} at ${width}: figures`).toBeGreaterThan(0);
      }
      await context.close();
    });
  }
});
