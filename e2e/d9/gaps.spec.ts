import type { Locator } from '@playwright/test';
import { R_DALE_D } from '../../src/domain/trade-analysis/option-trade.ts';
import { AXIO, BREN, build, chartText, closeOf, CORV, DALE, expect, going, headline, cardRows, noMarkDash, openDrawer, pastLine, pnlChart, priceStrip, readoutPnl, readoutR, readoutValue, replay, seek, sessionCard, sliderValue, stake, test, setViewport } from './support.ts';

test.use({ actionTimeout: 15_000 });

// B9.2 (plan section 7.2, AC-MARK-004): R-CORV-D to Wed 11-11 (no put Mark on Tue 11-10) and R-AXIO-D to Mon 11-09 (a sale below the Stop). A session without a Mark is "No Mark", its figures
// are not carried from another session, and the Trade P&L area is broken there; a crossed Stop reads "Past the Stop by $180.00 (0.30R)." and the sale's banked loss is in the readout and
// the session cards. Every figure is plan section 5's. R-CORV-D's 1R is $318, R-AXIO-D's $600.
test.describe('B9.2 A gap, a breach and a sale below the Stop', () => {
  test('should show No Mark on Tue 11-10 with the two results kept and no figure carried, and Wed 11-11 measured from Mon 11-09', async ({ profile }) => {
    test.setTimeout(240_000);
    const { context, page } = await build(profile, CORV, closeOf('2026-11-11'), 7);
    await openDrawer(page, 'Replay');
    const scope = replay(page);
    // Wed 11-11, the session after the gap: its own figures, its changes since Mon 11-09 (the last session that had the Put's Mark), and a broken Trade P&L area (two pieces).
    await expect(sliderValue(scope)).toHaveText('Wed Nov 11 · 8 of 8');
    await expect(headline(scope)).toHaveText('+$903.00 · 2.84R');
    await expect(going(scope)).toHaveText('Target reached, $36.00 past it.');
    await expect(readoutValue(scope, 'Trade P&L').locator('xpath=following-sibling::span')).toHaveText(' up $261.00 since Mon Nov 9');
    await expect(readoutValue(scope, 'Put Mark').locator('xpath=following-sibling::span')).toHaveText(' up $0.87 since Mon Nov 9');
    expect(await pnlChart(scope).locator('path.area.profit').getAttribute('d')).toMatch(/Z\s*M/);
    // Tue 11-10: "No Mark", no figure, the Marks that exist, and the Plan's two results kept.
    await seek(page, scope, 'ArrowLeft');
    await expect(sliderValue(scope)).toHaveText('Tue Nov 10 · 7 of 8');
    await expect(headline(scope)).toHaveText('No Mark for the put on Tue Nov 10.');
    // Said once: no second line repeats it.
    await expect(going(scope)).toHaveCount(0);
    await expect(stake(scope)).toHaveCount(0);
    await expect(noMarkDash(readoutValue(scope, 'Put Mark'))).toBeVisible();
    await expect(readoutPnl(scope, 'At Stop')).toHaveText('−$318.00');
    await expect(readoutPnl(scope, 'At Target')).toHaveText('+$867.00');
    // The cells that need the Put's Mark are a dash named "No Mark"; where the Trade would end at the Worst case needs none, so it stands.
    await expect(noMarkDash(readoutValue(scope, 'At Stop'))).toBeVisible();
    await expect(noMarkDash(readoutR(scope, 'At Stop'))).toBeVisible();
    await expect(noMarkDash(readoutValue(scope, 'At Target'))).toBeVisible();
    await expect(noMarkDash(readoutValue(scope, 'At Worst case'))).toBeVisible();
    await expect(readoutPnl(scope, 'At Worst case')).toHaveText('−$633.00');
    await expect(readoutValue(scope, 'CORV Mark')).toHaveText('$76.20');
    await expect(readoutValue(scope, 'Trade P&L').getByRole('img', { name: 'No Mark' })).toHaveText('—');
    expect(await chartText(pnlChart(scope))).toEqual(expect.arrayContaining(['Stop −$318', 'Target +$867']));
    expect(await chartText(pnlChart(scope))).not.toContainEqual(expect.stringMatching(/^(Current Risk|Remaining Reward)/));
    // The cards say the same: Tuesday's card reads a dash named "No Mark" in every row that needs the Put's Mark, never a carried value (the chart keeps the two result lines, above); Monday's and
    // Wednesday's cards are whole.
    await seek(page, scope, 'End');
    await expect(cardRows(await sessionCard(scope, 'Mon Nov 9'))).toHaveText(['CORV Mark$76.80', 'Put Mark$4.25', 'Trade P&L+$642.00 · 2.02R', 'Held3 contracts', 'At Stop$960.00 · 3.02R · P&L if hit −$318.00', 'At Worst case$1,275.00 · 4.01R · P&L if hit −$633.00', 'At Target$225.00 · 0.71R · P&L if hit +$867.00', 'At Max reward$22,725.00 · 71.46R · P&L if hit +$23,367.00', 'Reward to risk0.23 to 1 · about 81% : 19%']);
    const tuesday = await sessionCard(scope, 'Tue Nov 10');
    await expect(cardRows(tuesday)).toHaveText(['CORV Mark$76.20', 'Put Mark—', 'Trade P&L—', 'Held3 contracts', 'At Stop— · — · P&L if hit −$318.00', 'At Worst case— · — · P&L if hit −$633.00', 'At Target— · — · P&L if hit +$867.00', 'At Max reward— · — · P&L if hit +$23,367.00', 'Reward to risk—']);
    await expect(noMarkDash(tuesday)).toHaveCount(11);
    // Wednesday is past the Target: the one row for that stands in place of the "$0.00" At Target row the table read.
    await expect((await sessionCard(scope, 'Wed Nov 11')).locator('.replay-past-line')).toContainText('Past the Target by');
    await expect(cardRows(await sessionCard(scope, 'Wed Nov 11'))).toHaveText(['CORV Mark$75.40', 'Put Mark$5.12', 'Trade P&L+$903.00 · 2.84R', 'Held3 contracts', 'At Stop$1,221.00 · 3.84R · P&L if hit −$318.00', 'At Worst case$1,536.00 · 4.83R · P&L if hit −$633.00', 'At Max reward$22,464.00 · 70.64R · P&L if hit +$23,367.00']);
    await context.close();
  });

  test('should read Past the Stop by $180.00 (0.30R) on Mon 11-09 with the sale as banked loss, in the readout and on its card', async ({ profile }) => {
    test.setTimeout(240_000);
    const { context, page } = await build(profile, AXIO, closeOf('2026-11-09'), 5);
    await openDrawer(page, 'Replay');
    const scope = replay(page);
    await expect(sliderValue(scope)).toHaveText('Mon Nov 9 · 6 of 6');
    await expect(headline(scope)).toHaveText('−$920.00 · −1.53R');
    await expect(going(scope)).toHaveText('Past the Stop by $180.00 (0.30R).');
    await expect(stake(scope)).toHaveText('From here: Worst case $4,520.00 more · $1,080.00 back up to the Target.');
    await expect(readoutValue(scope, 'Realized')).toHaveText('−$440.00');
    await expect(readoutValue(scope, 'Open')).toHaveText('−$480.00');
    await expect(pastLine(scope)).toHaveText('Past the Stop by $180.00 (0.30R) · at Stop −$740.00');
    await expect(scope.locator('.replay-readout [data-row="At Stop"]')).toHaveCount(0);
    await expect(readoutPnl(scope, 'At Target')).toHaveText('+$160.00');
    await expect(scope.locator('.replay-readout [data-row="Reward to risk"]')).toHaveCount(0);
    // The two results step at the sale (−$600 to −$740 and +$1,200 to +$160) and the chart names the sale.
    expect(await chartText(pnlChart(scope))).toEqual(expect.arrayContaining(['Stop −$740', 'Target +$160', 'Sold 100 at $45.60']));
    expect(await chartText(priceStrip(scope))).toEqual(expect.arrayContaining(['Stop $47.00', 'Target $56.00']));
    await expect(pnlChart(scope).locator('path.banked-band.loss')).toHaveCount(1);
    await expect(cardRows(await sessionCard(scope, 'Fri Nov 6'))).toHaveText(['AXIO Mark$48.10', 'Trade P&L−$380.00 · −0.63R', 'Held200 shares', 'At Stop$220.00 · 0.37R · P&L if hit −$600.00', 'At Worst case$9,620.00 · 16.03R · P&L if hit −$10,000.00', 'At Target$1,580.00 · 2.63R · P&L if hit +$1,200.00', 'At Max rewardNo cap above', 'Reward to risk7.18 to 1 · about 12% : 88%']);
    // Mon 11-09's card holds the one row for a Trade past its Stop, in place of the "$0.00" at risk the table read (defect 1a).
    const monday = await sessionCard(scope, 'Mon Nov 9');
    await expect(monday.locator('.replay-past-line')).toHaveText('Past the Stop by $180.00 (0.30R) · at Stop −$740.00');
    await expect(cardRows(monday)).toHaveText(['AXIO Mark$45.20', 'Trade P&L−$920.00 · −1.53R', 'Realized−$440.00', 'Open−$480.00', 'Held100 shares', 'At Worst case$4,520.00 · 7.53R · P&L if hit −$5,440.00', 'At Target$1,080.00 · 1.80R · P&L if hit +$160.00', 'At Max rewardNo cap above', 'EventsSold 100 at $45.60, $1.40 below the Stop; Stop first breached']);
    await expect(monday).not.toContainText('$0.00');
    await context.close();
  });

  // Critic-2's defect 2 (section 1.8): "P&L –" on one line and "$17,463.00" on the next. Each grid cell is one figure on one line, sign included, at every width.
  const lines = (cells: Locator) =>
    cells.evaluateAll((tds) =>
      tds.map((td) => {
        const range = document.createRange();
        range.selectNodeContents(td);
        return { text: td.textContent ?? '', lines: new Set([...range.getClientRects()].map((r) => Math.round(r.top))).size };
      }),
    );
  for (const [name, fixture, date, through] of [['R-DALE-D Fri 11-13', { ...DALE, series: R_DALE_D, changes: [] }, '2026-11-13', 9], ['R-BREN-U Mon 11-02', BREN, '2026-11-02', 0]] as const) {
    test(`should keep a signed amount on one line in every grid cell at 1280, 375 and 320 wide, ${name}`, async ({ profile }) => {
      test.setTimeout(240_000);
      const { context, page } = await build(profile, fixture, closeOf(date), through, 0);
      await openDrawer(page, 'Replay');
      const scope = replay(page);
      await seek(page, scope, 'End');
      for (const width of [1280, 375, 320]) {
        await setViewport(page, width, 900);
        const cells = await lines(scope.locator('.replay-stake-grid tbody tr:not(.replay-past-line) td'));
        expect(cells.length).toBeGreaterThan(0);
        for (const cell of cells) expect(cell, `${date} at ${width}: ${cell.text}`).toMatchObject({ lines: 1 });
        // Unbreakable cells must still fit: the grid ends inside the viewport.
        expect(await scope.locator('.replay-stake-grid').evaluate((el) => el.getBoundingClientRect().right <= window.innerWidth), `${date} at ${width}: the grid fits`).toBe(true);
        // The signed amount is one piece: never a heading "P&L" above or before it.
        await expect(readoutPnl(scope, 'At Worst case')).toHaveText(/^[−+]\$[\d,]+\.\d{2}$/);
      }
      await context.close();
    });
  }

  // W40 names the label "Realized −$440" for a banked loss; the label placer gives it the space before the stake tags.
  test('should label the banked loss "Realized −$440" in the P&L chart on Mon 11-09', async ({ profile }) => {
    test.setTimeout(240_000);
    const { context, page } = await build(profile, AXIO, closeOf('2026-11-09'), 5);
    await openDrawer(page, 'Replay');
    expect(await chartText(pnlChart(replay(page)))).toContain('Realized −$440');
    await context.close();
  });
});
