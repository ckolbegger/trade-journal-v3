import { expect, test } from '@playwright/test'

async function seedAccount(page: import('@playwright/test').Page) {
  await page.goto('/')
  await expect(page.locator('main')).toHaveAttribute('data-view', /^(empty|ready)$/)
  // D2 test starts from a fresh context; create the prerequisite account.
  const instCount = await page.locator('[aria-label="Institutions"] li').count()
  if (instCount === 0) {
    await page.getByLabel('Institution name').fill('Schwab')
    await page.getByRole('button', { name: 'Add institution' }).click()
  }
  const acctCount = await page.locator('[aria-label="Accounts"] li').count()
  if (acctCount === 0) {
    await page.locator('#acct-inst').selectOption({ label: 'Schwab' })
    await page.getByLabel('Account name').fill('Main')
    await page.getByRole('button', { name: 'Add account' }).click()
  }
}

test('New Plan form defaults to Long Stock with a live 1R preview', async ({ page }) => {
  await seedAccount(page)
  await page.getByRole('button', { name: 'New Plan' }).click()
  await expect(page.getByLabel('Strategy')).toHaveValue('seed-long-stock')
  await expect(page.locator('option[value="seed-long-stock"]')).toHaveCount(1)
  // D8 makes the three seeded single-leg option shapes selectable here; the
  // Long Stock default and its live stock preview remain unchanged.
  const options = await page.getByLabel('Strategy').locator('option').allTextContents()
  expect(options).toEqual(['Long Stock', 'Long Call', 'Long Put', 'Cash-Secured Put'])
  await page.getByLabel('Underlying').fill('AAPL')
  await page.getByLabel('Quantity').fill('10')
  await page.getByLabel('Entry price').fill('100')
  await page.getByLabel('Stop price').fill('95')
  await page.getByLabel('Target price').fill('110')
  await expect(page.getByTestId('one-r')).toHaveText('50.00', { timeout: 5000 })
  await expect(page.getByTestId('baseline')).toHaveText('2.00', { timeout: 5000 })
})

test('Plan Reflection requires thesis and invalidation', async ({ page }) => {
  await seedAccount(page)
  await page.getByRole('button', { name: 'New Plan' }).click()
  await page.getByLabel('Underlying').fill('AAPL')
  await page.getByLabel('Quantity').fill('10')
  await page.getByLabel('Entry price').fill('100')
  await page.getByLabel('Stop price').fill('95')
  await page.getByLabel('Target price').fill('110')
  await page.getByLabel('Thesis').fill('Why now')
  await page.getByRole('button', { name: 'Confirm plan' }).click()
  await expect(page.getByRole('alert')).toContainText('Invalidation')
})

test('confirming a plan creates a Planned trade in list and detail without execution controls', async ({ page }) => {
  await seedAccount(page)
  await page.getByRole('button', { name: 'New Plan' }).click()
  await page.getByLabel('Underlying').fill('AAPL')
  await page.getByLabel('Quantity').fill('10')
  await page.getByLabel('Entry price').fill('100')
  await page.getByLabel('Stop price').fill('95')
  await page.getByLabel('Target price').fill('110')
  await page.getByLabel('Thesis').fill('Why now')
  await page.getByLabel('Invalidation').fill('Close below 50d')
  await page.getByRole('button', { name: 'Confirm plan' }).click()
  await expect(page.getByRole('region', { name: 'Planned trades' }).locator('.trade-row').filter({ hasText: 'AAPL' })).toBeVisible()
  await page.getByRole('region', { name: 'Planned trades' }).locator('.trade-row').filter({ hasText: 'AAPL' }).click()
  await expect(page.getByTestId('trade-lifecycle')).toHaveText('Planned')
  await expect(page.getByTestId('trade-one-r')).toHaveText('50.00')
  const body = await page.locator('main').innerText()
  for (const forbidden of ['Execution', 'Mark', 'Close position']) expect(body).not.toContain(forbidden)
})
