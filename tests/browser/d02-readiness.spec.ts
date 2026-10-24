import { mkdir, writeFile } from 'node:fs/promises';
import { test, expect } from './fixtures';
import { onboard, confirmPlan } from './helpers';
import { fillOpening, authority } from './d02-helpers';
declare global { interface Window { d2Fault: string; d2RepairCache?: () => Promise<void> } }
for (const flow of ['Opening', 'Debt'] as const) test(`D2-B03 ${flow} native readiness, abort, unreadable-store and safe retry matrix`, async ({ page, browserName, context }) => {
  test.setTimeout(120000);
  await page.addInitScript(() => {
    window.d2Fault = '';
    const transaction: IDBDatabase['transaction'] = Reflect.get(IDBDatabase.prototype, 'transaction');
    IDBDatabase.prototype.transaction = function (...args: Parameters<IDBDatabase['transaction']>) {
      const names = typeof args[0] === 'string' ? [args[0]] : Array.from(args[0]);
      if (window.d2Fault.includes('transaction') && names.length === 1 && names[0] === 'diagnostic') throw new DOMException('Injected diagnostic failure', 'QuotaExceededError');
      if (window.d2Fault === 'unreadable' && names.includes('roots')) throw new DOMException('Injected unreadable existing root', 'UnknownError');
      return transaction.apply(this, args);
    };
    const estimate = navigator.storage.estimate.bind(navigator.storage);
    Object.defineProperty(StorageManager.prototype, 'estimate', { value: async () => window.d2Fault === 'missing-estimate' ? {} : window.d2Fault.includes('capacity') ? { ...await estimate(), quota: 0 } : estimate() });
    const control = Object.getOwnPropertyDescriptor(ServiceWorkerContainer.prototype, 'controller');
    if (!control?.get) throw new Error('Native service worker controller getter required');
    Object.defineProperty(ServiceWorkerContainer.prototype, 'controller', { get: function (this: ServiceWorkerContainer) { return window.d2Fault.includes('control') ? null : control.get?.call(this) as ServiceWorker | null; } });
    const add: IDBObjectStore['add'] = Reflect.get(IDBObjectStore.prototype, 'add');
    IDBObjectStore.prototype.add = function (value: unknown, key?: IDBValidKey) {
      if (window.d2Fault === 'abort' && value && typeof value === 'object' && 'kind' in value && value.kind === 'JournalObligation') this.transaction.abort();
      return add.call(this, value, key);
    };
  });
  await onboard(page); await confirmPlan(page); await fillOpening(page, 'Defer');
  if (flow === 'Debt') { await page.getByRole('button', { name: 'Save initial Position Change' }).click(); await page.getByRole('button', { name: 'Answer reflection' }).click(); await page.getByLabel('As Planned', { exact: true }).check(); await page.getByLabel('Calm', { exact: true }).check(); await page.getByLabel('Decision confidence').selectOption('4'); }
  const saveName = flow === 'Opening' ? 'Save initial Position Change' : 'Save Debt outcome';
  const before = await authority(page); const results: unknown[] = [];
  for (const fault of ['transaction', 'capacity', 'control', 'inventory', 'capacity+control', 'missing-estimate', 'abort']) {
    if (fault === 'inventory') await page.evaluate(async () => {
      const name = (await caches.keys()).find(name => name.startsWith('trade-journal-release-')); if (!name) throw new Error('Cache required');
      const cache = await caches.open(name); const original = await cache.match('/icon.svg'); if (!original) throw new Error('Original asset required');
      window.d2RepairCache = () => cache.put('/icon.svg', original); await cache.put('/icon.svg', new Response('Injected corrupt asset'));
    });
    await page.evaluate(value => { window.d2Fault = value; }, fault);
    await page.getByRole('button', { name: saveName }).click(); await expect(page.getByRole('heading', { name: 'Recovery Only', exact: true })).toBeVisible({ timeout: 15000 });
    const issues = await page.locator('[data-issue]').evaluateAll(elements => elements.map(element => element.getAttribute('data-issue')));
    if (fault === 'capacity+control') expect(issues).toEqual(expect.arrayContaining(['capacity', 'control']));
    else expect(issues).toContain(fault === 'missing-estimate' ? 'capacity' : fault === 'abort' ? 'StorageFailure' : fault);
    expect(await authority(page)).toEqual(before);
    results.push({ fault, issues, unchanged: true, controller: await page.evaluate(() => navigator.serviceWorker.controller?.scriptURL) });
    await page.evaluate(async () => { window.d2Fault = ''; if (window.d2RepairCache) { await window.d2RepairCache(); delete window.d2RepairCache; } });
    await page.getByRole('button', { name: 'Retry startup' }).click(); await expect(page.getByRole('button', { name: saveName })).toBeEnabled();
  }
  await page.evaluate(() => { window.d2Fault = 'unreadable'; }); await page.getByRole('button', { name: saveName }).click(); await expect(page.getByRole('heading', { name: 'IntegrityBlocked', exact: true })).toBeVisible(); await expect(page.getByRole('button', { name: 'Create Workspace' })).toHaveCount(0);
  await page.evaluate(() => { window.d2Fault = ''; }); expect(await authority(page)).toEqual(before); results.push({ fault: 'unreadable', unchanged: true });
  await page.getByRole('button', { name: 'Retry startup' }).click(); await expect(page.getByRole('button', { name: saveName })).toBeEnabled();
  await page.getByRole('button', { name: saveName }).click(); await expect(page.getByRole('heading', { name: flow === 'Opening' ? 'XYZ · Open' : 'Journal Debt settled', exact: true })).toBeVisible();
  await mkdir('implementation/evidence/d02/native', { recursive: true }); await writeFile(`implementation/evidence/d02/native/${browserName}-${flow.toLowerCase()}-failure-matrix.json`, JSON.stringify({ browser: context.browser()?.version(), before, results, after: await authority(page), quota: await page.evaluate(() => navigator.storage.estimate()) }, null, 2));
});
