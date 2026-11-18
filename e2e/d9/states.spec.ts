import type { Page } from '@playwright/test';
import {
  BREN, BREN_SOLD_OUT, build, buildPlanned, chartText, closeOf, DALE, detail, expect, going, headline, MON_1123_1700, openDrawer, openDetailAt, openTable, pnlChart, PRICE_HISTORY, READY,
  readoutValue, recordExpiration, replay, seek, sliderValue, stake, tableRow, test,
} from './support.ts';

test.use({ actionTimeout: 15_000 });

// B9.4 (plan section 7.2, AC-CALC-004): how a replay ends. K-sale (Closed by sale), R-DALE-U Settlement Due and then with its Expiration recorded, and a Planned Trade. W1 (amended) per state,
// the "Final result" headline of a final session, no Replay drawer on the Planned Trade, and (AC-CALC-004) no payoff line or theoretical price in the replay.
type TabName = 'Today' | 'Replay' | 'Position' | 'Plan and Risk' | 'Price History' | 'Journal' | 'Payoff';
const PANEL = (name: TabName): string => `#drawer-panel-${name.toLowerCase().replaceAll(' ', '-')}`;
const JOURNAL = /^Journal( \d+ owed)?$/;

async function expectDrawers(page: Page, shown: readonly (string | RegExp)[], gone: readonly TabName[], selected: TabName): Promise<void> {
  const tabs = page.getByRole('tablist', { name: 'Detail' });
  await expect(tabs.getByRole('tab')).toHaveText([...shown]);
  await expect(tabs.getByRole('tab', { selected: true })).toHaveText(selected);
  await expect(page.locator(PANEL(selected))).toBeVisible();
  for (const name of gone) {
    await expect(tabs.getByRole('tab', { name, exact: true })).toHaveCount(0);
    await expect(page.locator(PANEL(name))).toHaveCount(0);
  }
}

// AC-CALC-004: the replay draws no Expiration Payoff and shows no theoretical price as a value.
async function expectNoPayoffOrTheory(page: Page): Promise<void> {
  const scope = replay(page);
  await expect(scope.locator('path.payoff, path.payoff-line, [class*="payoff"]')).toHaveCount(0);
  await expect(scope).not.toContainText(/payoff|theoretical|fair value|model price/i);
}

const SEVEN = ['Today', 'Replay', 'Position', 'Plan and Risk', PRICE_HISTORY, JOURNAL, 'Payoff'] as const;

test.describe('B9.4 How a replay ends', () => {
  test('should show the Replay drawer second on an Open Trade, with Today selected and no payoff line in the replay', async ({ profile }) => {
    test.setTimeout(240_000);
    const { context, page } = await build(profile, BREN, closeOf('2026-11-16'), 10);
    await expectDrawers(page, SEVEN, [], 'Today');
    await openDrawer(page, 'Replay');
    await expect(headline(replay(page))).toHaveText('+$988.00 · 3.05R');
    await expect(replay(page).locator('.replay-readout-group h3')).toHaveText(['How it is going', 'At stake from here, whole Position', 'Marks', 'Position', 'The Plan']);
    await expectNoPayoffOrTheory(page);
    await context.close();
  });

  test('should end K-sale on its sale with a Final result headline, the banked total and an Events row, and show every drawer', async ({ profile }) => {
    test.setTimeout(240_000);
    const { context, page } = await build(profile, BREN_SOLD_OUT, closeOf('2026-11-13'), 9);
    await expect(detail.lifecycleBadge(page)).toHaveText('Long Call, Closed');
    await expectDrawers(page, SEVEN, [], 'Today');
    await openDrawer(page, 'Replay');
    const scope = replay(page);
    await expect(sliderValue(scope)).toHaveText('Fri Nov 13 · 10 of 10');
    await expect(headline(scope)).toHaveText('+$1,138.00');
    await expect(going(scope)).toHaveText('Final result: sold out Fri Nov 13.');
    await expect(stake(scope)).toHaveText('Nothing is at risk and nothing is left to gain. +$478.00 of the result was banked before the end.');
    // "Final result" stands in place of the first two groups.
    await expect(scope.locator('.replay-readout-group h3')).toHaveText(['Final result', 'Marks', 'Position', 'The Plan']);
    await expect(readoutValue(scope, 'Trade P&L')).toHaveText('+$1,138.00');
    await expect(readoutValue(scope, 'Banked')).toHaveText('+$1,138.00');
    expect(await chartText(pnlChart(scope))).toEqual(expect.arrayContaining(['Banked +$478', 'Banked +$1,138', 'Sold 2 at $4.00']));
    const table = await openTable(scope);
    await expect(tableRow(table, 'Fri Nov 13').locator('td')).toHaveText(['104.60', '$4.91', '+$1,138.00', '+$1,138.00', ...Array<string>(8).fill('Not applicable: no open position'), '$0.80', '$4.00', 'Sold 2 at $4.91']);
    // The session before the last is not final: it keeps its own headline and what is still at stake.
    await seek(page, scope, 'ArrowLeft');
    await expect(sliderValue(scope)).toHaveText('Thu Nov 12 · 9 of 10');
    await expect(headline(scope)).toHaveText('+$982.00 · 3.03R');
    await expect(going(scope)).toHaveText('Target reached, $26.00 past it.');
    await expect(scope.locator('.replay-readout-group h3').first()).toHaveText('How it is going');
    await expectNoPayoffOrTheory(page);
    await context.close();
  });

  test('should end R-DALE-U at Fri 11-20 with no Mark while Settlement Due, then with a Final result once its Expiration is recorded', async ({ profile }) => {
    test.setTimeout(420_000);
    // Marks to Thu 11-19 are saved while the put is open; the Detail is then read on Mon 11-23, with the put expired and not yet recorded.
    const built = await build(profile, DALE, closeOf('2026-11-19'), 13, 0);
    await built.context.close();
    const { context, page } = await openDetailAt(profile, MON_1123_1700, built.trade);
    await expect(detail.settlementDueHeading(page)).toBeVisible(READY);
    await expectDrawers(page, SEVEN, [], 'Today');
    await openDrawer(page, 'Replay');
    let scope = replay(page);
    // Settlement Due ends at the expiration session, valued by nothing (no Mark that day), and nothing is final.
    await expect(sliderValue(scope)).toHaveText('Fri Nov 20 · 15 of 15');
    await expect(headline(scope)).toHaveText('Mark missing: DALE Nov 20 $57.50 Put, Fri Nov 20');
    await expect(going(scope)).toHaveText('No Mark.');
    await expect(scope).not.toContainText('Final result');
    await expect(scope.locator('.replay-readout-group h3')).toHaveText(['How it is going', 'At stake from here, whole Position', 'Marks', 'Position', 'The Plan']);
    await expectNoPayoffOrTheory(page);
    // Thu 11-19, the last session with a Mark: the put is worth $0.00 and the Trade is ahead, with the Stop and Target as the Plan set them.
    await seek(page, scope, 'ArrowLeft');
    await expect(sliderValue(scope)).toHaveText('Thu Nov 19 · 14 of 15');
    await expect(headline(scope)).toHaveText('+$564.00 · 0.37R');

    // Recording the Expiration closes the Trade by expiration: the replay now ends on a final session, Expired.
    await detail.recordExpirationLink(page).click();
    await recordExpiration(page);
    await page.getByRole('link', { name: 'Back to the Trade' }).click();
    await expect(detail.heading(page, 'DALE')).toBeVisible(READY);
    await expectDrawers(page, SEVEN, [], 'Today');
    await openDrawer(page, 'Replay');
    scope = replay(page);
    await expect(sliderValue(scope)).toHaveText('Fri Nov 20 · 15 of 15');
    await expect(headline(scope)).toHaveText('+$564.00');
    await expect(going(scope)).toHaveText('Final result: the put expired Fri Nov 20.');
    await expect(stake(scope)).toHaveText('Nothing is at risk and nothing is left to gain.');
    await expect(scope.locator('.replay-readout-group h3')).toHaveText(['Final result', 'Marks', 'Position', 'The Plan']);
    expect(await chartText(pnlChart(scope))).toContain('Expired');
    const table = await openTable(scope);
    await expect(tableRow(table, 'Fri Nov 20').locator('td').last()).toHaveText('Expired');
    await expectNoPayoffOrTheory(page);
    await context.close();
  });

  test('should show no Replay drawer on a Planned Trade, and Plan and Risk selected', async ({ profile }) => {
    test.setTimeout(240_000);
    const { context, page } = await buildPlanned(profile, BREN, closeOf('2026-11-02'));
    await expectDrawers(page, ['Plan and Risk', 'Journal', 'Payoff'], ['Today', 'Replay', 'Position', 'Price History'], 'Plan and Risk');
    await expect(page.locator('#drawer-panel-replay')).toHaveCount(0);
    await expect(page.locator('.replay-card')).toHaveCount(0);
    await context.close();
  });
});
