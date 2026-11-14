import type { Page } from '@playwright/test';
import {
  closeTheTrade, confirmOptionPlan, confirmReference, createTrades, currentTradeId, detail, enterMark, expect, FOUR_TRADES, fillRows, firstPage, launchAt, MONDAY, MONDAY_0900, MONDAY_1105, MONDAY_1700, MONDAY_NOV_1700,
  onboardedAt, onboardedPage, openDrawer, openExitForm, openReview, OS, PC1, READY, recordEntry, recordExpiration, recordOptionEntry, sell, test, writeIntegrityFixture,
} from './support.ts';

test.use({ actionTimeout: 15_000 });

// B8P.4 (plan section 7.2): each state shows the drawers A217 names, selects the default drawer A217 names, and shows W4's P&L card. A tab that a state
// does not show is gone: it is not in the tab list, and its panel is not in the DOM (hidden panels included).
type TabName = 'Today' | 'Position' | 'Plan and Risk' | 'Price History' | 'Journal' | 'Payoff';
const PANEL = (name: TabName): string => `#drawer-panel-${name.toLowerCase().replaceAll(' ', '-')}`;

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

const PRICE_HISTORY = /^Price History( \d+)?$/;

test.describe('B8P.4 States', () => {
  test('should show a Settlement Due Detail with Position selected and Settlement Due in the P&L card, then the expired put Closed via expiration with its Result rows', async ({ profile }) => {
    test.setTimeout(420_000);
    // D7's Settlement Due fixture: O-S, 2 short MNO puts at 1.25 (Mon 10:00, fee 1.30), expiring Fri Nov 20; viewed Mon Nov 23 17:00.
    const { context: setup, page: setupPage } = await onboardedAt(profile, MONDAY_0900);
    await confirmOptionPlan(setupPage, OS);
    const tradeId = await currentTradeId(setupPage);
    await setup.close();
    const entering = await launchAt(profile, MONDAY_1105);
    const entryPage = await firstPage(entering);
    await entryPage.goto(`/trades/${tradeId}`);
    await expect(detail.heading(entryPage, 'MNO')).toBeVisible(READY);
    await recordOptionEntry(entryPage, [{ quantity: '2', price: '1.25', fee: '1.30', time: '2026-10-12T10:00' }]);
    await entering.close();

    const context = await launchAt(profile, MONDAY_NOV_1700);
    const page = await firstPage(context);
    await page.goto(`/trades/${tradeId}`);
    await expect(detail.settlementDueHeading(page)).toBeVisible(READY);
    await expectDrawers(page, ['Position', 'Plan and Risk', PRICE_HISTORY, 'Journal', 'Payoff'], ['Today'], 'Position');
    // W4: the contract, then what the figure waits for. W15: the Position drawer's Open P&L reads "Settlement Due". W6: the conditions are not measured.
    await expect(detail.pnlFigure(page)).toHaveText('Settlement Due: MNO 20 Nov 2026 45 Put');
    await expect(detail.pnlLine(page)).toHaveText('Trade P&L once the expiration is recorded');
    await expect(detail.positionOpenPnl(page)).toHaveText('Settlement Due');
    await expect(detail.conditionsSummary(page)).toHaveText('The contract expired, so its conditions are no longer measured.');
    await expect(detail.conditionBlocks(page)).toHaveCount(2);
    await expect(detail.conditionBlocks(page).locator('.condition-why')).toHaveCount(0);
    await expect(detail.recordExpirationLink(page)).toBeVisible();
    await expect(detail.needsYouCard(page).getByText('Nothing needs you now.')).toHaveCount(0);

    // Recording the expiration closes the Trade by expiration: the P&L card turns to the realized P&L (2 x 1.25 x 100 - 1.30 = $248.70, 0.69R of 1R $360.00).
    await detail.recordExpirationLink(page).click();
    await recordExpiration(page);
    await page.getByRole('link', { name: 'Back to the Trade' }).click();
    await expect(detail.heading(page, 'MNO')).toBeVisible(READY);
    await expectDrawers(page, ['Position', 'Plan and Risk', PRICE_HISTORY, 'Journal 1 owed', 'Payoff'], ['Today'], 'Position');
    await expect(detail.lifecycleBadge(page)).toHaveText('Cash-Secured Put, Closed');
    await expect(detail.identityCard(page).getByText('Expired Fri 20 Nov 2026', { exact: true })).toBeVisible();
    await expect(detail.pnlFigure(page)).toHaveText('$248.70');
    await expect(detail.pnlLine(page)).toHaveText('+0.69R realized, final');
    await expect(detail.resultValue(page, 'Terminal Disposition')).toHaveText('Closed via expiration of 2 contracts');
    await expect(detail.resultValue(page, 'Option Disposition Timing')).toContainText('Fully held to expiration');
    // Gone: an expiration has no Close Reason, and the Settlement Due panel and the entry and exit actions no longer exist anywhere.
    await expect(detail.anywhere(() => detail.resultValue(page, 'Close Reason'))).toHaveCount(0);
    await expect(detail.anywhere(() => detail.settlementDuePanel(page))).toHaveCount(0);
    await expect(detail.anywhere(() => detail.recordExitLink(page))).toHaveCount(0);
    // The Close Review was left for later, so the rail lists it as owed.
    await expect(detail.closeReviewOwedHeading(page)).toBeVisible();
    await expect(detail.conditionsSummary(page)).toHaveCount(0);
    await context.close();
  });

  test('should show a Trade Closed by sale, a stock Trade and a Trade with two open lots each with its drawers and P&L card', async ({ profile }) => {
    test.setTimeout(420_000);
    // The four-Trade fixture (D4): XYZ (60 at 50.10 and 40 at 50.30: two open lots), ABC (100 at 30.00), DEF (100 at 40.00, then sold at 44.00).
    const { context: setup, page: setupPage } = await onboardedAt(profile, MONDAY_1700);
    const [xyz, abc, def] = await createTrades(setupPage, FOUR_TRADES);
    await setupPage.goto(`/trades/${def}`);
    await openExitForm(setupPage);
    await fillRows(setupPage, [sell('100', '44.00', '1.00', '2026-10-12T15:00')]);
    await closeTheTrade(setupPage, 'now');
    await setupPage.getByRole('button', { name: 'Save exit' }).click();
    await expect(setupPage.getByRole('heading', { name: 'Exit recorded', level: 1 })).toBeVisible(READY);
    await openReview(setupPage);
    await enterMark(setupPage, 'XYZ', MONDAY, '52.00');
    await enterMark(setupPage, 'ABC', MONDAY, '32.00');
    await setup.close();

    const context = await launchAt(profile, MONDAY_1700);
    const page = await firstPage(context);

    await test.step('Closed by sale: Position selected, the realized P&L and its R, the Result rows, nothing to record', async () => {
      await page.goto(`/trades/${def}`);
      await expect(detail.heading(page, 'DEF')).toBeVisible(READY);
      await expectDrawers(page, ['Position', 'Plan and Risk', PRICE_HISTORY, 'Journal', 'Payoff'], ['Today'], 'Position');
      await expect(detail.lifecycleBadge(page)).toHaveText('Long Stock, Closed');
      // 100 x (44.00 - 40.00) - 1.00 - 1.00 = $398.00; 1R is (40.00 - 38.00) x 100 = $200.00.
      await expect(detail.pnlFigure(page)).toHaveText('$398.00');
      await expect(detail.pnlLine(page)).toHaveText('+1.99R realized, final');
      await expect(detail.resultValue(page, 'Terminal Disposition')).toHaveText('Closed via sale of 100 shares');
      await expect(detail.resultValue(page, 'Close Reason')).toHaveText('Target Reached');
      await expect(detail.anywhere(() => detail.recordExitLink(page))).toHaveCount(0);
      await expect(detail.anywhere(() => detail.recordEntryLink(page))).toHaveCount(0);
      // W5: a Closed Detail's conditions have rows 1 and 2 only, and W6's lines are gone.
      await expect(detail.conditionBlocks(page)).toHaveCount(2);
      await expect(detail.conditionBlocks(page).locator('.condition-why')).toHaveCount(0);
      await expect(detail.conditionBlocks(page).locator('.condition-figure')).toHaveCount(0);
      await expect(detail.conditionsSummary(page)).toHaveCount(0);
      await expect(detail.needsYouCard(page).getByText('Nothing needs you now.')).toBeVisible();
      await expect(detail.positionOpenPnl(page)).toHaveCount(0);
    });

    await test.step('a stock Trade: Today selected, all six drawers, no strike or expiration line, "100 of 100 shares open"', async () => {
      await page.goto(`/trades/${abc}`);
      await expect(detail.heading(page, 'ABC')).toBeVisible(READY);
      await expectDrawers(page, ['Today', 'Position', 'Plan and Risk', PRICE_HISTORY, 'Journal', 'Payoff'], [], 'Today');
      await expect(detail.lifecycleBadge(page)).toHaveText('Long Stock, Open');
      await expect(detail.identityCard(page).getByText(/^(Strike|Expires|Expired)/)).toHaveCount(0);
      // 100 x (32.00 - 30.00) - 1.00 opening fee = $199.00.
      await expect(detail.pnlFigure(page)).toHaveText('$199.00');
      await expect(detail.pnlCard(page)).toContainText('100 of 100 shares open');
      await expect(detail.conditionBlocks(page).locator('.condition-text')).toHaveText(['ABC at or below $28.00', 'ABC at or above $36.00']);
      await expect(page.getByRole('region', { name: /^Marks: / })).toHaveCount(0);
      await expect(page.locator(`${PANEL('Today')} h2:text-is("Where the price sits")`)).toBeVisible();
      // W14: a stock Trade has one Not applicable line, and no chart.
      await openDrawer(page, 'Payoff');
      await expect(detail.payoffDrawer(page)).toContainText('Expiration Payoff: Not applicable: no option expiration');
      await expect(detail.anywhere(() => detail.payoffChart(page))).toHaveCount(0);
    });

    await test.step('a Trade with two open lots: the Position drawer lists both, and the P&L card counts the shares', async () => {
      await page.goto(`/trades/${xyz}`);
      await expect(detail.heading(page, 'XYZ')).toBeVisible(READY);
      await expectDrawers(page, ['Today', 'Position', 'Plan and Risk', PRICE_HISTORY, 'Journal', 'Payoff'], [], 'Today');
      await openDrawer(page, 'Position');
      await expect(detail.openLots(page).locator('tbody tr')).toHaveCount(2);
      await expect(detail.openLots(page).locator('tbody tr').nth(0)).toContainText('60');
      await expect(detail.openLots(page).locator('tbody tr').nth(1)).toContainText('40');
      await expect(detail.positionValue(page)).toHaveText('100 shares of XYZ');
      // 60 x (52.00 - 50.10) + 40 x (52.00 - 50.30) - 2.00 opening fees = 114 + 68 - 2 = $180.00.
      await expect(detail.pnlFigure(page)).toHaveText('$180.00');
      await expect(detail.pnlCard(page)).toContainText('100 of 100 shares open');
    });
    await context.close();
  });

  test('should show an incoherent Detail with the Facts cannot be replayed region, only Position, Plan and Risk and Journal, and Not available in the P&L card', async ({ profile }) => {
    test.setTimeout(240_000);
    // D2's incoherent fixture: an Open Trade whose Execution names a Planned Leg that is not in the Plan, edited into the stored records before launch.
    const setup = await profile.launch();
    const setupPage = await onboardedPage(setup);
    await confirmReference(setupPage);
    await recordEntry(setupPage, PC1);
    await setup.close();
    await writeIntegrityFixture(profile.dir, { kind: 'UnknownPlannedLeg', underlying: 'XYZ' });

    const context = await profile.launch();
    const page = await firstPage(context);
    await page.goto('/');
    await page.getByRole('row', { name: /XYZ/ }).getByRole('link', { name: 'XYZ', exact: true }).click();
    await expect(detail.heading(page, 'XYZ')).toBeVisible(READY);
    await expect(detail.factsIncoherent(page)).toBeVisible();
    await expectDrawers(page, ['Position', 'Plan and Risk', 'Journal'], ['Today', 'Price History', 'Payoff'], 'Position');
    // W4: "Not available", then "Trade P&L"; the card has no figure, no change line and no open line.
    await expect(detail.pnlFigure(page)).toHaveText('Not available');
    await expect(detail.pnlLine(page)).toHaveText('Trade P&L');
    await expect(detail.pnlCard(page)).not.toContainText('shares open');
    await expect(detail.anywhere(() => detail.recordEntryLink(page))).toHaveCount(0);
    await expect(detail.anywhere(() => detail.recordExitLink(page))).toHaveCount(0);
    // W13: one card, "Every entry, newest first", headed "Journal", with the note.
    await openDrawer(page, 'Journal');
    await expect(detail.journal(page).getByRole('heading', { name: 'Journal', level: 3 })).toBeVisible();
    await expect(detail.journal(page)).toContainText('Every entry, newest first');
    await expect(detail.journal(page)).toContainText('Without a replay there are no sessions, so the entries are one list.');
    await expect(detail.journal(page).locator('article.journal-card')).toHaveCount(1);
    await expect(detail.journal(page).getByRole('button', { name: 'Earlier sessions' })).toHaveCount(0);
    await context.close();
  });
});
