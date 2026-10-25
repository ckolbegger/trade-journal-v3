import type { Page } from '@playwright/test';
import {
  backToTrade,
  confirmReference,
  expect,
  firstPage,
  onboardedPage,
  openTradeFromOpenList,
  PC1,
  PC2,
  recordEntry,
  test,
} from './support.ts';

const region = (page: Page, name: string) => page.getByRole('region', { name, exact: true });

test.describe('B2.8 offline cold restart', () => {
  test('should open Writable offline, record PC2, and keep it across another offline restart', async ({ server, profile }) => {
    const online = await profile.launch();
    const first = await onboardedPage(online);
    await confirmReference(first);
    await recordEntry(first, PC1);
    await online.close();
    // Network disabled: offline emulation plus no server for the origin at all.
    await server.close();

    const offline = await profile.launch({ offline: true });
    const page = await firstPage(offline);
    await page.goto('/');
    await openTradeFromOpenList(page);
    await expect(page.getByRole('region', { name: /Read only/ })).toHaveCount(0);
    await recordEntry(page, PC2);
    await backToTrade(page);
    await expect(region(page, 'Entry Quality')).toContainText('$270.00 (1.08R)');
    await offline.close();

    const again = await profile.launch({ offline: true });
    const reopened = await firstPage(again);
    await reopened.goto('/');
    await openTradeFromOpenList(reopened);
    await expect(region(reopened, 'Position')).toContainText('100 shares of XYZ');
    await expect(region(reopened, 'Executions (3)').getByRole('button')).toHaveCount(3);
    await reopened.getByRole('button', { name: /^Buy 40 XYZ @ .* 11:00 details$/ }).click();
    await expect(region(reopened, 'Executions (3)')).toContainText('2026-10-12 11:00 · 1 Execution');
    await expect(region(reopened, 'Entry Quality')).toContainText('$270.00 (1.08R)');
    await again.close();
  });
});
