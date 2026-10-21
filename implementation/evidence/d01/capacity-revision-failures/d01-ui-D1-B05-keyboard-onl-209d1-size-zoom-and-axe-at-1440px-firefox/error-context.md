# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: d01-ui.spec.ts >> D1-B05 keyboard-only onboarding and Plan, live resize, zoom and axe at 1440px
- Location: tests/browser/d01-ui.spec.ts:72:3

# Error details

```
Error: Control not reachable through the keyboard
```

# Test source

```ts
  1   | import AxeBuilder from '@axe-core/playwright';
  2   | import type { Locator, Page } from '@playwright/test';
  3   | import { test, expect } from './fixtures';
  4   | import { onboard, fillPlan, requireWritable } from './helpers';
  5   | async function tabTo(page: Page, target: Locator) {
  6   |   for (let i = 0; i < 50; i++) {
  7   |     if (await target.evaluate(element => element === document.activeElement)) return;
  8   |     // WebKit on macOS follows the host's text-only Tab preference; Option-Tab
  9   |     // traverses every native control without changing that system preference.
  10  |     await page.keyboard.press('Alt+Tab');
  11  |   }
> 12  |   throw new Error('Control not reachable through the keyboard');
      |         ^ Error: Control not reachable through the keyboard
  13  | }
  14  | test('D1-B02 invalid input, catalog conflict and Cancel preserve input and write no Plan', async ({ page, context }) => {
  15  |   await onboard(page); await fillPlan(page);
  16  |   await page.getByLabel('Stop (underlying price, USD)').fill('50');
  17  |   await page.getByRole('button', { name: 'Confirm Plan' }).click();
  18  |   await expect(page.getByRole('alert')).toContainText('Stop must be below intended entry so Planned risk is positive.');
  19  |   await page.getByLabel('Stop (underlying price, USD)').fill('45');
  20  |   const other = await context.newPage(); await other.goto('/');
  21  |   await other.getByRole('button', { name: 'Workspace', exact: true }).click();
  22  |   await other.getByLabel('Institution name').fill('Second brokerage');
  23  |   await other.getByRole('button', { name: 'Save Institution' }).click();
  24  |   await expect(other.getByLabel('Institution name')).toHaveValue('');
  25  |   await other.close();
  26  |   await page.getByRole('button', { name: 'Confirm Plan' }).click();
  27  |   await expect(page.getByRole('alert')).toContainText('Brokerage records changed in another tab.');
  28  |   await expect(page.getByLabel('Stock symbol')).toHaveValue('XYZ');
  29  |   await page.getByRole('button', { name: 'Review current references' }).click();
  30  |   await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  31  |   await page.getByRole('button', { name: 'Trades', exact: true }).click();
  32  |   await expect(page.getByText('No confirmed Plans match this view.')).toBeVisible();
  33  |   await expect(page.getByRole('button', { name: /Execution|Backup|Restore|Report/ })).toHaveCount(0);
  34  | });
  35  | test('D1-B02 native transaction abort preserves every participant and entered Plan', async ({ page, context, playwright, browserName, profilePath, baseURL }) => {
  36  |   await onboard(page);
  37  |   const snapshot = () => page.evaluate(() => new Promise<unknown>((resolve, reject) => {
  38  |     const request = indexedDB.open('trade-journal-v3');
  39  |     request.onerror = () => reject(request.error ?? new Error('Open failed'));
  40  |     request.onsuccess = () => {
  41  |       const db = request.result; const transaction = db.transaction(['roots', 'versions', 'lifecycle']);
  42  |       const root = transaction.objectStore('roots').getAll(); const versions = transaction.objectStore('versions').getAll(); const lifecycle = transaction.objectStore('lifecycle').getAll();
  43  |       transaction.oncomplete = () => { resolve({ roots: root.result, versions: versions.result, lifecycle: lifecycle.result }); db.close(); };
  44  |       transaction.onerror = () => reject(transaction.error ?? new Error('Read failed'));
  45  |     };
  46  |   }));
  47  |   const before = await snapshot();
  48  |   await page.addInitScript(() => {
  49  |     const original = Object.getOwnPropertyDescriptor(IDBObjectStore.prototype, 'add')?.value as IDBObjectStore['add'];
  50  |     IDBObjectStore.prototype.add = function (value: unknown, key?: IDBValidKey) {
  51  |       if (this.name === 'versions' && typeof value === 'object' && value !== null && 'kind' in value && value.kind === 'JournalEntry') this.transaction.abort();
  52  |       return original.call(this, value, key);
  53  |     };
  54  |   });
  55  |   await page.reload(); await fillPlan(page);
  56  |   await page.getByRole('button', { name: 'Confirm Plan' }).click();
  57  |   await expect(page.getByRole('alert')).toContainText('Saving failed. Nothing was recorded.');
  58  |   await expect(page.getByLabel('Stock symbol')).toHaveValue('XYZ');
  59  |   await expect(page.getByText('Recovery Only', { exact: true })).toBeVisible();
  60  |   await expect(page.getByRole('button', { name: 'Confirm Plan' })).toBeDisabled();
  61  |   expect(await snapshot()).toEqual(before);
  62  |   await context.close();
  63  |   const reopened = await playwright[browserName].launchPersistentContext(profilePath, { headless: true, baseURL });
  64  |   try {
  65  |     const recovered = await reopened.newPage(); await recovered.goto('/');
  66  |     await expect(recovered.getByText('No confirmed Plans match this view.')).toBeVisible();
  67  |     await fillPlan(recovered); await recovered.getByRole('button', { name: 'Confirm Plan' }).click();
  68  |     await expect(recovered.getByRole('heading', { name: 'XYZ · Planned' })).toBeVisible();
  69  |   } finally { await reopened.close(); }
  70  | });
  71  | for (const width of [390, 1440]) {
  72  |   test(`D1-B05 keyboard-only onboarding and Plan, live resize, zoom and axe at ${width}px`, async ({ page }, testInfo) => {
  73  |     await page.setViewportSize({ width, height: 900 });
  74  |     await requireWritable(page);
  75  |     await page.evaluate(() => { document.documentElement.style.zoom = '2'; });
  76  |     expect(await page.getByRole('heading').evaluate(heading => heading.scrollWidth <= heading.clientWidth)).toBe(true);
  77  |     await page.evaluate(() => { document.documentElement.style.zoom = ''; });
  78  |     await tabTo(page, page.getByLabel('Workspace time zone')); await page.keyboard.type('America/New_York');
  79  |     await tabTo(page, page.getByRole('button', { name: 'Create Workspace' })); await page.keyboard.press('Enter');
  80  |     await expect(page.getByLabel('Institution name')).toBeVisible();
  81  |     await tabTo(page, page.getByLabel('Institution name')); await page.keyboard.type('Fidelity');
  82  |     await tabTo(page, page.getByRole('button', { name: 'Save Institution' })); await page.keyboard.press('Enter');
  83  |     await expect(page.getByLabel('Account name')).toBeVisible();
  84  |     await tabTo(page, page.getByLabel('Account name')); await page.keyboard.type('Taxable');
  85  |     await tabTo(page, page.getByRole('button', { name: 'Save Account' })); await page.keyboard.press('Enter');
  86  |     await tabTo(page, page.getByRole('button', { name: 'New Plan' })); await page.keyboard.press('Enter');
  87  |     for (const [label, value] of [['Stock symbol', 'XYZ'], ['Quantity (shares)', '100'], ['Intended entry (USD)', '50'], ['Stop (underlying price, USD)', '45'], ['Target (underlying price, USD)', '60'], ['Why this trade, why now?', 'Improving earnings'], ['What would invalidate the thesis?', 'Thesis fails']]) { await tabTo(page, page.getByLabel(label)); await page.keyboard.type(value); }
  88  |     for (const liveWidth of [767, 768, width]) {
  89  |       await page.setViewportSize({ width: liveWidth, height: 900 });
  90  |       await expect(page.getByLabel('Stock symbol')).toHaveValue('XYZ');
  91  |       expect(await page.getByRole('navigation').evaluate(element => getComputedStyle(element).position)).toBe(liveWidth < 768 ? 'fixed' : 'static');
  92  |     }
  93  |     await page.evaluate(() => { document.documentElement.style.zoom = '2'; });
  94  |     expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  95  |     for (const action of await page.getByRole('navigation').getByRole('button').all()) {
  96  |       const bounds = await action.boundingBox();
  97  |       expect(bounds).not.toBeNull();
  98  |       if (!bounds) throw new Error('Navigation action must be rendered');
  99  |       expect(bounds.x).toBeGreaterThanOrEqual(0);
  100 |       expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
  101 |       if (width < 768) {
  102 |         expect(bounds.y).toBeGreaterThanOrEqual(0);
  103 |         expect(bounds.y + bounds.height).toBeLessThanOrEqual(900);
  104 |       }
  105 |       expect(await action.evaluate(button => button.scrollWidth <= button.clientWidth)).toBe(true);
  106 |     }
  107 |     await page.screenshot({ path: testInfo.outputPath(`D1-zoom-${width}.png`), fullPage: true });
  108 |     await page.evaluate(() => { document.documentElement.style.zoom = ''; });
  109 |     const accessibility = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  110 |     expect(accessibility.violations).toEqual([]);
  111 |     await tabTo(page, page.getByRole('button', { name: 'Confirm Plan' })); await page.keyboard.press('Enter');
  112 |     await expect(page.getByRole('heading', { name: 'XYZ · Planned' })).toBeVisible();
```