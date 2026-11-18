import { AXIO, build, chartText, closeOf, CORV, expect, going, headline, openDrawer, openTable, pnlChart, priceStrip, readoutValue, replay, seek, sliderValue, stake, tableRow, test } from './support.ts';

test.use({ actionTimeout: 15_000 });

// B9.2 (plan section 7.2, AC-MARK-004): R-CORV-D to Wed 11-11 (no put Mark on Tue 11-10) and R-AXIO-D to Mon 11-09 (a sale below the Stop). A session without a Mark is "No Mark", its figures
// are not carried from another session, and the Trade P&L area is broken there; a crossed Stop reads "Past the Stop by $180.00 (0.30R)." and the sale's banked loss is in the readout and
// the table. Every figure is plan section 5's. R-CORV-D's 1R is $318, R-AXIO-D's $600.
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
    await expect(headline(scope)).toHaveText('Mark missing: CORV Nov 20 $80 Put, Tue Nov 10');
    await expect(going(scope)).toHaveText('No Mark.');
    await expect(stake(scope)).toHaveCount(0);
    await expect(readoutValue(scope, 'Put Mark')).toHaveText('No Mark');
    await expect(readoutValue(scope, 'Result at the Stop')).toHaveText('−$318.00');
    await expect(readoutValue(scope, 'Result at the Target')).toHaveText('+$867.00');
    await expect(readoutValue(scope, 'Risk to stop')).toHaveText('No Mark');
    await expect(readoutValue(scope, 'CORV Mark')).toHaveText('76.20');
    await expect(readoutValue(scope, 'Trade P&L')).toHaveText('Mark missing: CORV Nov 20 $80 Put, Tue Nov 10');
    expect(await chartText(pnlChart(scope))).toEqual(expect.arrayContaining(['Stop −$318', 'Target +$867']));
    expect(await chartText(pnlChart(scope))).not.toContainEqual(expect.stringMatching(/^(Risk to stop|Reward to target)/));
    // The table says the same: Tuesday's row reads "No Mark" in every cell that needs the Put's Mark, never a carried value (the chart keeps the two result lines, above); Monday's and
    // Wednesday's rows are whole.
    await seek(page, scope, 'End');
    const table = await openTable(scope);
    await expect(tableRow(table, 'Mon Nov 9').locator('td')).toHaveText(['76.80', '$4.25', '+$642.00', '', '$960.00', '$225.00', '−$318.00', '+$867.00', '$1.05', '$5.00', '']);
    await expect(tableRow(table, 'Tue Nov 10').locator('td')).toHaveText(['76.20', 'No Mark', 'No Mark', '', 'No Mark', 'No Mark', '−$318.00', '+$867.00', '$1.05', '$5.00', '']);
    await expect(tableRow(table, 'Wed Nov 11').locator('td')).toHaveText(['75.40', '$5.12', '+$903.00', '', '$1,221.00', '$0.00', '−$318.00', '+$867.00', '$1.05', '$5.00', '']);
    await context.close();
  });

  test('should read Past the Stop by $180.00 (0.30R) on Mon 11-09 with the sale as banked loss, in the readout and in the table', async ({ profile }) => {
    test.setTimeout(240_000);
    const { context, page } = await build(profile, AXIO, closeOf('2026-11-09'), 5);
    await openDrawer(page, 'Replay');
    const scope = replay(page);
    await expect(sliderValue(scope)).toHaveText('Mon Nov 9 · 6 of 6');
    await expect(headline(scope)).toHaveText('−$920.00 · −1.53R');
    await expect(going(scope)).toHaveText('Past the Stop by $180.00 (0.30R).');
    await expect(stake(scope)).toHaveText('From here: Worst case $4,520.00 more · $1,080.00 back up to the Target.');
    await expect(readoutValue(scope, 'Banked')).toHaveText('−$440.00');
    await expect(readoutValue(scope, 'Open')).toHaveText('−$480.00');
    await expect(readoutValue(scope, 'Stop Overrun')).toHaveText('$180.00 · 0.30R');
    await expect(readoutValue(scope, 'Result at the Stop')).toHaveText('−$740.00');
    await expect(readoutValue(scope, 'Result at the Target')).toHaveText('+$160.00');
    await expect(readoutValue(scope, 'Reward to risk')).toHaveText('Stop breached');
    // The two results step at the sale (−$600 to −$740 and +$1,200 to +$160) and the chart names the sale.
    expect(await chartText(pnlChart(scope))).toEqual(expect.arrayContaining(['Stop −$740', 'Target +$160', 'Sold 100 at $45.60']));
    expect(await chartText(priceStrip(scope))).toEqual(expect.arrayContaining(['Stop $47.00', 'Target $56.00']));
    await expect(pnlChart(scope).locator('path.banked-band.loss')).toHaveCount(1);
    const table = await openTable(scope);
    await expect(tableRow(table, 'Fri Nov 6').locator('td')).toHaveText(['$48.10', '−$380.00', '', '$220.00', '$1,580.00', '−$600.00', '+$1,200.00', '$47.00', '$56.00', '']);
    await expect(tableRow(table, 'Mon Nov 9').locator('td')).toHaveText(['$45.20', '−$920.00', '−$440.00', '$0.00', '$1,080.00', '−$740.00', '+$160.00', '$47.00', '$56.00', 'Sold 100 at $45.60']);
    await context.close();
  });

  // W40 names the label "Realized −$440" for a banked loss; the label placer gives it the space before the stake tags.
  test('should label the banked loss "Realized −$440" in the P&L chart on Mon 11-09', async ({ profile }) => {
    test.setTimeout(240_000);
    const { context, page } = await build(profile, AXIO, closeOf('2026-11-09'), 5);
    await openDrawer(page, 'Replay');
    expect(await chartText(pnlChart(replay(page)))).toContain('Realized −$440');
    await context.close();
  });
});
