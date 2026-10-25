import type { Page } from '@playwright/test';
import { confirmReference, expect, factsOf, onboardedPage, PC1, PLAN, probe, READY, recordEntry, test, tradesOf, workspaceOf } from './support.ts';

// The Trade Detail, never the entry form: its heading, its Executions, and no Save entry.
async function expectTradeDetail(page: Page, tradeId: string): Promise<void> {
  expect(new URL(page.url()).pathname).toBe(`/trades/${tradeId}`);
  await expect(page.getByRole('heading', { name: PLAN.symbol, level: 1 })).toBeVisible(READY);
  await expect(page.getByRole('region', { name: 'Executions (2)' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Record entry', level: 1 })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Save entry' })).toHaveCount(0);
}

test.describe('reload after save', () => {
  test('should replace the entry form history entry with the Trade Detail once saved, so reload, Back and Forward never show the form', async ({
    server,
    profile,
  }) => {
    void server;
    const context = await profile.launch();
    const page = await onboardedPage(context);
    await confirmReference(page);
    const tradeId = new URL(page.url()).pathname.split('/').pop()!;

    await recordEntry(page, PC1);
    // The receipt stays on screen in place while the URL already names the Trade.
    await expect(page.getByRole('heading', { name: 'Entry recorded' })).toBeVisible();
    expect(new URL(page.url()).pathname).toBe(`/trades/${tradeId}`);

    await page.reload();
    await expectTradeDetail(page, tradeId);
    await page.goBack();
    await expectTradeDetail(page, tradeId);
    await page.goForward();
    await expectTradeDetail(page, tradeId);

    const trades = tradesOf(workspaceOf(await probe(page))!);
    expect(factsOf(trades[0]!, 'PositionChange')).toHaveLength(1);
    await context.close();
  });
});
