import { test, expect } from '@playwright/test'

test('plan and confirm a stock Trade (worked example)', async ({ page }) => {
  await page.goto('/')

  // Onboard an Account first — every Trade binds to one.
  await expect(page.getByRole('heading', { name: /set up your first account/i })).toBeVisible()
  await page.getByLabel(/institution name/i).fill('Schwab')
  await page.getByLabel(/account name/i).fill('Taxable')
  await page.getByRole('button', { name: /get started/i }).click()
  await expect(page.getByRole('heading', { name: 'Trades' })).toBeVisible()

  // New Trade → the plan form (Long Stock strategy is seeded at startup).
  await page.getByRole('link', { name: 'New Trade' }).click()
  await expect(page.getByRole('heading', { name: 'New Trade' })).toBeVisible()

  await page.getByLabel(/thesis/i).fill('AAPL breaks out')
  await page.getByLabel(/new idea source/i).fill('Newsletter X')
  await page.getByRole('button', { name: /add idea source/i }).click()
  await page.getByLabel(/ticker/i).fill('AAPL')
  await page.getByLabel(/quantity/i).fill('100')
  await page.getByLabel(/stop/i).fill('140')
  await page.getByLabel(/target/i).fill('170')

  await page.getByRole('button', { name: /confirm plan/i }).click()

  // Confirming now opens the Plan journal (S1.2). Skip it to reach the detail —
  // journaling never blocks the flow.
  await expect(page.getByRole('heading', { name: 'Plan journal' })).toBeVisible()
  await page.getByRole('button', { name: /skip/i }).click()

  // Detail page shows the Plan facts.
  await expect(page.getByText('AAPL breaks out')).toBeVisible()
  await expect(page.getByText(/buy 100 AAPL/i)).toBeVisible()
  await expect(page.getByText(/140\.00/)).toBeVisible()
  await expect(page.getByText(/170\.00/)).toBeVisible()
  await expect(page.getByLabel('status')).toHaveText(/planned/i)

  // Trades list shows the new Trade with a planned badge.
  await page.getByRole('link', { name: 'Trades' }).click()
  const row = page.getByRole('listitem').filter({ hasText: 'AAPL' })
  await expect(row).toBeVisible()
  await expect(row).toContainText(/planned/i)
})
