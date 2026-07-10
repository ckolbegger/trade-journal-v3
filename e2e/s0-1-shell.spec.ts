import { test, expect } from '@playwright/test'

test('shell loads, navigates to Review and back, with no console errors', async ({ page }) => {
  const errors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text())
  })
  page.on('pageerror', (err) => errors.push(err.message))

  await page.goto('/')

  // First run gates on onboarding (S0.2) — complete it to reach the shell.
  await page.getByLabel(/institution name/i).fill('Schwab')
  await page.getByLabel(/account name/i).fill('Taxable')
  await page.getByRole('button', { name: /get started/i }).click()

  await expect(page.getByRole('heading', { name: 'Trades' })).toBeVisible()

  await page.getByRole('link', { name: 'Review' }).click()
  await expect(page.getByRole('heading', { name: 'Review' })).toBeVisible()

  await page.getByRole('link', { name: 'Trades' }).click()
  await expect(page.getByRole('heading', { name: 'Trades' })).toBeVisible()

  expect(errors).toEqual([])
})
