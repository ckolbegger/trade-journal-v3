import {
  BASE_URL,
  confirmReference,
  detail,
  expect,
  factsOf,
  firstPage,
  onboardedPage,
  openDrawer,
  openTradeFromOpenList,
  PC1,
  probe,
  recordEntry,
  reflectionEntriesOf,
  spawnedBrowser,
  test,
  tradesOf,
  workspaceOf,
} from './support.ts';

test.describe('B2.7 kill after commit', () => {
  test('should keep the Position Change, its Executions, lifecycle Open, and the reflection after the browser is killed once the result renders', async ({
    server,
    profile,
  }) => {
    void server;
    const killed = await spawnedBrowser(profile.dir, 9337);
    try {
      const page = await onboardedPage(killed.context);
      await confirmReference(page);
      // recordEntry returns once the receipt has rendered.
      await recordEntry(page, PC1);
    } finally {
      await killed.kill();
    }

    const relaunched = await spawnedBrowser(profile.dir, 9338);
    try {
      const page = await firstPage(relaunched.context);
      await page.goto(`${BASE_URL}/`);
      await openTradeFromOpenList(page);
      await expect(detail.lifecycleBadge(page)).toHaveText('Open');
      await openDrawer(page, 'Position');
      await expect(detail.executions(page, 2).getByRole('button')).toHaveCount(2);
      await openDrawer(page, 'Journal');
      await expect(detail.journal(page).getByRole('heading', { name: 'Position Change Reflection' })).toBeVisible();

      const workspace = workspaceOf(await probe(page))!;
      const [trade] = tradesOf(workspace);
      expect(trade!.lifecycle).toBe('Open');
      expect(factsOf(trade!, 'PositionChange')).toHaveLength(1);
      expect(factsOf(trade!, 'Execution')).toHaveLength(2);
      expect(reflectionEntriesOf(workspace)).toHaveLength(1);
    } finally {
      await relaunched.kill();
    }
  });
});
