import { cp, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, expect } from './fixtures';
import { onboard, fillPlan } from './helpers';
test('D1-B04 D1-T09 stages a verified update and defers activation through an unsaved form', async ({ page }) => {
  await onboard(page); await fillPlan(page);
  await expect(page.getByRole('button', { name: 'Check for application updates' })).toBeVisible();
  const before = await page.evaluate(async () => {
    const channel = new MessageChannel();
    return new Promise<string>(resolve => { channel.port1.onmessage = (event: MessageEvent<{ release: string }>) => resolve(event.data.release); navigator.serviceWorker.controller?.postMessage('VERIFY_RELEASE', [channel.port2]); });
  });
  const backup = await mkdtemp(join(tmpdir(), 'trade-journal-d1-dist-'));
  await cp('dist', backup, { recursive: true });
  try {
    await cp('.cache/update-dist', 'dist', { recursive: true });
    await page.getByRole('button', { name: 'Check for application updates' }).click();
    await expect(page.getByText('Update available', { exact: true })).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/Update deferred while this form has unsaved values/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Reload to update' })).toBeDisabled();
    await expect(page.getByLabel('Stock symbol')).toHaveValue('XYZ');
    const active = await page.evaluate(async () => {
      const channel = new MessageChannel();
      return new Promise<string>(resolve => { channel.port1.onmessage = (event: MessageEvent<{ release: string }>) => resolve(event.data.release); navigator.serviceWorker.controller?.postMessage('VERIFY_RELEASE', [channel.port2]); });
    });
    expect(active).toBe(before);
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await Promise.all([page.waitForEvent('load'), page.getByRole('button', { name: 'Reload to update' }).click()]);
    await expect(page.getByRole('heading', { name: 'Trades', exact: true })).toBeVisible();
    const after = await page.evaluate(async () => {
      const channel = new MessageChannel();
      return new Promise<string>(resolve => { channel.port1.onmessage = (event: MessageEvent<{ release: string }>) => resolve(event.data.release); navigator.serviceWorker.controller?.postMessage('VERIFY_RELEASE', [channel.port2]); });
    });
    expect(after).not.toBe(before);
    await page.context().setOffline(true); await page.reload();
    await expect(page.getByRole('heading', { name: 'Trades', exact: true })).toBeVisible();
  } finally { await rm('dist', { recursive: true, force: true }); await cp(backup, 'dist', { recursive: true }); }
});
test('D1-B04 D1-T09 failed new-asset staging preserves the old offline release and unsaved input', async ({ page }) => {
  await onboard(page); await fillPlan(page);
  const before = await page.evaluate(async () => {
    const channel = new MessageChannel();
    return new Promise<string>(resolve => { channel.port1.onmessage = (event: MessageEvent<{ release: string }>) => resolve(event.data.release); navigator.serviceWorker.controller?.postMessage('VERIFY_RELEASE', [channel.port2]); });
  });
  const backup = await mkdtemp(join(tmpdir(), 'trade-journal-d1-dist-'));
  await cp('dist', backup, { recursive: true });
  try {
    await cp('.cache/update-dist', 'dist', { recursive: true });
    const { writeFile } = await import('node:fs/promises');
    // Infrastructure fault: served bytes disagree with the real new release inventory.
    await writeFile('dist/icon.svg', 'corrupt release asset');
    const failedInstall = page.evaluate(async () => {
      const registration = await navigator.serviceWorker.getRegistration();
      if (!registration) throw new Error('Registration required');
      return new Promise<string>(resolve => registration.addEventListener('updatefound', () => {
        const worker = registration.installing;
        worker?.addEventListener('statechange', () => { if (worker.state === 'redundant') resolve(worker.state); });
      }, { once: true }));
    });
    await page.getByRole('button', { name: 'Check for application updates' }).click();
    expect(await failedInstall).toBe('redundant');
    await expect(page.getByText('Update available', { exact: true })).toHaveCount(0);
    await expect(page.getByLabel('Stock symbol')).toHaveValue('XYZ');
    const after = await page.evaluate(async () => {
      const channel = new MessageChannel();
      return new Promise<string>(resolve => { channel.port1.onmessage = (event: MessageEvent<{ release: string }>) => resolve(event.data.release); navigator.serviceWorker.controller?.postMessage('VERIFY_RELEASE', [channel.port2]); });
    });
    expect(after).toBe(before);
    await page.context().setOffline(true); await page.reload();
    await expect(page.getByRole('heading', { name: 'Trades', exact: true })).toBeVisible();
  } finally { await rm('dist', { recursive: true, force: true }); await cp(backup, 'dist', { recursive: true }); }
});
test('D1-B04 one tab cannot activate an update over another tab with an unsaved Plan', async ({ page, context }) => {
  await onboard(page);
  const other = await context.newPage(); await other.goto('/'); await fillPlan(other);
  const before = await other.evaluate(() => navigator.serviceWorker.controller?.scriptURL);
  const backup = await mkdtemp(join(tmpdir(), 'trade-journal-d1-dist-'));
  await cp('dist', backup, { recursive: true });
  try {
    await cp('.cache/update-dist', 'dist', { recursive: true });
    await page.getByRole('button', { name: 'Check for application updates' }).click();
    await expect(page.getByText('Update available', { exact: true })).toBeVisible({ timeout: 15000 });
    await page.getByRole('button', { name: 'Reload to update' }).click();
    await expect(page.getByText('Close other Trade Journal tabs before reloading to update.')).toBeVisible();
    await expect(other.getByLabel('Stock symbol')).toHaveValue('XYZ');
    expect(await other.evaluate(() => navigator.serviceWorker.controller?.scriptURL)).toBe(before);
    await other.getByRole('button', { name: 'Confirm Plan' }).click();
    await expect(other.getByRole('heading', { name: 'XYZ · Planned' })).toBeVisible();
  } finally { await other.close(); await rm('dist', { recursive: true, force: true }); await cp(backup, 'dist', { recursive: true }); }
});
