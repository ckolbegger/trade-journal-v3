import { cp, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, expect } from './fixtures';
import { onboard, confirmPlan } from './helpers';
import { authority, fillOpening } from './d02-helpers';
for (const flow of ['Opening', 'Debt'] as const) test(`D2 safe verified update defers while ${flow} has retained unsaved values`, async ({ page }) => {
  await onboard(page); await confirmPlan(page); await fillOpening(page, 'Defer');
  if (flow === 'Debt') { await page.getByRole('button', { name: 'Save initial Position Change' }).click(); await page.getByRole('button', { name: 'Answer reflection' }).click(); await page.getByLabel('As Planned', { exact: true }).check(); await page.getByLabel('Decision confidence').selectOption('4'); }
  const before = await authority(page);
  const backup = await mkdtemp(join(tmpdir(), 'd02-update-')); await cp('dist', backup, { recursive: true });
  try {
    await cp('.cache/update-dist', 'dist', { recursive: true });
    await page.getByRole('button', { name: 'Check for application updates' }).click(); await expect(page.getByRole('button', { name: 'Reload to update' })).toBeVisible({ timeout: 15000 }); await expect(page.getByRole('button', { name: 'Reload to update' })).toBeDisabled();
    if (flow === 'Opening') await expect(page.getByLabel('Execution 2 quantity (shares)')).toHaveValue('60'); else await expect(page.getByLabel('As Planned', { exact: true })).toBeChecked();
    await page.getByRole('button', { name: 'Workspace', exact: true }).click(); await expect(page.getByRole('button', { name: 'Reload to update' })).toBeDisabled();
    if (flow === 'Opening') { await page.getByRole('button', { name: 'Trades', exact: true }).click(); await page.getByRole('button', { name: /XYZ · Planned/ }).click(); await page.getByRole('button', { name: 'Record initial Position Change' }).click(); }
    else { await page.getByRole('button', { name: 'Journal Debt', exact: true }).click(); await page.getByRole('button', { name: 'Answer reflection', exact: true }).click(); }
    await page.getByRole('button', { name: 'Cancel', exact: true }).click(); await expect(page.getByRole('button', { name: 'Reload to update' })).toBeEnabled();
    await Promise.all([page.waitForEvent('load'), page.getByRole('button', { name: 'Reload to update' }).click()]); await expect(page.getByRole('heading', { name: 'Trades', exact: true })).toBeVisible();
    expect(await authority(page)).toEqual(before); await page.context().setOffline(true); await page.reload(); await expect(page.getByRole('heading', { name: 'Trades', exact: true })).toBeVisible(); expect(await authority(page)).toEqual(before);
  } finally { await rm('dist', { recursive: true, force: true }); await cp(backup, 'dist', { recursive: true }); }
});
