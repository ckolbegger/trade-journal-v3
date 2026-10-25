import type { Page } from '@playwright/test';
import { expect } from './fixtures';
export async function requireWritable(page: Page) {
  await page.goto('/');
  await expect(page.getByLabel('Workspace time zone')).toBeVisible();
}
export async function onboard(page: Page) {
  await requireWritable(page);
  await page.getByLabel('Workspace time zone').fill('America/New_York');
  await page.getByRole('button', { name: 'Create Workspace' }).click();
  await page.getByLabel('Institution name').fill('Fidelity');
  await page.getByRole('button', { name: 'Add Institution' }).click();
  await page.getByLabel('New Account name').fill('Taxable');
  await page.getByRole('button', { name: 'Add Account' }).click();
  await expect(page.getByText('Account saved. You can now confirm a Plan.')).toBeVisible();
}
export async function fillPlan(page: Page) {
  await page.getByRole('button', { name: 'New Plan' }).click();
  const next = page.getByRole('button', { name: 'Next: Plan and reflection' });
  if (await next.isVisible()) await next.click();
  for (const [label, value] of [['Stock symbol', 'XYZ'], ['Quantity (shares)', '100'], ['Intended entry (USD)', '50'], ['Stop (underlying price, USD)', '45'], ['Target (underlying price, USD)', '60'], ['Why this trade, why now?', 'Improving earnings'], ['What would invalidate the thesis?', 'Thesis fails']]) await page.getByLabel(label).fill(value);
}
export async function confirmPlan(page: Page) {
  await fillPlan(page);
  await page.getByRole('button', { name: 'Confirm Plan' }).click();
  await expect(page.getByRole('heading', { name: 'XYZ · Planned' })).toBeVisible();
}
