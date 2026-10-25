import { mkdir, writeFile } from 'node:fs/promises';
import { test, expect } from './fixtures';
import { requireWritable } from './helpers';
import type { Root, Envelope, LifecycleRow } from '../../src/infrastructure/storage';
import type { TradeSnapshot } from '../../src/domain/trade-record';
declare global { interface Window { d2Legacy: { createAt(name: string): Promise<{ root: Root; confirmed: { trade: TradeSnapshot }; versions: Envelope[]; lifecycle: LifecycleRow[] }> }; d2MigrationBlocker?: IDBDatabase; d2MigrationFault?: string } }
async function setup(page: import('@playwright/test').Page, name: string) {
  await requireWritable(page); await page.addScriptTag({ path: '.cache/d2-legacy-native/legacy.js' }); await page.addScriptTag({ path: '.cache/browser-generator/generator.js' });
  return page.evaluate(name => window.d2Legacy.createAt(name), name);
}
for (const mode of ['candidate-seed', 'candidate-validation', 'activation-abort'] as const) test(`D2-I03 native ${mode} preserves source and activates only a complete retry`, async ({ page, browserName, context }) => {
  const name = `d2-legacy-${crypto.randomUUID()}`; const before = await setup(page, name);
  await page.evaluate(mode => {
    window.d2MigrationFault = mode;
    const add: IDBObjectStore['add'] = Reflect.get(IDBObjectStore.prototype, 'add');
    IDBObjectStore.prototype.add = function (value: unknown, key?: IDBValidKey) { if (window.d2MigrationFault === 'candidate-seed' && value && typeof value === 'object' && 'id' in value && value.id === 'position-change-reflection') throw new DOMException('Injected candidate-seed failure', 'QuotaExceededError'); if (window.d2MigrationFault === 'candidate-validation' && value && typeof value === 'object' && 'kind' in value && value.kind === 'Plan') { const row = value as Envelope; const trade = row.value as TradeSnapshot; return add.call(this, { ...row, value: { ...trade, plan: { ...trade.plan, quantity: '99' } } }, key); } return add.call(this, value, key); };
    const put: IDBObjectStore['put'] = Reflect.get(IDBObjectStore.prototype, 'put');
    IDBObjectStore.prototype.put = function (value: unknown, key?: IDBValidKey) { if (window.d2MigrationFault === 'activation-abort' && this.name === 'roots' && value && typeof value === 'object' && 'schema' in value && value.schema === 2) this.transaction.abort(); return put.call(this, value, key); };
  }, mode);
  const failed = await page.evaluate(name => window.d2Evidence.migrateDatabase(name), name); expect(failed).toMatchObject({ status: 'MigrationBlocked', unchangedRevision: before.root.revision });
  const afterFailure = await page.evaluate(name => new Promise<{ root: unknown; versions: unknown[]; lifecycle: unknown[] }>((resolve, reject) => { const request = indexedDB.open(name); request.onerror = () => reject(request.error ?? new Error('Source read failed')); request.onsuccess = () => { const db = request.result; const tx = db.transaction(['roots', 'versions', 'lifecycle']); const root = tx.objectStore('roots').get('active'); const versions = tx.objectStore('versions').getAll(); const lifecycle = tx.objectStore('lifecycle').getAll(); tx.oncomplete = () => { resolve({ root: root.result as unknown, versions: versions.result as unknown[], lifecycle: lifecycle.result as unknown[] }); db.close(); }; }; }), name);
  expect(afterFailure.root).toEqual(before.root);
  expect((afterFailure.versions as Envelope[]).filter(row => row.generation === before.root.generation)).toEqual(before.versions);
  expect((afterFailure.lifecycle as LifecycleRow[]).filter(row => row.generation === before.root.generation)).toEqual(before.lifecycle);
  await page.evaluate(() => { window.d2MigrationFault = ''; });
  const retry = await page.evaluate(name => window.d2Evidence.migrateDatabase(name), name); expect(retry).toMatchObject({ status: 'Opened', root: { schema: 2 }, receipt: { migration: { sourceRows: 7, candidateRows: 9 } } });
  await mkdir(`implementation/evidence/bug-001/cumulative/${process.env.BUG001_EVIDENCE_RUN ?? 'manual'}/d02/native`, { recursive: true }); await writeFile(`implementation/evidence/bug-001/cumulative/${process.env.BUG001_EVIDENCE_RUN ?? 'manual'}/d02/native/${browserName}-migration-${mode}.json`, JSON.stringify({ browser: context.browser()?.version(), before, failed, afterFailure, retry }, null, 2));
});
test('D2-I03 native blocked physical upgrade rejects safely and retries after old connection closes', async ({ page, browserName, context }) => {
  const name = `d2-blocked-${crypto.randomUUID()}`; const before = await setup(page, name);
  await page.evaluate(name => new Promise<void>((resolve, reject) => { const request = indexedDB.open(name); request.onerror = () => reject(request.error ?? new Error('Old connection failed')); request.onsuccess = () => { window.d2MigrationBlocker = request.result; window.d2MigrationBlocker.onversionchange = () => {}; resolve(); }; }), name);
  const failed = await page.evaluate(name => window.d2Evidence.migrateDatabase(name), name); expect(failed).toMatchObject({ status: 'RuntimeNotWritable', workspaceStatus: 'IntegrityBlocked' });
  const retained = await page.evaluate(() => new Promise<unknown>((resolve, reject) => { const db = window.d2MigrationBlocker; if (!db) { reject(new Error('Held connection missing')); return; } const tx = db.transaction('roots'); const read = tx.objectStore('roots').get('active'); tx.oncomplete = () => resolve(read.result as unknown); })); expect(retained).toEqual(before.root);
  await page.evaluate(() => { window.d2MigrationBlocker?.close(); delete window.d2MigrationBlocker; });
  const retry = await page.evaluate(name => window.d2Evidence.migrateDatabase(name), name); expect(retry).toMatchObject({ status: 'Opened', root: { schema: 2 } });
  await mkdir(`implementation/evidence/bug-001/cumulative/${process.env.BUG001_EVIDENCE_RUN ?? 'manual'}/d02/native`, { recursive: true }); await writeFile(`implementation/evidence/bug-001/cumulative/${process.env.BUG001_EVIDENCE_RUN ?? 'manual'}/d02/native/${browserName}-migration-blocked.json`, JSON.stringify({ browser: context.browser()?.version(), before, failed, retained, retry }, null, 2));
});
