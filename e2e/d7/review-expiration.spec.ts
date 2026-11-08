import type { Page } from '@playwright/test';
import {
  completion, createSettlementFixture, debtsOf, enterMark, expect, factsOf, firstPage, FRIDAY_NOV, FRIDAY_NOV_1700, launchAt, onboardedAt, openReview, openSettlement, probe, recordExpiration, reloadReview, test,
  tradesOf, TUESDAY_1030, workspaceOf,
} from './support.ts';

test.use({ actionTimeout: 15_000 });

const OWED_GROUP = 'Trades with owed reflections';
const owedItem = (page: Page, tradeId: string) => page.getByRole('list', { name: OWED_GROUP }).locator(`li.review-card[data-trade-id="${tradeId}"]`);

test.describe('B7.3 Expiration from the Review', () => {
  test('should record T-1 expiration from its card Settlement panel with Close Review Reflect later and return with Back to the Review, to find T-1 under owed reflections, T-3 still showing the assignment explanation and the Review Incomplete, with one Expiration fact and one Debt stored', async ({ profile }) => {
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
    const blockers = page.getByRole('list', { name: 'Blockers' });
    await expect(blockers).toContainText('Settlement Due for XYZ 20 Nov 2026 55 Call, which expired Fri Nov 20');
    await expect(blockers).toContainText('Settlement Due for MNO 20 Nov 2026 45 Put, which expired Fri Nov 20');
    await enterMark(page, t1, FRIDAY_NOV, '52.00');

    // T-1's card Settlement panel names the contract and the long-contract explanation; Record expiration opens the form.
    const panel = await openSettlement(page, t1);
    await expect(panel).toContainText('XYZ 20 Nov 2026 55 Call');
    await expect(panel).toContainText("If it was exercised, this release can't record the exercise yet, so this Review stays incomplete until a later release can");
    await panel.getByRole('link', { name: 'Record expiration' }).click();
    await expect(page).toHaveURL(/\/record-expiration\?from=review/);
    await recordExpiration(page);

    // The receipt returns to the Review, which has no Refresh Review.
    await expect(page.getByRole('button', { name: 'Refresh Review' })).toHaveCount(0);
    await page.getByRole('link', { name: 'Back to the Review' }).click();
    await expect(page.getByRole('heading', { name: 'Review', level: 1 })).toBeVisible();
    await reloadReview(page);

    // T-1 is under the owed reflections; T-3 still shows the assignment explanation; the Review is Incomplete.
    await expect(page.getByRole('heading', { name: OWED_GROUP })).toBeVisible();
    await expect(owedItem(page, t1.tradeId)).toHaveCount(1);
    const second = await openSettlement(page, t3);
    await expect(second).toContainText("If it was assigned, this release can't record the assignment yet, so this Review stays incomplete until a later release can");
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
