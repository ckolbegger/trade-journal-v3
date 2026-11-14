import type { Page } from '@playwright/test';
import type { DrawerName } from '../support/detail/index.ts';
import { buildOc3, detail, expect, openDetailAt, openDrawer, test, THURSDAY_1800 } from './support.ts';

test.use({ actionTimeout: 15_000 });

// B8P.1 (plan section 7.2): O-C3 created through the UI with section 5's Marks, clock Thu 2026-10-15 18:00 New York, the Detail open.
// Figures are section 5's table at Thursday (Trade P&L $218.05, "+$30.00 since Wed Oct 14", 1 contract of 2 open), and W5's distances from them:
// the call's Mark 3.20 to the option Stop at 1.00 is $2.20 x 100 = $220.00 (1R is $200.00, so 1.10R); XYZ's Mark 57.90 to the Target at 60.00 moves the
// call from 3.20 to its 5.00 at expiration, +$180.00 (0.90R); the worst case is the call expiring worthless, 98.70 - 200.65 = -101.95 against 218.05.
const TABS = ['Today', 'Position', 'Plan and Risk', 'Price History', 'Journal', 'Payoff'] as const satisfies readonly DrawerName[];
const PANEL = (name: DrawerName): string => `#drawer-panel-${name.toLowerCase().replaceAll(' ', '-')}`;

// The cards of each drawer, by their headings (a drawer's content appears once; the unselected drawers are mounted and hidden, T8P.5-B1).
const HEADINGS: Record<'Today' | 'Position' | 'Plan and Risk' | 'Payoff', readonly string[]> = {
  Today: ['marks: thu oct 15 against wed oct 14', 'where the prices sit'],
  Position: ['position', 'lot matches', 'fee reconciliation', 'executions (2)'],
  'Plan and Risk': ['plan', 'plan baseline', 'entry quality'],
  Payoff: ['expiration payoff'],
};

// Card headings and label terms of the Detail, outside the two drawers whose cards repeat a session's figures by design (Price History's columns
// and the Journal cards, P99 and W10), counted across every drawer, hidden ones included.
const labelCounts = (page: Page) =>
  page.evaluate(() => {
    const root = document.querySelector('.trade-detail')!;
    const counts = new Map<string, number>();
    for (const element of root.querySelectorAll('h2, dt')) {
      if (element.closest('#drawer-panel-journal') || element.closest('#drawer-panel-price-history')) continue;
      const key = `${element.tagName.toLowerCase()}: ${(element.textContent ?? '').trim().toLowerCase()}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return Object.fromEntries(counts);
  });

test.describe('B8P.1 The cockpit', () => {
  test('should show the rail with W2, W3, W5 and W7, the tabs in W1 order moved by the arrow keys, each drawer holding its content once, and every condition with its status', async ({ profile }) => {
    test.setTimeout(420_000);
    const trade = await buildOc3(profile, { thursdayHold: true });
    const { context, page } = await openDetailAt(profile, THURSDAY_1800, trade);

    await test.step('the rail answers without opening a drawer (W2, W3, W5, W7)', async () => {
      const rail = page.getByRole('region', { name: 'State of play' });
      await expect(rail).toBeVisible();
      // W2: the identity card (days from Thu Oct 15 to Fri Dec 18 are 16 + 30 + 18 = 64).
      await expect(detail.heading(page, 'XYZ')).toBeVisible();
      await expect(detail.lifecycleBadge(page)).toHaveText('Long Call, Open');
      const identity = detail.identityCard(page);
      await expect(identity.getByText('Strike 55', { exact: true })).toBeVisible();
      await expect(identity.getByText('Expires Fri 18 Dec 2026 (64 days)', { exact: true })).toBeVisible();
      await expect(identity.getByText('Fidelity — Roth IRA', { exact: true })).toBeVisible();
      await expect(detail.recordEntryLink(page)).toBeVisible();
      await expect(detail.recordExitLink(page)).toBeVisible();
      // W3: the P&L card.
      await expect(detail.pnlCard(page)).toBeVisible();
      await expect(detail.pnlFigure(page)).toHaveText('$218.05');
      await expect(detail.pnlLine(page)).toHaveText('+$30.00 since Wed Oct 14');
      await expect(detail.pnlCard(page)).toContainText('1 of 2 contracts open');
      // W5: Plan order (the option Stop, then the XYZ Target), each with its role, "nearest", figure, condition and its change in Trade P&L.
      await expect(detail.conditionBlocks(page)).toHaveCount(2);
      const stop = detail.conditionBlocks(page).nth(0);
      await expect(stop.locator('.condition-role')).toHaveText('Stop');
      await expect(stop.getByText('nearest', { exact: true })).toBeVisible();
      await expect(stop.locator('.condition-figure')).toHaveText('−$220.00');
      await expect(stop.locator('.condition-text')).toHaveText('Option at or below $1.00');
      await expect(stop.locator('.condition-why')).toHaveText("Change in Trade P&L from the Thu Oct 15 Marks if the option's Mark is $1.00 (−1.10R).");
      const target = detail.conditionBlocks(page).nth(1);
      await expect(target.locator('.condition-role')).toHaveText('Target');
      await expect(target.getByText('nearest', { exact: true })).toBeVisible();
      await expect(target.locator('.condition-figure')).toHaveText('+$180.00');
      await expect(target.locator('.condition-text')).toHaveText('XYZ at or above 60.00');
      await expect(target.locator('.condition-why')).toHaveText('Change in Trade P&L from the Thu Oct 15 Marks if XYZ is at 60.00 at expiration (+0.90R).');
      // W6: the lines beneath.
      await expect(detail.conditionsSummary(page).getByRole('listitem')).toHaveText(['Worst case: $320.00 · 1.60R if the call expires worthless', 'Max reward: Unbounded above']);
      // W7: the owed exit reflection with its due text and Reflect now. Nothing is breached or reached, so no alert, and the empty line is gone.
      const needs = detail.needsYouCard(page);
      await expect(needs.getByRole('heading', { name: 'Position Change Reflection Reflection owed', level: 3 })).toBeVisible();
      await expect(needs.getByText('Due', { exact: true }).first()).toBeVisible();
      await expect(detail.reflectNowButton(page)).toBeVisible();
      await expect(needs.getByText('Nothing needs you now.')).toHaveCount(0);
      await expect(needs.getByText(/^Stop breached|^Target reached/)).toHaveCount(0);
    });

    await test.step('the tabs follow W1 and the arrow keys move between them', async () => {
      const tabs = page.getByRole('tablist', { name: 'Detail' });
      await expect(tabs.getByRole('tab')).toHaveText(['Today', 'Position', 'Plan and Risk', 'Price History 1', 'Journal 1 owed', 'Payoff']);
      const tab = (name: DrawerName) => tabs.getByRole('tab', { name, exact: true });
      await expect(tab('Today')).toHaveAttribute('aria-selected', 'true');
      await tab('Today').focus();
      for (const name of TABS.slice(1)) {
        await page.keyboard.press('ArrowRight');
        await expect(tab(name)).toHaveAttribute('aria-selected', 'true');
        await expect(tab(name)).toBeFocused();
        await expect(page.locator(PANEL(name))).toBeVisible();
      }
      await page.keyboard.press('ArrowLeft');
      await expect(tab('Journal')).toHaveAttribute('aria-selected', 'true');
      await page.keyboard.press('Home');
      await expect(tab('Today')).toBeFocused();
      await expect(tab('Today')).toHaveAttribute('aria-selected', 'true');
      await page.keyboard.press('End');
      await expect(tab('Payoff')).toBeFocused();
      await expect(tab('Payoff')).toHaveAttribute('aria-selected', 'true');
      // Only the selected drawer shows: the others are present and hidden, not gone.
      for (const name of TABS) {
        await expect(page.locator(PANEL(name))).toHaveCount(1);
        if (name === 'Payoff') await expect(page.locator(PANEL(name))).toBeVisible();
        else await expect(page.locator(PANEL(name))).toBeHidden();
      }
      await page.keyboard.press('Home');
    });

    await test.step('each drawer holds its content once (C8P.2, with its accepted repeats)', async () => {
      for (const [name, headings] of Object.entries(HEADINGS) as [keyof typeof HEADINGS, readonly string[]][]) {
        await openDrawer(page, name);
        expect((await page.locator(`${PANEL(name)} h2`).allTextContents()).map((text) => text.trim().toLowerCase()), `${name} cards`).toEqual(headings);
      }
      const counts = await labelCounts(page);
      const repeated = Object.entries(counts).filter(([, n]) => n > 1).map(([key]) => key).sort();
      // Accepted repeats (C8P.2): the Position drawer's Incurred fees beside the Fee reconciliation, and Entry Quality's reward : risk beside the Plan
      // Baseline's. Every other card heading and term stands once, in the drawer that owns it, hidden drawers included.
      expect(repeated).toEqual(['dt: incurred fees', 'dt: reward : risk']);
      // W14: one chart and its two text-equivalent tables, each once.
      await expect(detail.anywhere(() => detail.payoffChart(page))).toHaveCount(1);
      await expect(detail.anywhere(() => detail.payoff(page, 'Planned'))).toHaveCount(1);
      await expect(detail.anywhere(() => detail.payoff(page, 'Current'))).toHaveCount(1);
      // Spot checks of gone-from-the-wrong-drawer: content that lives in one drawer is not in another.
      await expect(page.locator(`${PANEL('Position')} dt:text-is("1R (original risk)")`)).toHaveCount(0);
      await expect(page.locator(`${PANEL('Plan and Risk')} dt:text-is("Realized to date")`)).toHaveCount(0);
      await expect(page.locator(`${PANEL('Today')} h2:text-is("Plan Baseline")`)).toHaveCount(0);
      await expect(page.locator(`${PANEL('Payoff')} dt:text-is("Open P&L")`)).toHaveCount(0);
      // The Position drawer's own figures, from section 5's executions: Open P&L +$119.35 (the open lot's opening fee included), Realized to date +$98.70.
      await openDrawer(page, 'Position');
      await expect(detail.positionOpenPnl(page)).toHaveText('+$119.35');
      await expect(detail.positionRealizedToDate(page)).toHaveText('+$98.70');
      await expect(detail.oneR(page)).toHaveCount(0);
      await openDrawer(page, 'Plan and Risk');
      await expect(detail.oneR(page)).toHaveText('$200.00');
    });

    await test.step('every condition is listed with its status (AC-CALC-003)', async () => {
      // The Plan holds two conditions, and the rail lists both with a status word or a distance in each row.
      await openDrawer(page, 'Plan and Risk');
      await expect(detail.riskToStop(page)).toHaveText('$220.00 · 1.10R');
      await expect(detail.rewardToTarget(page)).toHaveText('$180.00 · 0.90R');
      const blocks = detail.conditionBlocks(page);
      await expect(blocks).toHaveCount(2);
      for (const block of await blocks.all()) {
        await expect(block.locator('.condition-role')).toHaveText(/^(Stop|Target)$/);
        await expect(block.locator('.condition-figure')).toHaveText(/^(−\$|\+\$)[\d,]+\.\d\d$|^(Breached|Reached)$/);
        await expect(block.locator('.condition-text')).not.toBeEmpty();
      }
    });
    await context.close();
  });
});
