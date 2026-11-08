import {
  confirmOptionPlan, currentTradeId, expect, factsOf, firstPage, FRIDAY_NOV_1700, launchAt, MONDAY_0900, MONDAY_1105, MONDAY_NOV_1700, onboardedAt, OS, probe, receiptResult, recordExpiration, recordOptionEntry,
  setClock, test, tradesOf, valueOf, workspaceOf,
} from './support.ts';
import type { Page } from '@playwright/test';

test.use({ actionTimeout: 15_000 });

const PUT = 'MNO 20 Nov 2026 45 Put';
const dueHeading = (page: Page) => page.getByRole('heading', { name: /^Settlement Due/ });

test.describe('B7.4 Settlement Due on Detail', () => {
  test('should show the Settlement Due panel on Friday and on Monday with the Trade Open and no current dollar figures on Monday, then record the expiration to Closed via expiration of 2 contracts, Fully held to expiration', async ({ profile }) => {
    test.setTimeout(240_000);
    // O-S after S1: Sell to open 2 @ 1.25 (Monday 10:00).
    const { context: setup, page: setupPage } = await onboardedAt(profile, MONDAY_0900);
    await confirmOptionPlan(setupPage, OS);
    const tradeId = await currentTradeId(setupPage);
    await setup.close();
    const entering = await launchAt(profile, MONDAY_1105);
    const entryPage = await firstPage(entering);
    await entryPage.goto(`/trades/${tradeId}`);
    await expect(entryPage.getByRole('heading', { name: 'MNO', level: 1 })).toBeVisible();
    await recordOptionEntry(entryPage, [{ quantity: '2', price: '1.25', fee: '1.30', time: '2026-10-12T10:00' }]);
    await entering.close();

    // Friday 17:00: the panel names the contract, the quantity, the expiration and the settlement time; the Trade is still Open.
    const friday = await launchAt(profile, FRIDAY_NOV_1700);
    const page = await firstPage(friday);
    await page.goto(`/trades/${tradeId}`);
    await expect(dueHeading(page)).toBeVisible();
    const panel = page.getByRole('region', { name: /^Settlement Due/ });
    await expect(valueOf(panel, 'Contract')).toHaveText(PUT);
    await expect(valueOf(panel, 'Quantity')).toHaveText('Short 2 contracts');
    await expect(valueOf(panel, 'Expired')).toHaveText('Fri Nov 20');
    await expect(valueOf(panel, 'Settlement time')).toHaveText('Fri Nov 20, 16:00');
    await expect(panel).toContainText("If it was assigned, this release can't record the assignment yet, so this Trade stays open until a later release can.");
    await expect(page.locator('header').getByText('Open', { exact: true })).toBeVisible();
    await friday.close();

    // Monday 17:00, after a relaunch: the same panel and lifecycle; no current dollar figure, each saying why.
    const monday = await launchAt(profile, MONDAY_NOV_1700);
    const again = await firstPage(monday);
    await again.goto(`/trades/${tradeId}`);
    await expect(dueHeading(again)).toBeVisible();
    await expect(again.locator('header').getByText('Open', { exact: true })).toBeVisible();
    for (const term of ['Open P&L', 'Current Marked Trade P&L', 'Risk to stop', 'Reward to target']) {
      await expect(valueOf(again, term)).toHaveText(`Settlement Due: ${PUT}`);
    }
    await expect(valueOf(again, "Value at expiration at MNO's latest close")).toHaveText(`Settlement Due: ${PUT}`);

    // Record the expiration: the Trade closes by expiration and is fully held to it.
    await setClock(monday, again, MONDAY_NOV_1700, `/trades/${tradeId}`);
    await again.getByRole('link', { name: 'Record expiration' }).click();
    await recordExpiration(again);
    await expect(valueOf(receiptResult(again), 'Lifecycle')).toHaveText('Closed');
    await again.getByRole('link', { name: 'Back to the Trade' }).click();
    await expect(again.getByRole('heading', { name: 'MNO', level: 1 })).toBeVisible();
    await expect(valueOf(again, 'Terminal Disposition')).toHaveText('Closed via expiration of 2 contracts');
    await expect(valueOf(again, 'Option Disposition Timing')).toContainText('Fully held to expiration');
    await expect(dueHeading(again)).toHaveCount(0);
    await monday.close();

    // Durable state, after a relaunch: Closed, with one Expiration and no Execution beyond the sale.
    const relaunched = await launchAt(profile, MONDAY_NOV_1700);
    const detail = await firstPage(relaunched);
    await detail.goto(`/trades/${tradeId}`);
    await expect(valueOf(detail, 'Terminal Disposition')).toHaveText('Closed via expiration of 2 contracts');
    const stored = tradesOf(workspaceOf(await probe(detail))!)[0]!;
    expect(stored.lifecycle).toBe('Closed');
    expect(factsOf(stored, 'Expiration')).toHaveLength(1);
    expect(factsOf(stored, 'Execution')).toHaveLength(1);
    await relaunched.close();
  });
});
