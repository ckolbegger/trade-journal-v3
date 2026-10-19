import type { Page } from '@playwright/test';
import { expect, fillPlan, firstPage, onboardedPage, probe, READY, test, workspaceOf } from './support.ts';

// Distinctive values, so any trace of them in storage is unmistakable.
const TYPED = {
  symbol: 'QZXW',
  quantity: '317',
  entry: '41.37',
  stop: '39.11',
  target: '47.93',
  thesis: 'Unsaved thesis marker 7f3a.',
  invalidation: 'Unsaved invalidation marker 9c1d.',
};

function webStorage(page: Page): Promise<string> {
  return page.evaluate(() => JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage } }));
}

test.describe('B1.14 nothing is saved without Save', () => {
  test('should store no Entry, Trade, draft, or Web Storage value after typing, resizing, leaving, and restarting', async ({ server, profile }) => {
    void server;
    const context = await profile.launch();
    const page = await onboardedPage(context);
    const before = workspaceOf(await probe(page));
    await page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'New Plan' }).click();
    await fillPlan(page, TYPED);
    await page.getByRole('combobox', { name: 'Account' }).selectOption({ index: 0 });
    await page.getByRole('combobox', { name: 'Strategy' }).selectOption({ index: 0 });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'Trades' }).click();
    await expect(page.getByText('No planned trades yet')).toBeVisible();
    for (const value of Object.values(TYPED)) expect(await webStorage(page)).not.toContain(value);
    await context.close();

    const relaunched = await profile.launch();
    const again = await firstPage(relaunched);
    await again.goto('/');
    await expect(again.getByText('No planned trades yet')).toBeVisible(READY);
    const probed = await probe(again);
    const workspace = workspaceOf(probed)!;
    expect(workspace.stores['trades']).toEqual([]);
    expect(workspace.stores['journalEntries']).toEqual([]);
    expect(workspace).toEqual(before);
    const everything = JSON.stringify(probed) + (await webStorage(again));
    for (const value of Object.values(TYPED)) expect(everything).not.toContain(value);
    await relaunched.close();
  });
});
