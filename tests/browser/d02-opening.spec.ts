import AxeBuilder from '@axe-core/playwright';
import { writeFile, mkdir } from 'node:fs/promises';
import { fillOpening, authority } from './d02-helpers';
import { test, expect } from './fixtures';
import { onboard, confirmPlan } from './helpers';
declare global { interface Window { d2Trace: { at: number; event: string; transaction: number; mode?: string; stores?: string[]; kind?: string }[] } }
test('D2-B01 complete two-Execution opening, native commit trace and fully stopped offline reopen', async ({ page, context, playwright, browserName, profilePath, baseURL }) => {
  await page.addInitScript(() => {
    window.d2Trace = []; let ordinal = 0; const ids = new WeakMap<IDBTransaction, number>();
    const original: IDBDatabase['transaction'] = Reflect.get(IDBDatabase.prototype, 'transaction');
    IDBDatabase.prototype.transaction = function (...args: Parameters<IDBDatabase['transaction']>) {
      const tx = original.apply(this, args); const id = ++ordinal; ids.set(tx, id);
      window.d2Trace.push({ at: performance.now(), event: 'begin', transaction: id, mode: tx.mode, stores: Array.from(tx.objectStoreNames) });
      tx.addEventListener('complete', () => window.d2Trace.push({ at: performance.now(), event: 'complete', transaction: id }));
      tx.addEventListener('abort', () => window.d2Trace.push({ at: performance.now(), event: 'abort', transaction: id })); return tx;
    };
    const add: IDBObjectStore['add'] = Reflect.get(IDBObjectStore.prototype, 'add');
    IDBObjectStore.prototype.add = function (value: unknown, key?: IDBValidKey) {
      if (value && typeof value === 'object' && 'kind' in value) window.d2Trace.push({ at: performance.now(), event: 'add', transaction: ids.get(this.transaction) ?? -1, kind: String(value.kind) });
      return add.call(this, value, key);
    };
  });
  await onboard(page); await confirmPlan(page); await fillOpening(page);
  const sourceBefore = await authority(page) as { versions: { version: string; kind: string }[] };
  const storageBefore = await page.evaluate(() => navigator.storage.estimate());
  await page.evaluate(() => { window.d2Trace = []; new MutationObserver(() => { if (document.querySelector('h1')?.textContent === 'XYZ · Open' && !window.d2Trace.some(event => event.event === 'ui-success')) window.d2Trace.push({ at: performance.now(), event: 'ui-success', transaction: -1 }); }).observe(document.body, { childList: true, subtree: true }); });
  await page.getByRole('button', { name: 'Save initial Position Change' }).click();
  await expect(page.getByRole('heading', { name: 'XYZ · Open' })).toBeVisible(); await expect(page.getByText('$523.00', { exact: true })).toBeVisible(); await expect(page.getByText('$977.00', { exact: true })).toBeVisible();
  const trace = await page.evaluate(() => window.d2Trace);
  const write = trace.find(event => event.event === 'add' && event.kind === 'PositionChange'); if (!write) throw new Error('Native write trace required');
  expect(trace.filter(event => event.transaction === write.transaction && event.event === 'add').map(event => event.kind).sort()).toEqual(['PositionChange', 'Execution', 'Execution', 'Agreement', 'TradeState', 'JournalObligation', 'JournalEntry'].sort());
  const committed = trace.find(event => event.transaction === write.transaction && event.event === 'complete'); const rendered = trace.find(event => event.event === 'ui-success');
  expect(committed).toBeTruthy(); expect(rendered).toBeTruthy(); expect(committed?.at).toBeLessThanOrEqual(rendered?.at ?? -1);
  expect(trace.filter(event => event.event === 'begin' && event.mode === 'readonly' && event.stores?.includes('versions') && event.at > (committed?.at ?? Infinity))).toHaveLength(0);
  const before = await authority(page);
  const observed = before as { versions: { version: string; kind: string }[] };
  const additions = observed.versions.filter(row => !sourceBefore.versions.some(prior => prior.version === row.version));
  const resource = { storageBefore, storageAfter: await page.evaluate(() => navigator.storage.estimate()), additions: additions.map(row => ({ kind: row.kind, serializedBytes: new TextEncoder().encode(JSON.stringify(row)).byteLength })), totalAddedSerializedBytes: new TextEncoder().encode(JSON.stringify(additions)).byteLength };
  await mkdir('implementation/evidence/d02/native', { recursive: true });
  await writeFile(`implementation/evidence/d02/native/${browserName}-commit-trace.json`, JSON.stringify({ browser: context.browser()?.version(), secure: await page.evaluate(() => isSecureContext), trace, before, resource }, null, 2));
  await context.close(); const offline = await playwright[browserName].launchPersistentContext(profilePath, { headless: true, baseURL, offline: true });
  try { const reopened = await offline.newPage(); await reopened.goto('/'); await reopened.getByRole('button', { name: 'Open', exact: true }).click(); await reopened.getByRole('button', { name: /XYZ · Open/ }).click(); await expect(reopened.getByText('$523.00', { exact: true })).toBeVisible(); expect(await authority(reopened)).toEqual(before); } finally { await offline.close(); }
});
test('D2-B02 Defer/Decline, original Debt answer/decline and cancelled facts', async ({ page }) => {
  await onboard(page); await confirmPlan(page); await fillOpening(page, 'Defer'); const beforeCancel = await authority(page);
  await page.getByRole('button', { name: 'Cancel', exact: true }).click(); await page.reload(); expect(await authority(page)).toEqual(beforeCancel);
  await page.getByRole('button', { name: /XYZ · Planned/ }).click(); await fillOpening(page, 'Defer'); await page.getByRole('button', { name: 'Save initial Position Change' }).click();
  await expect(page.getByRole('heading', { name: 'XYZ · Open' })).toBeVisible(); await expect(page.getByRole('heading', { name: 'Position Change Reflection · Journal Debt' })).toBeVisible();
  await page.getByRole('button', { name: 'Journal Debt', exact: true }).click(); await page.getByRole('button', { name: 'Answer reflection', exact: true }).click();
  await page.getByLabel('As Planned', { exact: true }).check(); await page.getByLabel('Calm', { exact: true }).check(); await page.getByLabel('Decision confidence').selectOption('5'); await page.getByRole('button', { name: 'Save Debt outcome' }).click();
  await expect(page.getByText('Reflection completed. Journal Debt settled.')).toBeVisible();
  await confirmPlan(page); await fillOpening(page, 'Decline'); await page.getByRole('button', { name: 'Save initial Position Change' }).click(); await expect(page.getByRole('heading', { name: 'Position Change Reflection · Explicit decline' })).toBeVisible();
  await confirmPlan(page); await fillOpening(page, 'Defer'); await page.getByRole('button', { name: 'Save initial Position Change' }).click(); await page.getByRole('button', { name: 'Answer reflection', exact: true }).click(); await page.getByLabel('Decline owed reflection').check(); await page.getByRole('button', { name: 'Save Debt outcome' }).click(); await expect(page.getByText('Reflection explicitly declined. Journal Debt settled.')).toBeVisible();
});
test('D2-B03 same-store competing tabs preserve losing input and explicit conflict review', async ({ page, context }) => {
  await onboard(page); await confirmPlan(page);
  const other = await context.newPage(); await other.goto('/'); await other.getByRole('button', { name: /XYZ · Planned/ }).click();
  await fillOpening(page, 'Defer'); await fillOpening(other, 'Defer');
  await page.getByRole('button', { name: 'Save initial Position Change' }).click(); await expect(page.getByRole('heading', { name: 'XYZ · Open' })).toBeVisible();
  await other.getByRole('button', { name: 'Save initial Position Change' }).click(); await expect(other.getByRole('button', { name: 'Review current Trade' })).toBeVisible();
  expect(await other.getByLabel('Execution 2 quantity (shares)').inputValue()).toBe('60'); expect(await authority(other)).toEqual(await authority(page));
  await other.getByRole('button', { name: 'Review current Trade' }).click(); await expect(other.getByRole('button', { name: 'Save initial Position Change' })).toBeDisabled(); await other.close();
});
test('D2-B04 accessible validation and live responsive preservation at 390/767/768/1440', async ({ page, browserName }) => {
  await page.setViewportSize({ width: 390, height: 900 }); await onboard(page); await confirmPlan(page); await fillOpening(page);
  await page.getByLabel('Execution 2 quantity (shares)').fill('59'); await page.getByRole('button', { name: 'Save initial Position Change' }).click(); await expect(page.getByText('Executions must total exactly the frozen planned quantity.')).toBeVisible();
  expect(await page.evaluate(() => document.activeElement?.textContent)).toBe('Review before continuing');
  for (const width of [1440, 767, 768, 390]) { await page.setViewportSize({ width, height: 900 }); expect(await page.getByLabel('Execution 2 quantity (shares)').inputValue()).toBe('59'); expect(await page.getByLabel('As Planned', { exact: true }).isChecked()).toBe(true); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); }
  await page.getByLabel('Execution 2 quantity (shares)').fill('60');
  const results = await new AxeBuilder({ page }).analyze(); expect(results.violations).toEqual([]);
  await page.screenshot({ path: `implementation/evidence/d02/native/${browserName}-opening-390.png`, fullPage: true });
  await page.getByRole('button', { name: 'Save initial Position Change' }).click(); await expect(page.getByRole('heading', { name: 'XYZ · Open' })).toBeVisible();
});
