import type { Locator, Page } from '@playwright/test';
import { BREN, build, closeOf, CORV, detailReplayButton, expect, replay, seek, sliderValue, test } from '../d9ar/support.ts';

test.use({ actionTimeout: 15_000 });

// B9.6 (plan section 7.2, AC-CALC-005, D9A-R): R-BREN-U to Mon 11-16 and R-CORV-D to Wed 11-11, the replay opened through the overlay's Replay button. The chips (W47) are opened by keyboard, the line
// under the charts (W48) is read at Mon 11-09 and Wed 11-11, W49 says why an estimate is Unavailable, every estimate carries the tag "estimate", no interest rate or formula shows beside the chart, and the
// About page states them once (W50). The figures are the reference Marks' own, read from the built page; the words are the ones the tasks built (new-words.md, "Stage B").
const chips = (scope: Locator): Locator => scope.getByTestId('chips');
const volatilityChip = (scope: Locator): Locator => chips(scope).getByRole('button', { name: /^Implied volatility/ });
const smallChart = (scope: Locator): Locator => scope.getByRole('group', { name: 'Implied volatility by session' });
const since = (scope: Locator): Locator => scope.getByTestId('since');
const text = async (locator: Locator): Promise<string> => ((await locator.textContent()) ?? '').replace(/\s+/g, ' ').trim();

// Tab from the slider until the volatility chip has the focus (at most twelve presses): a chip is reached by keyboard, with no pointer.
async function tabToVolatilityChip(page: Page, scope: Locator): Promise<void> {
  await scope.getByRole('slider', { name: 'Session' }).focus();
  for (let presses = 0; presses < 12; presses += 1) {
    await page.keyboard.press('Tab');
    if (await volatilityChip(scope).evaluate((el) => el === document.activeElement)) return;
  }
  throw new Error('Tab did not reach the Implied volatility chip');
}

async function openBren(profile: Parameters<typeof build>[0]) {
  const { context, page } = await build(profile, BREN, closeOf('2026-11-16'), 10);
  await detailReplayButton(page).click();
  await expect(replay(page)).toBeVisible();
  return { context, page, scope: replay(page) };
}

test.describe('B9.6 The estimates', () => {
  test('should show W47’s chips for R-BREN-U on Mon 11-16, each estimate tagged, and open the volatility chip’s chart by keyboard', async ({ profile }) => {
    test.setTimeout(240_000);
    const { context, page, scope } = await openBren(profile);
    await expect(sliderValue(scope)).toHaveText('Mon Nov 16 · 11 of 11');
    // The chips, as W47 words them; the estimates carry the tag and the two plain facts do not.
    await expect(volatilityChip(scope)).toHaveText('Implied volatility 27.7%estimate');
    await expect(scope.getByTestId('shares-chip')).toHaveText('Behaves like ≈ 183 sharesestimate');
    await expect(scope.getByTestId('days-chip')).toHaveText('4 days to expiration');
    await expect(scope.getByTestId('position-chip')).toHaveText('Long 2 contracts');
    await expect(chips(scope).locator('.replay-chip-tag')).toHaveText(['estimate', 'estimate']);
    // The same estimates elsewhere on the overlay each carry the tag: the readout's two rows, and the line under the charts.
    await expect(scope.locator('.replay-readout [data-row="Implied volatility"]')).toContainText('estimate');
    await expect(scope.locator('.replay-readout [data-row="Behaves like"]')).toContainText('estimate');
    await expect(since(scope).locator('.replay-chip-tag')).toHaveText('estimate');
    // Only the volatility chip is a control; the others are plain text.
    await expect(chips(scope).getByRole('button')).toHaveCount(1);
    // By keyboard: Tab reaches the chip and its focus opens the small chart, with its sessions in a list.
    await expect(smallChart(scope)).toHaveCount(0);
    await tabToVolatilityChip(page, scope);
    await expect(smallChart(scope)).toBeVisible();
    await expect(volatilityChip(scope)).toHaveAttribute('aria-expanded', 'true');
    await expect(smallChart(scope).getByTestId('iv-point')).toHaveCount(11);
    await expect(smallChart(scope).locator('li').first()).toHaveText('Mon Nov 2: 32.0%');
    await expect(smallChart(scope).locator('li').last()).toHaveText('Mon Nov 16: 27.7%');
    // Escape closes it, and Enter opens it again.
    await page.keyboard.press('Escape');
    await expect(smallChart(scope)).toHaveCount(0);
    await expect(replay(page)).toBeVisible();
    await page.keyboard.press('Enter');
    await expect(smallChart(scope)).toBeVisible();
    await context.close();
  });

  test('should read W48’s line under the charts at Mon 11-09 and Wed 11-11, split into the Underlying’s move, time and volatility', async ({ profile }) => {
    test.setTimeout(240_000);
    const { context, page, scope } = await openBren(profile);
    // Mon 11-16 first: W48's own example.
    await expect(since(scope)).toHaveText("Since Fri Nov 13: Trade P&L −$150.00. The call moved −$0.75 a share: BREN's move −$0.52 · time −$0.22 · volatility −$0.01estimate");
    await seek(page, scope, 'ArrowLeft', 3);
    await expect(sliderValue(scope)).toHaveText('Wed Nov 11 · 8 of 11');
    await expect(since(scope)).toHaveText("Since Tue Nov 10: Trade P&L +$336.00. The call moved +$0.84 a share: BREN's move +$0.96 · time −$0.10 · volatility −$0.02estimate");
    await expect(volatilityChip(scope)).toHaveText('Implied volatility 28.6%estimate');
    await expect(scope.getByTestId('shares-chip')).toHaveText('Behaves like ≈ 268 sharesestimate');
    await expect(scope.getByTestId('days-chip')).toHaveText('9 days to expiration');
    await expect(scope.getByTestId('position-chip')).toHaveText('Long 4 contracts');
    await seek(page, scope, 'ArrowLeft', 2);
    await expect(sliderValue(scope)).toHaveText('Mon Nov 9 · 6 of 11');
    await expect(since(scope)).toHaveText("Since Fri Nov 6: Trade P&L +$76.00. The call moved +$0.19 a share: BREN's move +$0.49 · time −$0.27 · volatility −$0.03estimate");
    await expect(volatilityChip(scope)).toHaveText('Implied volatility 29.5%estimate');
    await expect(scope.getByTestId('days-chip')).toHaveText('11 days to expiration');
    // The line carries a bar of its parts, a picture that says nothing the sentence does not: three parts, one of them each.
    await expect(since(scope).getByTestId('since-bar-part')).toHaveCount(3);
    // The line sits under the charts: its top is below the P&L chart's bottom.
    const line = (await since(scope).boundingBox())!;
    const chart = (await scope.locator('svg.pnl-chart').boundingBox())!;
    expect(line.y, 'the line is under the P&L chart').toBeGreaterThanOrEqual(chart.y + chart.height - 0.5);
    await context.close();
  });

  test('should say Unavailable with W49’s reason after R-CORV-D’s missing Mark, and keep the not-split sentence on Wed 11-11', async ({ profile }) => {
    test.setTimeout(240_000);
    const { context, page } = await build(profile, CORV, closeOf('2026-11-11'), 7);
    await detailReplayButton(page).click();
    const scope = replay(page);
    await expect(sliderValue(scope)).toHaveText('Wed Nov 11 · 8 of 8');
    // Wed 11-11: the put's move is not split, and the sentence says the real change since the last Mark.
    await expect(since(scope)).toHaveText("Since Mon Nov 9: Trade P&L +$261.00. The put's move is not split: a Mark is missing for Tue Nov 10. Its Mark changed +$0.87 since Mon Nov 9.");
    await expect(since(scope).getByTestId('since-bar')).toHaveCount(0);
    await expect(volatilityChip(scope)).toHaveText('Implied volatility 44.0%estimate');
    await expect(scope.getByTestId('shares-chip')).toHaveText('Behaves like ≈ short 237 sharesestimate');
    await expect(scope.getByTestId('position-chip')).toHaveText('Long 3 contracts');
    // Tue 11-10: no put Mark, so the chip says Unavailable and the reason stands under it; no sentence of a split.
    await seek(page, scope, 'ArrowLeft');
    await expect(sliderValue(scope)).toHaveText('Tue Nov 10 · 7 of 8');
    await expect(volatilityChip(scope)).toHaveText('Implied volatility Unavailableestimate');
    await expect(chips(scope).locator('.replay-chip-reason')).toHaveText('A Mark is missing.');
    await expect(scope.getByTestId('shares-chip')).toHaveCount(0);
    await expect(since(scope)).toHaveCount(0);
    // The small chart draws the gap: Tue 11-10 is a point-less session, listed as Unavailable, and no line crosses it.
    await tabToVolatilityChip(page, scope);
    await expect(smallChart(scope).locator('li').nth(8)).toHaveCount(0);
    await expect(smallChart(scope).locator('li').last()).toHaveText('Tue Nov 10: Unavailable');
    await expect(smallChart(scope).getByTestId('iv-point')).toHaveCount(6);
    // Wed 11-11: the first session after the gap. The line breaks at Tue 11-10: no run joins the Mon 11-09 point to the Wed 11-11 point.
    await page.keyboard.press('Escape');
    await seek(page, scope, 'ArrowRight');
    await expect(sliderValue(scope)).toHaveText('Wed Nov 11 · 8 of 8');
    await tabToVolatilityChip(page, scope);
    await expect(smallChart(scope).getByTestId('iv-point')).toHaveCount(7);
    const dots = await smallChart(scope).getByTestId('iv-point').evaluateAll((els) => els.map((el) => el.getAttribute('cx')));
    const runs = await smallChart(scope).getByTestId('iv-line').evaluateAll((els) => els.map((el) => (el.getAttribute('points') ?? '').split(' ').map((pair) => pair.split(',')[0])));
    // Mon 11-02 to Mon 11-09 are six points in one run; Wed 11-11 stands alone (a run of one draws no line).
    expect(runs, 'one run, the six points before the gap').toHaveLength(1);
    expect(runs[0], 'the run holds Mon Nov 2 to Mon Nov 9').toEqual(dots.slice(0, 6));
    expect(runs.flat(), 'no run reaches the Wed Nov 11 point').not.toContain(dots[6]);
    // Mon 11-02: a Put behaves like short stock (W47).
    await page.keyboard.press('Escape');
    await seek(page, scope, 'Home');
    await expect(sliderValue(scope)).toHaveText('Mon Nov 2 · 1 of 8');
    await expect(scope.getByTestId('shares-chip')).toHaveText('Behaves like ≈ short 122 sharesestimate');
    await context.close();
  });

  test('should show no interest rate and no formula beside the chart, and state them once on the About page (W50)', async ({ profile }) => {
    test.setTimeout(240_000);
    const { context, page, scope } = await openBren(profile);
    await tabToVolatilityChip(page, scope);
    await expect(smallChart(scope)).toBeVisible();
    const shown = await text(scope);
    expect(shown).not.toMatch(/interest|Black-Scholes|formula|dividend|\brate\b/i);
    // The two rates, in the chips (the chart's own box) and the line under the charts, where the readout's other percentages do not reach.
    const besideChart = `${await text(chips(scope))} ${await text(since(scope))}`;
    expect(besideChart).not.toMatch(/(?<![\d.])4%|5\.25%/);
    // The About page: the heading, and W50's sentences.
    await page.goto('/about');
    const section = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Option estimates', level: 2 }) });
    await expect(section).toBeVisible();
    // W50's sentences, in three paragraphs, and stated once (no second section holds them).
    await expect(section.locator('p')).toHaveText([
      "Implied volatility, the share equivalent and the split of an option's move are estimates. They use the textbook option formula (Black-Scholes): no dividends, and exercise only at expiration.",
      'Interest rate: 4% for a contract with up to 365 days to expiration, 5.25% beyond.',
      "The option's Mark and the Underlying's Mark may not be from the same moment. An estimate never changes a P&L or a risk figure.",
    ]);
    await expect(page.getByText('Black-Scholes')).toHaveCount(1);
    await context.close();
  });
});
