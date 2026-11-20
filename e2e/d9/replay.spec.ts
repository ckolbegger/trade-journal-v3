import {
  BREN, build, cardRows, chartText, closeOf, expect, going, headline, hits, openDrawer, pastLine, pnlChart, priceStrip, readoutPnl, readoutR, readoutValue, replay, seek, sessionCard, sessionCards, sessionLabels, slider, sliderValue, stake, test,
} from './support.ts';

test.use({ actionTimeout: 15_000 });

// B9.1 (plan section 7.2): R-BREN-U through the UI to Mon 11-16, the Replay overlay opened, the slider moved back by keyboard to Thu 11-12 and to Mon 11-02. Every figure and word is plan
// section 5's or W36 to W43's: the headline, how it is going and what is at stake for each session, the two lines stepping at the sale, the banked band from Thu 11-12, and nothing of a
// later session in the overlay. R-BREN-U's 1R is $324, its Plan 2.95 to 1.
const LATER = {
  // The Marks of the sessions after the one shown, which the overlay must not carry.
  'Thu Nov 12': ['Fri Nov 13', 'Mon Nov 16', '$4.91', '104.60', '$4.16'],
  'Mon Nov 2': ['Tue Nov 3', 'Thu Nov 12', 'Mon Nov 16', '$2.91', '103.60', 'Banked +$478', 'Sold 2 at $4.00'],
} as const;

test.describe('B9.1 Replay in Trade Detail', () => {
  test('should show Mon 11-16 with the headline, how it is going, what is at stake and the labels W36 to W41 name', async ({ profile }) => {
    test.setTimeout(240_000);
    const { context, page } = await build(profile, BREN, closeOf('2026-11-16'), 10);
    await openDrawer(page, 'Replay');
    const scope = replay(page);
    await expect(headline(scope)).toHaveText('+$988.00 · 3.05R');
    await expect(going(scope)).toHaveText('Target reached, $32.00 past it.');
    await expect(stake(scope)).toHaveText('From here: $672.00 at risk back to the Stop ($510.00 of it open profit) · no cap above. Even at the Stop this Trade would end $316.00 ahead.');
    // W42: the slider's label and its value (a screen reader hears the value, then the headline).
    await expect(slider(scope)).toHaveAccessibleName('Session');
    await expect(sliderValue(scope)).toHaveText('Mon Nov 16 · 11 of 11');
    await expect(slider(scope)).toHaveAttribute('aria-valuetext', 'Mon Nov 16 · 11 of 11. +$988.00 · 3.05R');
    await expect(scope.getByRole('button', { name: 'Previous session' })).toBeEnabled();
    await expect(scope.getByRole('button', { name: 'Next session' })).toBeDisabled();
    // W39 to W41: the chart titles and the labels of the P&L chart and the price strip.
    expect(await chartText(priceStrip(scope))).toEqual(expect.arrayContaining(['BREN price · one Mark per session', 'Strike $100']));
    expect(await chartText(pnlChart(scope))).toEqual(
      expect.arrayContaining([
        'Trade P&L',
        'Stop +$316', 'Target +$956', 'Break-even', 'Banked +$478', 'Worst case +$156', '$32 past the Target', 'Current Risk $672', 'Sold 2 at $4.00',
      ]),
    );
    // W43: the readout's rows, with the Open row beside Banked.
    await expect(readoutValue(scope, 'Trade P&L')).toHaveText('+$988.00 · 3.05R');
    await expect(readoutValue(scope, 'Banked')).toHaveText('+$478.00');
    await expect(readoutValue(scope, 'Open')).toHaveText('+$510.00');
    await expect(readoutValue(scope, 'At Stop')).toHaveText('$672.00');
    await expect(readoutR(scope, 'At Stop')).toHaveText('2.07R');
    await expect(readoutPnl(scope, 'At Stop')).toHaveText('+$316.00');
    await expect(pastLine(scope)).toHaveText('Past the Target by $32.00 (0.10R) · at Target +$956.00');
    await expect(scope.locator('.replay-readout [data-row="At Target"]')).toHaveCount(0);
    await expect(readoutValue(scope, 'At Max reward')).toHaveText('No cap above');
    await expect(scope.locator('.replay-readout [data-row="Reward to risk"]')).toHaveCount(0);
    await context.close();
  });

  test('should step back to Thu 11-12 by keyboard with its own figures, the Stop line stepped at the sale and the banked band begun, and nothing of a later session', async ({ profile }) => {
    test.setTimeout(240_000);
    const { context, page } = await build(profile, BREN, closeOf('2026-11-16'), 10);
    await openDrawer(page, 'Replay');
    const scope = replay(page);
    await seek(page, scope, 'ArrowLeft', 2);
    await expect(sliderValue(scope)).toHaveText('Thu Nov 12 · 9 of 11');
    await expect(headline(scope)).toHaveText('+$982.00 · 3.03R');
    await expect(going(scope)).toHaveText('Target reached, $26.00 past it.');
    await expect(stake(scope)).toHaveText('From here: $666.00 at risk back to the Stop ($504.00 of it open profit) · no cap above. Even at the Stop this Trade would end $316.00 ahead.');
    await expect(readoutValue(scope, 'Banked')).toHaveText('+$478.00');
    await expect(readoutValue(scope, 'Open')).toHaveText('+$504.00');
    expect(await chartText(pnlChart(scope))).toEqual(expect.arrayContaining(['Stop +$316', 'Target +$956', '$26 past the Target', 'Sold 2 at $4.00']));
    // The two lines step at the sale: the Stop line's result is −$324 until Wed 11-11 and +$316 from Thu 11-12; the Target line does not move.
    await expect(cardRows(await sessionCard(scope, 'Wed Nov 11'))).toHaveText(['BREN Mark$101.80', 'Call Mark$2.91', 'Implied volatility28.6%estimate', 'Trade P&L+$520.00 · 1.60R', 'Held4 contracts', 'Behaves like≈ 268 sharesestimate', 'At Stop$844.00 · 2.60R · P&L if hit −$324.00', 'At Worst case$1,164.00 · 3.59R · P&L if hit −$644.00', 'At Target$436.00 · 1.35R · P&L if hit +$956.00', 'At Max rewardNo cap above', 'Reward to risk0.52 to 1 · about 66% : 34%']);
    // Thu 11-12 is past the Target: the card holds the one row for that, and no "$0.00" at the Target the table read.
    const thursday = await sessionCard(scope, 'Thu Nov 12');
    await expect(thursday.locator('.replay-past-line')).toHaveText('Past the Target by $26.00 (0.08R) · at Target +$956.00');
    await expect(cardRows(thursday)).toHaveText(['BREN Mark$103.60', 'Call Mark$4.13', 'Implied volatility28.0%estimate', 'Trade P&L+$982.00 · 3.03R', 'Banked+$478.00', 'Open+$504.00', 'Held2 contracts', 'Behaves like≈ 163 sharesestimate', 'At Stop$666.00 · 2.06R · P&L if hit +$316.00', 'At Worst case$826.00 · 2.55R · P&L if hit +$156.00', 'At Max rewardNo cap above', 'EventsSold 2 at $4.00, at the Target; Target first reached']);
    // In the chart the Stop line has one vertical step (at the sale) and the Target line has none; the banked band is drawn.
    await expect(pnlChart(scope).locator('path.result-line.stop')).toHaveAttribute('d', /V[\d.]+H[\d.]+$/);
    expect(await pnlChart(scope).locator('path.result-line.stop').getAttribute('d')).toMatch(/^[^V]*V[^V]*$/);
    expect(await pnlChart(scope).locator('path.result-line.target').getAttribute('d')).not.toContain('V');
    await expect(pnlChart(scope).locator('path.banked-band')).toHaveCount(1);
    // One session before the sale: the Stop line is still at −$324, with no step and no band.
    await seek(page, scope, 'ArrowLeft');
    await expect(sliderValue(scope)).toHaveText('Wed Nov 11 · 8 of 11');
    expect(await chartText(pnlChart(scope))).toEqual(expect.arrayContaining(['Stop −$324', 'Target +$956']));
    expect(await pnlChart(scope).locator('path.result-line.stop').getAttribute('d')).not.toContain('V');
    await expect(pnlChart(scope).locator('path.banked-band')).toHaveCount(0);
    // Back on Thu 11-12: nothing of Fri 11-13 or Mon 11-16 anywhere in the overlay.
    await seek(page, scope, 'ArrowRight');
    await expect(sliderValue(scope)).toHaveText('Thu Nov 12 · 9 of 11');
    for (const later of LATER['Thu Nov 12']) await expect(scope).not.toContainText(later);
    await expect(sessionCards(scope)).toHaveCount(9);
    await expect(hits(scope).getByRole('button')).toHaveCount(9);
    await context.close();
  });

  test('should hold the chart’s Worst case figure in the readout’s At Worst case row and on its card (C9.2)', async ({ profile }) => {
    test.setTimeout(240_000);
    const { context, page } = await build(profile, BREN, closeOf('2026-11-16'), 10);
    await openDrawer(page, 'Replay');
    const scope = replay(page);
    await seek(page, scope, 'ArrowLeft', 2);
    await expect(sliderValue(scope)).toHaveText('Thu Nov 12 · 9 of 11');
    const label = (await chartText(pnlChart(scope))).find((t) => t.startsWith('Worst case '));
    expect(label).toBe('Worst case +$156');
    const figure = `${label!.slice('Worst case '.length)}.00`;
    await expect(readoutPnl(scope, 'At Worst case')).toHaveText(figure);
    await expect(scope.locator('.replay-readout [data-row="At Worst case"]')).toContainText(figure);
    await expect((await sessionCard(scope, 'Thu Nov 12')).locator('[data-row="At Worst case"]')).toContainText(`P&L if hit ${figure}`);
    await context.close();
  });

  test('should step back to Mon 11-02 by keyboard with the first session, no band and no sale, and nothing of a later session', async ({ profile }) => {
    test.setTimeout(240_000);
    const { context, page } = await build(profile, BREN, closeOf('2026-11-16'), 10);
    await openDrawer(page, 'Replay');
    const scope = replay(page);
    await seek(page, scope, 'Home');
    await expect(sliderValue(scope)).toHaveText('Mon Nov 2 · 1 of 11');
    await expect(headline(scope)).toHaveText('+$28.00 · 0.09R');
    await expect(going(scope)).toHaveText('Ahead: 3% of the way to the Target.');
    await expect(stake(scope)).toHaveText('From here: $352.00 at risk to the Stop · $928.00 more to the Target · 2.64 to 1 · about 28% : 72% (the Plan was 2.95 to 1 · 25% : 75%).');
    await expect(scope.locator('.replay-readout-row[data-row="Reward to risk"]')).toHaveText('Reward to risk2.64 to 1 · about 28% : 72% (Plan 2.95 to 1 · 25% : 75%)');
    await expect(scope.locator('.replay-odds-note')).toHaveText('Odds: Target first : Stop first, estimated with no edge and no time limit.');
    await expect(readoutPnl(scope, 'At Stop')).toHaveText('−$324.00');
    await expect(readoutPnl(scope, 'At Target')).toHaveText('+$956.00');
    expect(await chartText(pnlChart(scope))).toEqual(expect.arrayContaining(['Stop −$324', 'Target +$956', 'Current Risk $352', 'Remaining Reward $928']));
    await expect(pnlChart(scope).locator('path.banked-band')).toHaveCount(0);
    for (const later of LATER['Mon Nov 2']) await expect(scope).not.toContainText(later);
    await expect(sessionCards(scope)).toHaveCount(1);
    await expect(hits(scope).getByRole('button')).toHaveCount(1);
    await expect(slider(scope)).toHaveAttribute('aria-valuetext', 'Mon Nov 2 · 1 of 11. +$28.00 · 0.09R');
    await context.close();
  });

  test('should name each revealed session as a button, mark the hovered one in both charts and move to the one pressed', async ({ profile }) => {
    test.setTimeout(240_000);
    const { context, page } = await build(profile, BREN, closeOf('2026-11-16'), 10);
    await openDrawer(page, 'Replay');
    const scope = replay(page);
    await expect(hits(scope).getByRole('button')).toHaveCount(11);
    for (const date of sessionLabels(10)) await expect(hits(scope).getByRole('button', { name: date, exact: true })).toHaveCount(1);
    const wednesday = hits(scope).getByRole('button', { name: 'Wed Nov 11' });
    await wednesday.hover();
    await expect(priceStrip(scope).locator('rect.hover-column')).toHaveCount(1);
    await expect(pnlChart(scope).locator('rect.hover-column')).toHaveCount(1);
    await expect(sliderValue(scope)).toHaveText('Mon Nov 16 · 11 of 11');
    await wednesday.click();
    await expect(sliderValue(scope)).toHaveText('Wed Nov 11 · 8 of 11');
    await expect(headline(scope)).toHaveText('+$520.00 · 1.60R');
    await context.close();
  });
});
