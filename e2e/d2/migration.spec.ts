import type { Page } from '@playwright/test';
import {
  BASE_URL,
  checkForUpdate,
  confirmD1Plan,
  expect,
  fillPlan,
  firstPage,
  identity,
  notice,
  onboardedD1Page,
  openPlanned,
  PLAN,
  PLANNED,
  probe,
  READY,
  NOW_ROW,
  recordEntry,
  reloadFromNotice,
  rootOf,
  sawUpdatingMessage,
  SECOND_PLAN,
  spawnedBrowser,
  test,
  watchForUpdatingMessage,
  withoutStamps,
  workspaceNames,
  type ProbedDatabase,
} from './support.ts';

// The stores a database held before the update, without its IndexedDB version number, which the
// migrator raises to close old connections (D1 amendment).
const storesOf = (db: ProbedDatabase | undefined) => (db ? { stores: db.stores, indexes: db.indexes } : undefined);

// Both Plans in the Planned list.
async function expectBothPlans(page: Page): Promise<void> {
  await openPlanned(page);
  await expect(page.getByRole('row', { name: /XYZ/ })).toBeVisible(READY);
  await expect(page.getByRole('row', { name: /ABC/ })).toBeVisible();
}

// The authoritative records the D1 release wrote, compared with what the migrated database holds.
const AUTHORITATIVE = ['catalog', 'trades', 'journalEntries'] as const;
const authoritative = (db: ProbedDatabase) => Object.fromEntries(AUTHORITATIVE.map((store) => [store, withoutStamps(db.stores[store])]));

test.describe('B2.3 update from D1 with data', () => {
  test('should show the migration message, then list both Plans under Planned with Record entry working and About at schema 2, on a new database with the old one gone', async ({
    server,
    profile,
  }) => {
    server.use('dist-releases/d1');
    const context = await profile.launch();
    await watchForUpdatingMessage(context);
    const page = await onboardedD1Page(context);
    await confirmD1Plan(page, PLAN);
    await confirmD1Plan(page, SECOND_PLAN);
    // The update's Reload reloads the page it is on: the Trades view.
    await page.goto('/');
    await expect(page.getByRole('row', { name: /ABC/ })).toBeVisible(READY);
    const before = await probe(page);
    const oldDatabase = rootOf(before).current;

    server.use('dist-releases/d2');
    expect(await checkForUpdate(page)).toEqual({ waiting: 'installed' });
    await reloadFromNotice(page);
    await expectBothPlans(page);
    expect(await sawUpdatingMessage(page)).toBe(true);

    await page.getByRole('row', { name: /XYZ/ }).getByRole('link', { name: 'XYZ', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'XYZ', level: 1 })).toBeVisible();
    await recordEntry(page, NOW_ROW);
    await page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'About' }).click();
    await expect(page.locator('.identity')).toHaveText(identity('d2'));
    await expect(page.locator('dt:has-text("Schema version") + dd')).toHaveText('2');

    const after = await probe(page);
    const { current, candidates } = rootOf(after);
    expect(current).not.toBe(oldDatabase);
    expect(workspaceNames(after)).toEqual([current]);
    expect(candidates).toEqual([]);
    await context.close();
  });
});

test.describe('B2.4 Migration Blocked (faults build)', () => {
  test('should show Migration Blocked with "Your data is unchanged" and Retry, leave the old stores unchanged with no candidate, and show the Plans after the fault is cleared and Retry pressed', async ({
    server,
    profile,
  }) => {
    server.use('dist-releases/d1');
    const context = await profile.launch();
    const page = await onboardedD1Page(context);
    await confirmD1Plan(page, PLAN);
    await confirmD1Plan(page, SECOND_PLAN);
    // The D1 release ignores the parameter; the update's Reload keeps it, so the faults build
    // launches with it.
    await page.goto('/?faults=migration:validate');
    await expect(page.getByRole('row', { name: /ABC/ })).toBeVisible(READY);
    const before = await probe(page);
    const oldDatabase = rootOf(before).current;

    server.use('dist-faults');
    expect(await checkForUpdate(page)).toEqual({ waiting: 'installed' });
    await reloadFromNotice(page);
    await expect(page.getByRole('heading', { name: 'Your journal could not be converted to this release' })).toBeVisible(READY);
    await expect(page.getByText('Your data is unchanged.')).toBeVisible();
    await expect(page.getByRole('button')).toHaveText(['Retry']);

    const blocked = await probe(page);
    expect(storesOf(blocked[oldDatabase])).toEqual(storesOf(before[oldDatabase]));
    expect(rootOf(blocked)).toEqual({ current: oldDatabase, candidates: [] });
    expect(workspaceNames(blocked)).toEqual([oldDatabase]);

    await page.evaluate(() => window.__tjFaults?.set([]));
    await page.getByRole('button', { name: 'Retry' }).click();
    await expectBothPlans(page);
    await context.close();
  });
});

test.describe('B2.5 old tab during migration', () => {
  test('should show "Updated in another tab" in the old tab with its values on screen, return RuntimeNotWritable on Confirm, and write nothing to the old database after the snapshot', async ({
    server,
    profile,
  }) => {
    server.use('dist-releases/d1');
    const context = await profile.launch();
    const tabA = await onboardedD1Page(context);
    await confirmD1Plan(tabA, PLAN);
    const tabB = await context.newPage();
    await tabB.goto('/');
    await expect(tabB.getByRole('row', { name: /XYZ/ })).toBeVisible(READY);
    await tabA.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'New Plan' }).click();
    await fillPlan(tabA, SECOND_PLAN);
    const before = await probe(tabA);
    const oldDatabase = rootOf(before).current;

    server.use('dist-releases/d2');
    expect(await checkForUpdate(tabB)).toEqual({ waiting: 'installed' });
    await expect(notice(tabB)).toContainText('The update waits because another tab has unsaved work.');
    // The race the D1 amendment closes: the update activates while tab A still holds unsaved
    // values. Tab B sends the waiting release the same message its Reload button sends, as a tab
    // that had not yet heard of tab A's unsaved form would.
    const reloaded = tabB.waitForEvent('load');
    await tabB.evaluate(async () => (await navigator.serviceWorker.getRegistration())!.waiting!.postMessage({ type: 'ApplyUpdate' }));
    await reloaded;
    await expect(tabB.getByText('No open trades. Recording an entry on a Planned Trade opens it.')).toBeVisible(READY);

    await expect(notice(tabA)).toContainText('Updated in another tab: reload when ready');
    await expect(tabA.getByLabel('Symbol')).toHaveValue('ABC');
    await expect(tabA.getByLabel('Why this trade, why now?')).toHaveValue('Second Plan thesis.');
    await tabA.getByRole('button', { name: 'Confirm Plan' }).click();
    // RuntimeNotWritable: the D1 shell explains that this tab can no longer save, and keeps the values.
    await expect(tabA.getByRole('region', { name: "Read only: this browser can't save right now" })).toBeVisible();
    await expect(notice(tabA)).toContainText('Updated in another tab: reload when ready');
    await expect(tabA.getByRole('heading', { name: 'New Plan' })).toBeVisible();
    await expect(tabA.getByLabel('Symbol')).toHaveValue('ABC');

    const after = await probe(tabB);
    const { current } = rootOf(after);
    expect(current).not.toBe(oldDatabase);
    // The old database is retired: either deleted or holding exactly the stores of the snapshot.
    if (after[oldDatabase]) expect(storesOf(after[oldDatabase])).toEqual(storesOf(before[oldDatabase]));
    expect(authoritative(after[current]!)).toEqual(authoritative(before[oldDatabase]!));
    await context.close();
  });
});

test.describe('B2.6 kill during migration (faults build)', () => {
  test('should complete the migration on relaunch without faults, with the pre-update data and no candidate database', async ({
    server,
    profile,
  }) => {
    test.setTimeout(120_000);
    server.use('dist-releases/d1');
    let before: Record<string, ProbedDatabase>;
    const killed = await spawnedBrowser(profile.dir, 9335);
    try {
      const page = await onboardedD1Page(killed.context);
      await confirmD1Plan(page, PLAN);
      await confirmD1Plan(page, SECOND_PLAN);
      await page.goto(`${BASE_URL}/?faults=migration:hold`);
      await expect(page.getByRole('row', { name: /ABC/ })).toBeVisible(READY);
      before = await probe(page);

      server.use('dist-faults');
      expect(await checkForUpdate(page)).toEqual({ waiting: 'installed' });
      await reloadFromNotice(page);
      // The migrator has copied and validated the candidate and now waits before activating.
      await expect(page.getByRole('status')).toHaveText('Updating your journal to this release…', READY);
    } finally {
      await killed.kill();
    }

    const relaunched = await spawnedBrowser(profile.dir, 9336);
    try {
      const page = await firstPage(relaunched.context);
      expect(relaunched.context.pages().map((p) => p.url())).toEqual(['about:blank']);
      await page.goto(`${BASE_URL}${PLANNED}`);
      await expect(page.getByRole('row', { name: /XYZ/ })).toBeVisible(READY);
      await expect(page.getByRole('row', { name: /ABC/ })).toBeVisible();
      const after = await probe(page);
      const { current, candidates } = rootOf(after);
      expect(current).not.toBe(rootOf(before).current);
      expect(candidates).toEqual([]);
      expect(workspaceNames(after)).toEqual([current]);
      expect(authoritative(after[current]!)).toEqual(authoritative(before[rootOf(before).current]!));
    } finally {
      await relaunched.kill();
    }
  });
});
