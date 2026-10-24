import type { Page } from '@playwright/test';
import {
  confirmReference,
  expect,
  factsOf,
  firstPage,
  onboardedPage,
  openTradeFromOpenList,
  PC1,
  probe,
  READY,
  recordEntry,
  reflectionEntriesOf,
  test,
  tradesOf,
  workspaceOf,
} from './support.ts';

const region = (page: Page, name: string) => page.getByRole('region', { name, exact: true });

test.describe('B2.9 Recovery Only (faults build)', () => {
  test('should keep the Open list and Detail readable with no Record entry, and leave the stores unchanged', async ({ server, profile }) => {
    void server;
    const setup = await profile.launch();
    const first = await onboardedPage(setup);
    await confirmReference(first);
    await recordEntry(first, PC1);
    const before = await probe(first);
    await setup.close();

    const context = await profile.launch();
    const page = await firstPage(context);
    await page.goto('/?faults=control');
    await expect(page.getByRole('region', { name: "Read only: this browser can't save right now" })).toBeVisible(READY);
    const row = page.getByRole('table', { name: 'Open Trades' }).getByRole('row', { name: /XYZ/ });
    await expect(row).toContainText('60 of 100');
    await openTradeFromOpenList(page);
    await expect(region(page, 'Position')).toContainText('60 shares of XYZ');
    await expect(region(page, 'Entry Quality')).toContainText('Entry not yet resolved: 60 of 100 entered');
    await expect(page.getByRole('link', { name: 'Record entry' })).toHaveCount(0);
    expect(await probe(page)).toEqual(before);
    await context.close();
  });
});

test.describe('B2.10 mid-session failure (faults build)', () => {
  test('should explain RuntimeNotWritable, keep the entry form values, and record no Position Change', async ({ server, profile }) => {
    void server;
    const context = await profile.launch();
    const page = await onboardedPage(context);
    await confirmReference(page);
    await page.getByRole('link', { name: 'Record entry' }).click();
    const row = page.getByRole('group', { name: 'Execution 1', exact: true });
    await row.getByLabel('Quantity').fill('60');
    await row.getByLabel('Price').fill('50.10');
    await row.getByLabel('Fee').fill('1.00');
    await row.getByLabel('Economic Time').fill('2026-10-12T10:00');
    const reflection = page.getByRole('region', { name: 'Position Change Reflection' });
    await reflection.getByRole('radiogroup', { name: 'Decision mode' }).getByLabel('As Planned').check();
    await reflection.getByRole('radiogroup', { name: 'Primary emotion' }).getByLabel('Calm').check();
    await reflection.getByRole('radiogroup', { name: 'Decision confidence' }).getByLabel('4').check();

    await page.evaluate(() => window.__tjFaults?.set(['inventory']));
    await page.getByRole('button', { name: 'Save entry' }).click();

    const banner = page.getByRole('region', { name: "Read only: this browser can't save right now" });
    await expect(banner).toBeVisible();
    await expect(banner.getByRole('listitem')).toHaveText([
      "The app's offline copy is missing or damaged, so it could not reopen without a network.",
    ]);
    await expect(row.getByLabel('Quantity')).toHaveValue('60');
    await expect(row.getByLabel('Price')).toHaveValue('50.10');
    await expect(row.getByLabel('Economic Time')).toHaveValue('2026-10-12T10:00');
    await expect(reflection.getByRole('radiogroup', { name: 'Decision mode' }).getByLabel('As Planned')).toBeChecked();
    const workspace = workspaceOf(await probe(page))!;
    expect(factsOf(tradesOf(workspace)[0]!, 'PositionChange')).toEqual([]);
    expect(reflectionEntriesOf(workspace)).toEqual([]);
    await context.close();
  });
});
