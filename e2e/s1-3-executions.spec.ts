import { test, expect } from '@playwright/test'

async function onboard(page: import('@playwright/test').Page) {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: /set up your first account/i })).toBeVisible()
  await page.getByLabel(/institution name/i).fill('Schwab')
  await page.getByLabel(/account name/i).fill('Taxable')
  await page.getByRole('button', { name: /get started/i }).click()
  await expect(page.getByRole('heading', { name: 'Trades' })).toBeVisible()
}

test('record a fill and see the Position go open (worked example)', async ({ page }) => {
  await onboard(page)

  // Confirm the worked-example Plan, then skip the Plan journal to reach detail.
  await page.getByRole('link', { name: 'New Trade' }).click()
  await expect(page.getByRole('heading', { name: 'New Trade' })).toBeVisible()
  await page.getByLabel(/thesis/i).fill('AAPL breaks out')
  await page.getByLabel(/ticker/i).fill('AAPL')
  await page.getByLabel(/quantity/i).fill('100')
  await page.getByLabel(/stop/i).fill('140')
  await page.getByLabel(/target/i).fill('170')
  await page.getByRole('button', { name: /confirm plan/i }).click()
  await expect(page.getByRole('heading', { name: 'Plan journal' })).toBeVisible()
  await page.getByRole('button', { name: /skip/i }).click()

  // The Trade starts planned with no position.
  await expect(page.getByLabel('status')).toHaveText(/planned/i)
  await expect(page.getByLabel('position')).toHaveText(/no position/i)

  // Record the worked-example fill: buy 100 @ $150.00, fees $1.00.
  await page.getByRole('button', { name: /record fill/i }).click()
  await page.getByLabel(/quantity/i).fill('100')
  await page.getByLabel(/price/i).fill('150')
  await page.getByLabel(/fees/i).fill('1')
  await page.getByRole('button', { name: /record fill/i }).click()

  // Status flips to open, Position reads 100 AAPL long, and the history row lands.
  await expect(page.getByLabel('status')).toHaveText(/open/i)
  await expect(page.getByLabel('position')).toHaveText(/100 AAPL long/i)

  const historyRow = page.getByLabel('execution history').getByRole('listitem')
  await expect(historyRow).toHaveText(/buy/i)
  await expect(historyRow).toContainText('100')
  await expect(historyRow).toContainText('150.00')
  await expect(historyRow).toContainText('1.00')

  // The Trades list badge is open.
  await page.getByRole('link', { name: 'Trades' }).click()
  await expect(page.getByRole('heading', { name: 'Trades' })).toBeVisible()
  const row = page.getByRole('listitem', { name: 'AAPL' })
  await expect(row).toContainText(/open/i)
})
