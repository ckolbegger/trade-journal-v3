import AxeBuilder from '@axe-core/playwright';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { cpus, platform, release } from 'node:os';
import { test, expect } from '../browser/fixtures';
import { onboard, confirmPlan, fillPlan } from '../browser/helpers';
import { authority } from '../browser/d02-helpers';
const output = `implementation/evidence/bug-001/visual/${process.env.BUG001_EVIDENCE_RUN ?? Date.now()}`;
for (const width of [1440, 814, 390]) test(`reference board, modal keyboard and rejected draft journey at ${width}`, async ({ page, context, browserName, profilePath, playwright, baseURL }) => {
  await mkdir(output, { recursive: true }); await page.setViewportSize({ width, height: 900 });
  await page.clock.install({ time: new Date('2026-10-24T20:00:00Z') });
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  const geometry: Record<string, unknown> = {};
  async function capture(name: string) {
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: `${output}/${width}-${name}.png`, fullPage: true });
    geometry[name] = await page.evaluate(() => ({ dpr: devicePixelRatio, width: innerWidth, scrollWidth: document.documentElement.scrollWidth, nav: document.querySelector('nav')?.getBoundingClientRect().toJSON() as unknown, main: document.querySelector('main')?.getBoundingClientRect().toJSON() as unknown, panel: document.querySelector('[role=dialog]')?.getBoundingClientRect().toJSON() as unknown, fonts: Array.from(document.fonts).map(font => ({ family: font.family, status: font.status })), focused: document.activeElement?.outerHTML }));
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    await writeFile(`${output}/${width}-${name}-axe.json`, JSON.stringify(axe)); expect(axe.violations).toEqual([]);
  }
  async function saveWithBusyKeyboardCheck(label: string, scene: string) {
    const before = await authority(page);
    await page.evaluate(() => {
      const estimate = navigator.storage.estimate.bind(navigator.storage);
      const descriptor = Object.getOwnPropertyDescriptor(StorageManager.prototype, 'estimate')!;
      let release = () => {}; const gate = new Promise<void>(resolve => { release = resolve; });
      window.bug001ReleaseSave = () => { Object.defineProperty(StorageManager.prototype, 'estimate', descriptor); release(); };
      Object.defineProperty(StorageManager.prototype, 'estimate', { ...descriptor, value: async () => { await gate; return estimate(); } });
    });
    try {
      await page.getByRole('button', { name: label, exact: true }).click();
      const panel = page.getByRole('dialog'); await expect(panel).toBeFocused();
      await expect(page.getByRole('button', { name: 'Saving…', exact: true })).toBeDisabled();
      expect(await authority(page)).toEqual(before);
      await page.keyboard.press('Tab'); await expect(panel).toBeFocused();
      await page.keyboard.press('Shift+Tab'); await expect(panel).toBeFocused();
      const bottom = await panel.evaluate(element => { element.scrollTop = element.scrollHeight; return element.scrollTop; });
      if (label === 'Save opening entry') expect(bottom).toBeGreaterThan(0);
      if (bottom > 0) { await page.keyboard.press('PageUp'); await expect.poll(() => panel.evaluate(element => element.scrollTop)).toBeLessThan(bottom); }
      await capture(scene);
    } finally { await page.evaluate(() => window.bug001ReleaseSave?.()); }
  }
  await page.goto('/'); await expect(page.getByLabel('Workspace time zone')).toBeVisible(); await capture('setup');
  // Onboard uses this same native profile; no root, readiness or coordinator substitution.
  await onboard(page); await capture('empty');
  await page.getByRole('button', { name: 'Workspace', exact: true }).click(); await capture('workspace');
  await page.getByRole('button', { name: 'New Plan', exact: true }).click(); await capture('plan-stage1-blank');
  await page.getByLabel('Stock symbol').fill('XYZ'); await capture('plan-stage1-filled'); await page.getByRole('button', { name: 'Next: Plan and reflection' }).click(); await capture('plan-stage2-blank'); await page.getByRole('button', { name: 'Confirm Plan' }).click(); await capture('plan-validation');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await fillPlan(page); await capture('plan-stage2-filled'); await page.getByRole('button', { name: 'Confirm Plan' }).click(); await expect(page.getByRole('heading', { name: 'XYZ · Planned' })).toBeVisible(); await capture('planned-detail');
  await page.getByRole('button', { name: /Back to Trades/ }).click(); await expect(page.getByRole('button', { name: /XYZ · Planned/ })).toBeVisible(); await capture('planned-list');
  if (width === 1440) {
    expect(await page.getByRole('navigation').evaluate(nav => nav.getBoundingClientRect().width)).toBe(240);
    const row = await page.getByRole('button', { name: /XYZ · Planned/ }).boundingBox(); expect(row?.height).toBeGreaterThanOrEqual(66.5); expect(row?.height).toBeLessThanOrEqual(73.5);
    expect(await page.locator('main').evaluate(main => main.clientWidth - 48)).toBe(820);
  }
  await page.getByRole('button', { name: /XYZ · Planned/ }).click();
  await page.getByRole('button', { name: 'Record initial Position Change' }).click();
  const dialog = page.getByRole('dialog', { name: 'Opening entry' }); await capture('opening-blank');
  expect(await page.locator('[inert]').count()).toBe(1);
  if (width === 1440) expect((await dialog.boundingBox())?.width).toBe(440);
  await page.getByLabel('Execution 1 quantity (shares)').fill('100'); await page.getByLabel('Execution 1 price (USD)').fill('50');
  await page.getByRole('button', { name: 'Add another execution' }).click();
  const before = await authority(page);
  await page.getByRole('button', { name: 'Save opening entry' }).click();
  await expect(page.getByText('Nothing saved — Execution 2 needs a quantity and price')).toBeVisible(); expect(await authority(page)).toEqual(before);
  await page.getByRole('button', { name: 'Go to Execution 2 quantity' }).click(); await expect(page.getByLabel('Execution 2 quantity (shares)')).toBeFocused(); await capture('opening-rejected');
  await page.keyboard.press('Escape'); await expect(dialog).toHaveCount(0); await expect(page.getByRole('button', { name: 'Continue unsaved entry' })).toBeFocused();
  await capture('draft-detail');
  await page.getByRole('button', { name: 'Continue unsaved entry' }).click(); await expect(page.getByLabel('Execution 1 quantity (shares)')).toHaveValue('100');
  await expect(page.getByText('Nothing saved — Execution 2 needs a quantity and price')).toBeVisible();
  await page.getByRole('button', { name: 'Remove draft row 2' }).click(); await expect(page.getByLabel('Execution 1 quantity (shares)')).toBeFocused();
  await page.getByLabel('Complete reflection now').check(); await page.getByLabel('As Planned', { exact: true }).check(); await page.getByLabel('Calm', { exact: true }).check(); await page.getByLabel('Decision confidence').selectOption('4'); await page.getByLabel('Note (optional)').fill('Synthetic retained reflection.');
  for (const liveWidth of [767, 768, 1023, 1024, 1440, 390, width]) {
    await page.setViewportSize({ width: liveWidth, height: 900 }); await page.getByLabel('Note (optional)').focus();
    await expect(page.getByLabel('Note (optional)')).toHaveValue('Synthetic retained reflection.');
    expect(await page.locator('nav').evaluate(nav => getComputedStyle(nav).position)).toBe(liveWidth < 1024 ? 'fixed' : 'static');
    await expect(dialog).toHaveCount(1);
    await expect.poll(async () => { const note = await page.getByLabel('Note (optional)').boundingBox(); const footer = await page.getByRole('button', { name: 'Save opening entry' }).boundingBox(); return !!note && !!footer && note.y >= 0 && note.y + note.height <= footer.y; }).toBe(true);
  }
  await page.getByRole('button', { name: 'Cancel', exact: true }).focus(); await page.keyboard.press('Tab'); await expect(page.getByRole('button', { name: 'Close opening entry' })).toBeFocused();
  await page.keyboard.press('Shift+Tab'); await expect(page.getByRole('button', { name: 'Cancel', exact: true })).toBeFocused();
  await expect.poll(async () => { const close = await page.getByRole('button', { name: 'Close opening entry' }).boundingBox(); return !!close && close.y >= 24 && close.y + close.height <= 900; }).toBe(true);
  await capture('opening-filled');
  await saveWithBusyKeyboardCheck('Save opening entry', 'opening-saving-keyboard'); await expect(page.getByRole('heading', { name: 'XYZ · Open' })).toBeVisible(); await capture('open-detail'); await page.getByRole('button', { name: 'Trades', exact: true }).click(); await page.getByRole('button', { name: 'Open', exact: true }).click(); await expect(page.getByRole('button', { name: /XYZ · Open/ })).toBeVisible(); await capture('open-list'); await page.getByRole('button', { name: /XYZ · Open/ }).click();
  await page.getByRole('button', { name: 'View Trade Journal' }).click(); await capture('trade-journal'); await page.getByRole('button', { name: 'Close trade journal' }).click();
  await confirmPlan(page); await page.getByRole('button', { name: 'Record initial Position Change' }).click(); await page.getByLabel('Execution 1 quantity (shares)').fill('100'); await page.getByLabel('Execution 1 price (USD)').fill('50'); await page.getByRole('button', { name: 'Save opening entry' }).click();
  await page.getByRole('button', { name: 'View Trade Journal' }).click(); await expect(page.getByRole('dialog')).toContainText('Position Change Reflection · Journal Debt'); await capture('trade-journal-outstanding'); await page.getByRole('button', { name: 'Close trade journal' }).click();
  await page.getByRole('button', { name: 'Journal Debt', exact: true }).click(); await capture('debt-queue'); await page.getByRole('button', { name: 'Answer reflection', exact: true }).click(); await capture('owed-composer');
  await page.getByLabel('Decline owed reflection').check(); await saveWithBusyKeyboardCheck('Save Debt outcome', 'debt-saving-keyboard'); await expect(page.getByRole('heading', { name: 'Journal Debt settled' })).toBeVisible(); await capture('debt-declined');
  await page.getByRole('button', { name: 'View Trade', exact: true }).click(); await page.getByRole('button', { name: 'View Trade Journal' }).click(); await expect(page.getByRole('dialog')).toContainText('Position Change Reflection · Explicit decline'); await capture('trade-journal-declined'); await page.getByRole('button', { name: 'Close trade journal' }).click();
  const committed = await authority(page);
  await writeFile(`${output}/${width}-environment.json`, JSON.stringify({ browserName, browser: context.browser()?.version(), os: { platform: platform(), release: release(), cpu: cpus()[0]?.model }, profilePath, geometry, errors, inventory: JSON.parse(await readFile('dist/offline-inventory.json', 'utf8')) as unknown, before, committed }, null, 2)); expect(errors).toEqual([]);
  await context.close(); const offline = await playwright[browserName].launchPersistentContext(profilePath, { headless: true, baseURL, offline: true });
  try { const reopened = await offline.newPage(); await reopened.goto('/'); await expect(reopened.getByRole('heading', { name: 'Trades', exact: true })).toBeVisible(); expect(await authority(reopened)).toEqual(committed); } finally { await offline.close(); }
});

declare global { interface Window { bug001ReleaseEstimate?: () => void; bug001RestoreRead?: () => void; bug001ReleaseSave?: () => void } }
for (const width of [1440, 814, 390]) test(`density, Loading, Error and protective states at ${width}`, async ({ page, context }) => {
  await mkdir(output, { recursive: true }); await page.setViewportSize({ width, height: 900 });
  async function capture(name: string) {
    await page.evaluate(() => document.fonts.ready); await page.screenshot({ path: `${output}/${width}-${name}.png`, fullPage: true });
    const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    await writeFile(`${output}/${width}-${name}-axe.json`, JSON.stringify(axe)); expect(axe.violations).toEqual([]);
  }
  await page.addInitScript(() => {
    const native = navigator.storage.estimate.bind(navigator.storage);
    let release = () => {}; const gate = new Promise<void>(resolve => { release = resolve; });
    window.bug001ReleaseEstimate = release;
    Object.defineProperty(StorageManager.prototype, 'estimate', { value: async () => { await gate; return native(); } });
  });
  await page.goto('/'); await expect(page.getByText('Verifying startup and local storage…')).toBeVisible(); await capture('loading');
  await page.evaluate(() => window.bug001ReleaseEstimate?.());
  await page.getByLabel('Workspace time zone').fill('America/New_York'); await page.getByRole('button', { name: 'Create Workspace' }).click();
  await page.getByLabel('Institution name').fill('Synthetic Institution with a deliberately long display label'); await page.getByRole('button', { name: 'Add Institution' }).click();
  await page.getByLabel('New Account name').fill('Synthetic Account with a deliberately long display label'); await page.getByRole('button', { name: 'Add Account' }).click();
  await page.addScriptTag({ path: '.cache/browser-generator/generator.js' });
  expect(await page.evaluate(() => window.d2Evidence.releaseId)).toBe((JSON.parse(await readFile('dist/offline-inventory.json', 'utf8')) as { releaseId: string }).releaseId);
  await page.evaluate(() => window.d1Evidence.generate(10)); await page.getByRole('button', { name: 'Trades', exact: true }).click(); await expect(page.locator('ul li button')).toHaveCount(10); await capture('list-10-long-labels');
  await page.evaluate(() => window.d1Evidence.generate(41)); await page.getByRole('button', { name: 'Trades', exact: true }).click(); await expect(page.locator('ul li button')).toHaveCount(50); await capture('list-50');
  for (let attempt = 0; attempt < 5; attempt++) {
    await page.getByRole('button', { name: 'Trades', exact: true }).click(); await page.getByRole('button', { name: 'Open', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Open Trades', exact: true })).toBeVisible(); await expect(page.getByText('No confirmed Plans match this view.', { exact: true })).toBeVisible(); await expect(page.locator('ul li button')).toHaveCount(0);
    await page.getByRole('button', { name: 'Planned', exact: true }).click(); await expect(page.locator('ul li button')).toHaveCount(50);
  }
  const first = await page.locator('ul li button').first().textContent(); await page.locator('ul li button').first().click(); await page.getByRole('button', { name: /Back to Trades/ }).click(); await expect(page.locator('ul li button')).toHaveCount(50); expect(await page.locator('ul li button').first().textContent()).toBe(first);
  await page.getByRole('button', { name: 'Next 50 Trades' }).click(); await expect(page.locator('ul li button')).toHaveCount(1); await capture('pagination');
  await page.evaluate(() => {
    const native: IDBIndex['openCursor'] = Reflect.get(IDBIndex.prototype, 'openCursor');
    window.bug001RestoreRead = () => { IDBIndex.prototype.openCursor = native; };
    IDBIndex.prototype.openCursor = function (...args) { if (this.name === '[generation+lifecycle+economicOrder+sequence]') throw new DOMException('Injected list read failure', 'UnknownError'); return native.apply(this, args); };
  });
  await page.getByRole('button', { name: 'Trades', exact: true }).click(); await expect(page.getByRole('button', { name: 'Retry list' })).toBeVisible(); await capture('list-error');
  await page.evaluate(() => window.bug001RestoreRead?.()); await page.getByRole('button', { name: 'Retry list' }).click(); await expect(page.locator('ul li button')).toHaveCount(50);
  const before = await authority(page);
  const asset = await page.evaluate(async () => { const name = (await caches.keys()).find(name => name.startsWith('trade-journal-release-')); if (!name) throw new Error('Missing native release cache'); const cache = await caches.open(name); const original = await cache.match('/icon.svg'); if (!original) throw new Error('Missing native asset'); const bytes = Array.from(new Uint8Array(await original.arrayBuffer())); await cache.put('/icon.svg', new Response('Injected corrupt asset')); return { name, bytes }; });
  await page.getByRole('button', { name: 'Workspace', exact: true }).click(); await page.getByLabel('Institution name').fill('Retained reference draft'); await page.getByRole('button', { name: 'Add Institution' }).click(); await expect(page.getByRole('heading', { name: 'Recovery Only', exact: true })).toBeVisible(); expect(await authority(page)).toEqual(before); await capture('recovery');
  await page.evaluate(async asset => { await (await caches.open(asset.name)).put('/icon.svg', new Response(new Uint8Array(asset.bytes))); }, asset);
  await page.getByRole('button', { name: 'Retry startup' }).click(); await expect(page.getByLabel('Institution name')).toHaveValue('Retained reference draft'); expect(await authority(page)).toEqual(before);
  await page.addInitScript(() => { Object.defineProperty(IDBFactory.prototype, 'open', { value: () => { throw new DOMException('Injected unreadable existing store', 'UnknownError'); } }); });
  await page.reload(); await page.evaluate(() => window.bug001ReleaseEstimate?.()); await expect(page.getByRole('heading', { name: 'IntegrityBlocked', exact: true })).toBeVisible(); await capture('integrity-blocked'); await expect(page.getByRole('button', { name: 'Create Workspace' })).toHaveCount(0);
  const witness = await context.newPage(); await witness.goto('/'); expect(await authority(witness)).toEqual(before); await witness.close();
});
for (const width of [1440, 814, 390]) test(`Unsupported remains prominent at ${width}`, async ({ page }) => {
  await mkdir(output, { recursive: true }); await page.setViewportSize({ width, height: 900 });
  await page.addInitScript(() => { const native = navigator.storage.estimate.bind(navigator.storage); Object.defineProperty(StorageManager.prototype, 'estimate', { value: async () => ({ ...await native(), quota: 0 }) }); });
  await page.goto('/'); await expect(page.getByRole('heading', { name: 'Unsupported', exact: true })).toBeVisible();
  await page.screenshot({ path: `${output}/${width}-unsupported.png`, fullPage: true });
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations).toEqual([]);
});
