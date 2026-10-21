import { test, expect } from './fixtures';
import { requireWritable, onboard, confirmPlan, fillPlan } from './helpers';
for (const failures of [['transaction'], ['capacity'], ['control'], ['inventory'], ['capacity', 'inventory']]) {
  test(`D1-B03 D1-I03 fresh native readiness failures ${failures.join('+')}`, async ({ page }) => {
    await requireWritable(page);
    await page.addInitScript(modes => {
      if (modes.includes('transaction')) {
        const original = Object.getOwnPropertyDescriptor(IDBDatabase.prototype, 'transaction')?.value as IDBDatabase['transaction'];
        Object.defineProperty(IDBDatabase.prototype, 'transaction', { value: function (this: IDBDatabase, names: string | string[], mode?: IDBTransactionMode, options?: IDBTransactionOptions) {
          if ((typeof names === 'string' ? [names] : names).length === 1 && (typeof names === 'string' ? names : names[0]) === 'diagnostic') throw new DOMException('Injected quota fault', 'QuotaExceededError');
          return original.call(this, names, mode, options);
        } });
      }
      if (modes.includes('capacity')) {
        const original = navigator.storage.estimate.bind(navigator.storage);
        Object.defineProperty(StorageManager.prototype, 'estimate', { value: async () => ({ ...await original(), quota: 0 }) });
      }
      if (modes.includes('control')) Object.defineProperty(ServiceWorkerContainer.prototype, 'controller', { get: () => null });

    }, failures);
    if (failures.includes('inventory')) await page.evaluate(async () => {
      const name = (await caches.keys()).find(name => name.startsWith('trade-journal-release-'));
      if (!name) throw new Error('Installed cache required');
      const cache = await caches.open(name); await cache.delete('/icon.svg');
    });
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Unsupported', exact: true })).toBeVisible({ timeout: 12000 });
    for (const failure of failures) await expect(page.locator(`[data-issue=${failure}]`)).toBeVisible();
    if (failures.length === 1) await expect(page.locator('main li')).toHaveCount(1);
    const root = await page.evaluate(() => new Promise<unknown>((resolve, reject) => {
      const request = indexedDB.open('trade-journal-v3');
      request.onerror = () => reject(request.error ?? new Error('IndexedDB open failed'));
      request.onsuccess = () => { const db = request.result; const read = db.transaction('roots').objectStore('roots').get('active'); read.onsuccess = () => { resolve(read.result); db.close(); }; read.onerror = () => reject(read.error ?? new Error('IndexedDB read failed')); };
    }));
    expect(root).toBeUndefined();
  });
}
test('D1-B03 D1-I03 native cache failure preserves Recovery Only reads and rejects next mutation', async ({ page }) => {
  await onboard(page); await confirmPlan(page);
  await fillPlan(page);
  const before = await page.evaluate(() => new Promise<unknown>(resolve => {
    const request = indexedDB.open('trade-journal-v3'); request.onsuccess = () => { const db = request.result; const read = db.transaction('roots').objectStore('roots').get('active'); read.onsuccess = () => { resolve(read.result); db.close(); }; };
  }));
  await page.evaluate(async () => {
    const name = (await caches.keys()).find(name => name.startsWith('trade-journal-release-'));
    if (!name) throw new Error('Installed cache required');
    const cache = await caches.open(name); await cache.put('/icon.svg', new Response('corrupt asset'));
  });
  await page.getByRole('button', { name: 'Confirm Plan' }).click();
  await expect(page.getByText('Recovery Only', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'New Plan' })).toBeDisabled();
  await page.getByRole('button', { name: 'Trades', exact: true }).click();
  await page.getByRole('button', { name: /XYZ · Planned/ }).click();
  await expect(page.getByText('View history', { exact: true })).toBeVisible();
  const after = await page.evaluate(() => new Promise<unknown>(resolve => {
    const request = indexedDB.open('trade-journal-v3'); request.onsuccess = () => { const db = request.result; const read = db.transaction('roots').objectStore('roots').get('active'); read.onsuccess = () => { resolve(read.result); db.close(); }; };
  }));
  expect(after).toEqual(before);
});
test('D1-B03 unreadable existing storage is Integrity Blocked and never replaced', async ({ page, context, playwright, browserName, profilePath, baseURL }) => {
  await onboard(page); await confirmPlan(page);
  await page.getByText('View history', { exact: true }).click();
  const fact = await page.getByText(/^Plan fact:/).textContent();
  await page.addInitScript(() => { Object.defineProperty(IDBFactory.prototype, 'open', { value: () => { throw new DOMException('Injected unreadable existing storage', 'UnknownError'); } }); });
  await page.reload();
  await expect(page.getByRole('heading', { name: 'IntegrityBlocked', exact: true })).toBeVisible();
  await expect(page.locator('[data-issue=UnreadableRoot]')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create Workspace' })).toHaveCount(0);
  await context.close();
  const reopened = await playwright[browserName].launchPersistentContext(profilePath, { headless: true, baseURL });
  try {
    const recovered = await reopened.newPage(); await recovered.goto('/');
    await recovered.getByRole('button', { name: /XYZ · Planned/ }).click();
    await recovered.getByText('View history', { exact: true }).click();
    await expect(recovered.getByText(fact ?? 'Missing retained fact')).toBeVisible();
  } finally { await reopened.close(); }
});
