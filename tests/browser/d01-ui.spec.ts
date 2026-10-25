import AxeBuilder from '@axe-core/playwright';
import type { Locator, Page } from '@playwright/test';
import { test, expect } from './fixtures';
import { onboard, fillPlan, requireWritable } from './helpers';
async function tabTo(page: Page, target: Locator) {
  await expect(target).toBeVisible();
  await expect(target).toBeEnabled();
  for (let i = 0; i < 50; i++) {
    if (await target.evaluate(element => element === document.activeElement)) return;
    // Traverse toward the target rather than relying on browser-chrome wrapping.
    // Firefox leaves the last page control focused when Tab enters browser chrome.
    const backwards = await target.evaluate(element => Boolean(document.activeElement && document.activeElement !== document.body && (element.compareDocumentPosition(document.activeElement) & Node.DOCUMENT_POSITION_FOLLOWING)));
    const key = backwards ? 'Shift+Tab' : 'Tab';
    // Option-Tab includes every native control under macOS's text-only preference.
    await page.keyboard.press(page.context().browser()?.browserType().name() === 'webkit' ? `Alt+${key}` : key);
  }
  throw new Error('Control not reachable through the keyboard');
}
test('D1-B02 invalid input, catalog conflict and Cancel preserve input and write no Plan', async ({ page, context }) => {
  await onboard(page); await fillPlan(page);
  await page.getByLabel('Stop (underlying price, USD)').fill('50');
  await page.getByRole('button', { name: 'Confirm Plan' }).click();
  await expect(page.getByRole('alert')).toContainText('Stop must be below intended entry so Planned risk is positive.');
  await page.getByLabel('Stop (underlying price, USD)').fill('45');
  const other = await context.newPage(); await other.goto('/');
  await other.getByRole('button', { name: 'Workspace', exact: true }).click();
  await other.getByLabel('Institution name').fill('Second brokerage');
  await other.getByRole('button', { name: 'Add Institution' }).click();
  await expect(other.getByLabel('Institution name')).toHaveValue('');
  await other.close();
  await page.getByRole('button', { name: 'Confirm Plan' }).click();
  await expect(page.getByRole('alert')).toContainText('Brokerage records changed in another tab.');
  await expect(page.getByLabel('Stock symbol')).toHaveValue('XYZ');
  await page.getByRole('button', { name: 'Review current references' }).click();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('button', { name: 'Trades', exact: true }).click();
  await expect(page.getByText('No confirmed Plans match this view.')).toBeVisible();
  await expect(page.getByRole('button', { name: /Execution|Backup|Restore|Report/ })).toHaveCount(0);
});
test('D1-B02 native transaction abort preserves every participant and entered Plan', async ({ page, context, playwright, browserName, profilePath, baseURL }) => {
  await onboard(page);
  const snapshot = () => page.evaluate(() => new Promise<unknown>((resolve, reject) => {
    const request = indexedDB.open('trade-journal-v3');
    request.onerror = () => reject(request.error ?? new Error('Open failed'));
    request.onsuccess = () => {
      const db = request.result; const transaction = db.transaction(['roots', 'versions', 'lifecycle']);
      const root = transaction.objectStore('roots').getAll(); const versions = transaction.objectStore('versions').getAll(); const lifecycle = transaction.objectStore('lifecycle').getAll();
      transaction.oncomplete = () => { resolve({ roots: root.result, versions: versions.result, lifecycle: lifecycle.result }); db.close(); };
      transaction.onerror = () => reject(transaction.error ?? new Error('Read failed'));
    };
  }));
  const before = await snapshot();
  await page.addInitScript(() => {
    const original = Object.getOwnPropertyDescriptor(IDBObjectStore.prototype, 'add')?.value as IDBObjectStore['add'];
    IDBObjectStore.prototype.add = function (value: unknown, key?: IDBValidKey) {
      if (this.name === 'versions' && typeof value === 'object' && value !== null && 'kind' in value && value.kind === 'JournalEntry') this.transaction.abort();
      return original.call(this, value, key);
    };
  });
  await page.reload(); await fillPlan(page);
  await page.getByRole('button', { name: 'Confirm Plan' }).click();
  await expect(page.getByRole('alert')).toContainText('Saving failed. Nothing was recorded.');
  await expect(page.getByLabel('Stock symbol')).toHaveValue('XYZ');
  await expect(page.getByText('Recovery Only', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Confirm Plan' })).toBeDisabled();
  expect(await snapshot()).toEqual(before);
  await context.close();
  const reopened = await playwright[browserName].launchPersistentContext(profilePath, { headless: true, baseURL });
  try {
    const recovered = await reopened.newPage(); await recovered.goto('/');
    await expect(recovered.getByText('No confirmed Plans match this view.')).toBeVisible();
    await fillPlan(recovered); await recovered.getByRole('button', { name: 'Confirm Plan' }).click();
    await expect(recovered.getByRole('heading', { name: 'XYZ · Planned' })).toBeVisible();
  } finally { await reopened.close(); }
});
for (const width of [390, 1440]) {
  test(`D1-B05 keyboard-only onboarding and Plan, live resize, zoom and axe at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await requireWritable(page);
    await page.evaluate(() => { document.documentElement.style.zoom = '2'; });
    expect(await page.getByRole('heading').evaluate(heading => heading.scrollWidth <= heading.clientWidth)).toBe(true);
    await page.evaluate(() => { document.documentElement.style.zoom = ''; });
    await tabTo(page, page.getByLabel('Workspace time zone')); await page.keyboard.type('America/New_York');
    await tabTo(page, page.getByRole('button', { name: 'Create Workspace' })); await page.keyboard.press('Enter');
    await expect(page.getByLabel('Institution name')).toBeVisible();
    await tabTo(page, page.getByLabel('Institution name')); await page.keyboard.type('Fidelity');
    await tabTo(page, page.getByRole('button', { name: 'Add Institution' })); await page.keyboard.press('Enter');
    await expect(page.getByLabel('New Account name')).toBeVisible();
    await tabTo(page, page.getByLabel('New Account name')); await page.keyboard.type('Taxable');
    await tabTo(page, page.getByRole('button', { name: 'Add Account' })); await page.keyboard.press('Enter');
    await tabTo(page, page.getByRole('button', { name: 'New Plan' })); await page.keyboard.press('Enter');
    await tabTo(page, page.getByRole('button', { name: 'Next: Plan and reflection' })); await page.keyboard.press('Enter');
    for (const [label, value] of [['Stock symbol', 'XYZ'], ['Quantity (shares)', '100'], ['Intended entry (USD)', '50'], ['Stop (underlying price, USD)', '45'], ['Target (underlying price, USD)', '60'], ['Why this trade, why now?', 'Improving earnings'], ['What would invalidate the thesis?', 'Thesis fails']]) { await tabTo(page, page.getByLabel(label)); await page.keyboard.type(value); }
    for (const liveWidth of [767, 768, width]) {
      await page.setViewportSize({ width: liveWidth, height: 900 });
      await expect(page.getByLabel('Stock symbol')).toHaveValue('XYZ');
      expect(await page.getByRole('navigation').evaluate(element => getComputedStyle(element).position)).toBe(liveWidth < 1024 ? 'fixed' : 'static');
    }
    await page.evaluate(() => { document.documentElement.style.zoom = '2'; });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    for (const action of await page.getByRole('navigation').getByRole('button').all()) {
      const bounds = await action.boundingBox();
      expect(bounds).not.toBeNull();
      if (!bounds) throw new Error('Navigation action must be rendered');
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
      if (width < 1024) {
        expect(bounds.y).toBeGreaterThanOrEqual(0);
        expect(bounds.y + bounds.height).toBeLessThanOrEqual(900);
      }
      expect(await action.evaluate(button => button.scrollWidth <= button.clientWidth)).toBe(true);
    }
    await page.screenshot({ path: testInfo.outputPath(`D1-zoom-${width}.png`), fullPage: true });
    await page.evaluate(() => { document.documentElement.style.zoom = ''; });
    const accessibility = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    expect(accessibility.violations).toEqual([]);
    await tabTo(page, page.getByRole('button', { name: 'Confirm Plan' })); await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { name: 'XYZ · Planned' })).toBeVisible();
    await tabTo(page, page.getByText('View history', { exact: true })); await page.keyboard.press('Enter');
    await expect(page.getByText(/^Plan fact:/)).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath(`D1-detail-${width}.png`), fullPage: true });
  });
}
test('D1-B01 explains missing or invalid time zones and creates the Workspace after correction', async ({ page }) => {
  await requireWritable(page);
  for (const zone of ['', 'Invalid/Zone', '-05:00']) {
    await page.getByLabel('Workspace time zone').fill(zone);
    await page.getByRole('button', { name: 'Create Workspace' }).click();
    await expect(page.getByRole('alert')).toContainText('Enter a rules-based time zone, such as America/New_York.');
    await expect(page.getByLabel('Workspace time zone')).toHaveValue(zone);
    await expect(page.getByLabel('Workspace time zone')).toHaveAttribute('aria-invalid', 'true');
    await expect(page.getByRole('heading', { name: 'Choose your time zone' })).toBeFocused();
    expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations).toEqual([]);
  }
  await page.getByLabel('Workspace time zone').fill('America/New_York');
  await page.getByRole('button', { name: 'Create Workspace' }).click();
  await expect(page.getByRole('heading', { name: 'Add your brokerage records' })).toBeVisible();
  await expect(page.getByText('Time zone: America/New_York')).toBeVisible();
});
test('D1-B01 Add Account clearly creates a second Account at the same Institution', async ({ page }) => {
  await onboard(page);
  await page.getByRole('button', { name: 'Workspace', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Add Account', exact: true })).toBeVisible();
  await expect(page.getByText('Create a separate Account under the selected Institution.')).toBeVisible();
  await expect(page.getByLabel('New Account name')).toHaveValue('');
  await page.getByLabel('New Account name').fill('Retirement');
  await page.getByRole('button', { name: 'Add Account', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Trades', exact: true })).toBeVisible();
  await page.reload(); await fillPlan(page);
  const accounts = page.getByRole('combobox', { name: /^Account/ });
  await expect(accounts.getByRole('option')).toHaveText(['Retirement · Fidelity', 'Taxable · Fidelity']);
  await accounts.selectOption({ label: 'Retirement · Fidelity' });
  await page.getByRole('button', { name: 'Confirm Plan' }).click();
  await expect(page.getByRole('heading', { name: 'XYZ · Planned' })).toBeVisible();
  await expect(page.getByText(/Fidelity.*Retirement.*Long Stock/)).toBeVisible();
});
