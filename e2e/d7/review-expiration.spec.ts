import type { Page } from '@playwright/test';
import {
  completion, createSettlementFixture, dayLine, debtsOf, enterMark, expect, factsOf, firstPage, FRIDAY_NOV, FRIDAY_NOV_1700, launchAt, onboardedAt, openReview, openExpiration, probe, recordExpirationInCard, reloadReview, test,
  tradesOf, TUESDAY_1030, workspaceOf,
} from './support.ts';

test.use({ actionTimeout: 15_000 });

const OWED_GROUP = 'Trades with owed reflections';
const owedItem = (page: Page, tradeId: string) => page.getByRole('list', { name: OWED_GROUP }).locator(`li.review-card[data-trade-id="${tradeId}"]`);

test.describe('B7.3 Expiration from the Review', () => {
  test('should record T-1 expiration from its card expiration block, with the Close Review put off, and return with Back to the Review, to find T-1 under owed reflections, T-3 still showing its expiration block and the Review Incomplete, with one Expiration fact and one Debt stored', async ({ profile }) => {
    test.setTimeout(300_000);
    const { context: setup, page: setupPage } = await onboardedAt(profile, TUESDAY_1030);
    const { t1, t3 } = await createSettlementFixture(setupPage);
    await setup.close();

    // Friday 17:00: open the Review and enter XYZ's Mark.
    const context = await launchAt(profile, FRIDAY_NOV_1700);
    const page = await firstPage(context);
    await page.goto('/');
    await openReview(page);
    await expect(completion(page)).toHaveText('Incomplete');
    await expect(dayLine(page, 'XYZ').first()).toContainText('Settle');
    await expect(dayLine(page, 'MNO')).toContainText('Settle');
    await enterMark(page, t1, FRIDAY_NOV, '52.00');

    // T-1's card has no Action: its block says where the call finished (XYZ at $52.00, under its $55.00 strike). Record expiration opens the form in the card.
    const block = await openExpiration(page, t1);
    await expect(block).toContainText('Expired Fri Nov 20 · no Action needed');
    await expect(block).toContainText('XYZ $52.00, below the $55.00 strike: expired worthless.');
    // The choices stand in a row at 1280 wide and in one column at a real 375-wide viewport, with the same buttons and nothing scrolling sideways.
    const choices = ['Record expiration', 'Sold it before the close'].map((name) => block.getByRole('button', { name, exact: true }));
    const boxes = async () => (await Promise.all(choices.map((choice) => choice.boundingBox()))).map((box) => box!);
    await page.setViewportSize({ width: 1280, height: 900 });
    const [wideMain, wideSale] = await boxes();
    expect(Math.round(wideSale!.y), 'one row at 1280').toBe(Math.round(wideMain!.y));
    await page.setViewportSize({ width: 375, height: 812 });
    const [narrowMain, narrowSale] = await boxes();
    expect(Math.round(narrowSale!.x), 'one column at 375').toBe(Math.round(narrowMain!.x));
    expect(narrowSale!.y, 'the sale choice under the main button at 375').toBeGreaterThan(narrowMain!.y + narrowMain!.height - 1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'no sideways scroll at 375').toBe(true);
    await page.setViewportSize({ width: 1280, height: 900 });
    await recordExpirationInCard(block, 'Record expiration');
    await expect(page).toHaveURL(/\/review/);

    // The receipt returns to the Review, which has no Refresh Review.
    await expect(page.getByRole('button', { name: 'Refresh Review' })).toHaveCount(0);
    await block.getByRole('button', { name: 'Back to the Review' }).click();
    await expect(page.getByRole('heading', { name: 'Review', level: 1 })).toBeVisible();
    await reloadReview(page);

    // T-1 is under the owed reflections; T-3 still shows its block, with no price and the assignment to record later; the Review is Incomplete.
    await expect(page.getByRole('heading', { name: OWED_GROUP })).toBeVisible();
    await expect(owedItem(page, t1.tradeId)).toHaveCount(1);
    const second = await openExpiration(page, t3);
    await expect(second).toContainText("No price for MNO, so the app can't say where it finished. What happened?");
    await expect(second.getByRole('button', { name: 'Assigned: record later' })).toBeVisible();
    await expect(completion(page)).toHaveText('Incomplete');
    await context.close();

    // Durable state, after a relaunch: one Expiration fact and one Debt (the deferred Close Review).
    const relaunched = await launchAt(profile, FRIDAY_NOV_1700);
    const again = await firstPage(relaunched);
    await again.goto('/');
    await openReview(again);
    await expect(completion(again)).toHaveText('Incomplete');
    const workspace = workspaceOf(await probe(again))!;
    const expirations = tradesOf(workspace).flatMap((trade) => factsOf(trade, 'Expiration').map((fact) => ({ tradeId: trade.tradeId, fact })));
    expect(expirations.map((e) => e.tradeId)).toEqual([t1.tradeId]);
    const debts = debtsOf(workspace) as unknown as { obligationKey: string; versions: { status: string }[] }[];
    expect(debts).toHaveLength(1);
    expect(debts[0]!.obligationKey).toBe(`CloseReview:${t1.tradeId}`);
    expect(debts[0]!.versions.at(-1)!.status).toBe('Outstanding');
    await relaunched.close();
  });
});
