import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'

async function onboard(page: Page) {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: /set up your first account/i })).toBeVisible()
  await page.getByLabel(/institution name/i).fill('Schwab')
  await page.getByLabel(/account name/i).fill('Taxable')
  await page.getByRole('button', { name: /get started/i }).click()
  await expect(page.getByRole('heading', { name: 'Trades' })).toBeVisible()
}

// Plans the worked-example long call, skips the Plan journal, and records the
// fill — leaving the browser on the open Trade's detail page.
async function planAndFillCall(page: Page) {
  await page.getByRole('link', { name: 'New Trade' }).click()
  await expect(page.getByRole('heading', { name: 'New Trade' })).toBeVisible()
  await page.getByLabel(/strategy/i).selectOption({ label: 'Long Call' })
  await page.getByLabel(/thesis/i).fill('AAPL breaks out')
  await page.getByLabel(/ticker/i).fill('AAPL')
  await page.getByLabel(/expiration/i).fill('2027-06-18')
  await page.getByLabel(/strike/i).fill('200')
  await page.getByLabel(/quantity/i).fill('1')
  await page.getByLabel(/stop/i).fill('6')
  await page.getByLabel(/target/i).fill('24')
  await page.getByRole('button', { name: /confirm plan/i }).click()
  await expect(page.getByRole('heading', { name: 'Plan journal' })).toBeVisible()
  await page.getByRole('button', { name: /skip/i }).click()

  await page.getByRole('button', { name: /record fill/i }).click()
  await page.getByLabel(/quantity/i).fill('1')
  await page.getByLabel(/price/i).fill('12')
  await page.getByLabel(/fees/i).fill('0.65')
  await page.getByRole('button', { name: /record fill/i }).click()
  await expect(page.getByLabel('status')).toHaveText(/open/i)
}

test('plans, fills, and marks a long call — worked-example dashboard numbers', async ({ page }) => {
  await onboard(page)
  await planAndFillCall(page)

  // The position reads the contract, not just the underlying ticker.
  await expect(page.getByLabel('position')).toContainText("1 × AAPL Jun'27 200C")

  // No Mark yet → the dashboard prompts for today's price instead of numbers.
  await expect(page.getByText(/enter today's price/i)).toBeVisible()

  // Enter the worked-example contract Mark: 14.00.
  await page.getByLabel(/mark/i).fill('14')
  await page.getByRole('button', { name: /save mark/i }).click()

  // The worked-example numbers appear (docs/plan/slice-03-single-leg-options.md):
  // currentValue 1400.00, unrealized 200.00, fees 0.65, total 199.35, plannedRisk
  // 800.00, worstCaseRisk 1400.00, plannedReward 1000.00, maxReward unlimited,
  // original risk 600.00 / reward 1200.00.
  const pnl = page.getByLabel('profit and loss')
  await expect(pnl).toContainText('1400.00')
  await expect(pnl).toContainText('200.00')
  await expect(pnl).toContainText('0.65')
  await expect(pnl).toContainText('199.35')

  const rr = page.getByLabel('ongoing risk and reward')
  await expect(rr.getByLabel('planned risk')).toContainText('800.00')
  await expect(rr.getByLabel('worst-case risk')).toContainText('1400.00')
  await expect(rr.getByLabel('planned reward')).toContainText('1000.00')
  await expect(rr.getByLabel('max reward')).toContainText(/unlimited/i)

  const original = page.getByLabel('original plan risk and reward')
  await expect(original.getByLabel('original risk')).toContainText('600.00')
  await expect(original.getByLabel('original reward')).toContainText('1200.00')
})
