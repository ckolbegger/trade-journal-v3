# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: d01-update.spec.ts >> D1-B04 D1-T09 stages a verified update and defers activation through an unsaved form
- Location: tests/browser/d01-update.spec.ts:6:1

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('heading', { name: 'Trades', exact: true })
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" getByRole('heading', { name: 'Trades', exact: true }) with timeout 5000ms
  - waiting for getByRole('heading', { name: 'Trades', exact: true })

```

# Test source

```ts
  1  | import { cp, mkdtemp, rm } from 'node:fs/promises';
  2  | import { tmpdir } from 'node:os';
  3  | import { join } from 'node:path';
  4  | import { test, expect } from './fixtures';
  5  | import { onboard, fillPlan } from './helpers';
  6  | test('D1-B04 D1-T09 stages a verified update and defers activation through an unsaved form', async ({ page }) => {
  7  |   await onboard(page); await fillPlan(page);
  8  |   await expect(page.getByRole('button', { name: 'Check for application updates' })).toBeVisible();
  9  |   const before = await page.evaluate(async () => {
  10 |     const channel = new MessageChannel();
  11 |     return new Promise<string>(resolve => { channel.port1.onmessage = (event: MessageEvent<{ release: string }>) => resolve(event.data.release); navigator.serviceWorker.controller?.postMessage('VERIFY_RELEASE', [channel.port2]); });
  12 |   });
  13 |   const backup = await mkdtemp(join(tmpdir(), 'trade-journal-d1-dist-'));
  14 |   await cp('dist', backup, { recursive: true });
  15 |   try {
  16 |     await cp('.cache/update-dist', 'dist', { recursive: true });
  17 |     await page.getByRole('button', { name: 'Check for application updates' }).click();
  18 |     await expect(page.getByText('Update available', { exact: true })).toBeVisible({ timeout: 15000 });
  19 |     await expect(page.getByText(/Update deferred while this form has unsaved values/)).toBeVisible();
  20 |     await expect(page.getByRole('button', { name: 'Reload to update' })).toBeDisabled();
  21 |     await expect(page.getByLabel('Stock symbol')).toHaveValue('XYZ');
  22 |     const active = await page.evaluate(async () => {
  23 |       const channel = new MessageChannel();
  24 |       return new Promise<string>(resolve => { channel.port1.onmessage = (event: MessageEvent<{ release: string }>) => resolve(event.data.release); navigator.serviceWorker.controller?.postMessage('VERIFY_RELEASE', [channel.port2]); });
  25 |     });
  26 |     expect(active).toBe(before);
  27 |     await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  28 |     await page.getByRole('button', { name: 'Reload to update' }).click();
  29 |     await expect(page.getByRole('heading', { name: 'Trades', exact: true })).toBeVisible();
  30 |     const after = await page.evaluate(async () => {
  31 |       const channel = new MessageChannel();
  32 |       return new Promise<string>(resolve => { channel.port1.onmessage = (event: MessageEvent<{ release: string }>) => resolve(event.data.release); navigator.serviceWorker.controller?.postMessage('VERIFY_RELEASE', [channel.port2]); });
  33 |     });
  34 |     expect(after).not.toBe(before);
  35 |     await page.context().setOffline(true); await page.reload();
> 36 |     await expect(page.getByRole('heading', { name: 'Trades', exact: true })).toBeVisible();
     |                                                                              ^ Error: expect(locator).toBeVisible() failed
  37 |   } finally { await rm('dist', { recursive: true, force: true }); await cp(backup, 'dist', { recursive: true }); }
  38 | });
  39 | test('D1-B04 D1-T09 failed new-asset staging preserves the old offline release and unsaved input', async ({ page }) => {
  40 |   await onboard(page); await fillPlan(page);
  41 |   const before = await page.evaluate(async () => {
  42 |     const channel = new MessageChannel();
  43 |     return new Promise<string>(resolve => { channel.port1.onmessage = (event: MessageEvent<{ release: string }>) => resolve(event.data.release); navigator.serviceWorker.controller?.postMessage('VERIFY_RELEASE', [channel.port2]); });
  44 |   });
  45 |   const backup = await mkdtemp(join(tmpdir(), 'trade-journal-d1-dist-'));
  46 |   await cp('dist', backup, { recursive: true });
  47 |   try {
  48 |     await cp('.cache/update-dist', 'dist', { recursive: true });
  49 |     const { writeFile } = await import('node:fs/promises');
  50 |     // Infrastructure fault: served bytes disagree with the real new release inventory.
  51 |     await writeFile('dist/icon.svg', 'corrupt release asset');
  52 |     const failedInstall = page.evaluate(async () => {
  53 |       const registration = await navigator.serviceWorker.getRegistration();
  54 |       if (!registration) throw new Error('Registration required');
  55 |       return new Promise<string>(resolve => registration.addEventListener('updatefound', () => {
  56 |         const worker = registration.installing;
  57 |         worker?.addEventListener('statechange', () => { if (worker.state === 'redundant') resolve(worker.state); });
  58 |       }, { once: true }));
  59 |     });
  60 |     await page.getByRole('button', { name: 'Check for application updates' }).click();
  61 |     expect(await failedInstall).toBe('redundant');
  62 |     await expect(page.getByText('Update available', { exact: true })).toHaveCount(0);
  63 |     await expect(page.getByLabel('Stock symbol')).toHaveValue('XYZ');
  64 |     const after = await page.evaluate(async () => {
  65 |       const channel = new MessageChannel();
  66 |       return new Promise<string>(resolve => { channel.port1.onmessage = (event: MessageEvent<{ release: string }>) => resolve(event.data.release); navigator.serviceWorker.controller?.postMessage('VERIFY_RELEASE', [channel.port2]); });
  67 |     });
  68 |     expect(after).toBe(before);
  69 |     await page.context().setOffline(true); await page.reload();
  70 |     await expect(page.getByRole('heading', { name: 'Trades', exact: true })).toBeVisible();
  71 |   } finally { await rm('dist', { recursive: true, force: true }); await cp(backup, 'dist', { recursive: true }); }
  72 | });
  73 | test('D1-B04 one tab cannot activate an update over another tab with an unsaved Plan', async ({ page, context }) => {
  74 |   await onboard(page);
  75 |   const other = await context.newPage(); await other.goto('/'); await fillPlan(other);
  76 |   const before = await other.evaluate(() => navigator.serviceWorker.controller?.scriptURL);
  77 |   const backup = await mkdtemp(join(tmpdir(), 'trade-journal-d1-dist-'));
  78 |   await cp('dist', backup, { recursive: true });
  79 |   try {
  80 |     await cp('.cache/update-dist', 'dist', { recursive: true });
  81 |     await page.getByRole('button', { name: 'Check for application updates' }).click();
  82 |     await expect(page.getByText('Update available', { exact: true })).toBeVisible({ timeout: 15000 });
  83 |     await page.getByRole('button', { name: 'Reload to update' }).click();
  84 |     await expect(page.getByText('Close other Trade Journal tabs before reloading to update.')).toBeVisible();
  85 |     await expect(other.getByLabel('Stock symbol')).toHaveValue('XYZ');
  86 |     expect(await other.evaluate(() => navigator.serviceWorker.controller?.scriptURL)).toBe(before);
  87 |     await other.getByRole('button', { name: 'Confirm Plan' }).click();
  88 |     await expect(other.getByRole('heading', { name: 'XYZ · Planned' })).toBeVisible();
  89 |   } finally { await other.close(); await rm('dist', { recursive: true, force: true }); await cp(backup, 'dist', { recursive: true }); }
  90 | });
  91 | 
```