import { test, expect } from '@playwright/test'

test('onboarding creates an institution and account, persists across reload', async ({ page }) => {
  await page.goto('/')

  // Fresh context: onboarding appears.
  await expect(page.getByRole('heading', { name: /set up your first account/i })).toBeVisible()

  await page.getByLabel(/institution name/i).fill('Schwab')
  await page.getByLabel(/account name/i).fill('Taxable')
  await page.getByRole('button', { name: /get started/i }).click()

  // Lands on Home.
  await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible()

  // Reload → no onboarding (persisted in IndexedDB).
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible()
  await expect(page.getByRole('heading', { name: /set up your first account/i })).toHaveCount(0)

  // Settings lists both.
  await page.getByRole('link', { name: 'Settings' }).click()
  await expect(page.getByRole('listitem').filter({ hasText: 'Schwab' })).toBeVisible()
  await expect(page.getByRole('listitem').filter({ hasText: 'Taxable' })).toBeVisible()
})
