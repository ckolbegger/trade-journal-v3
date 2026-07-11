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

// Plans the worked-example Trade, skips the Plan journal, and records the fill —
// leaving the browser on the open Trade's detail page.
async function planAndFill(page: Page) {
  await page.getByRole('link', { name: 'Trades' }).click()
  await expect(page.getByRole('heading', { name: 'Trades' })).toBeVisible()
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

  await page.getByRole('button', { name: /record fill/i }).click()
  await page.getByLabel(/quantity/i).fill('100')
  await page.getByLabel(/price/i).fill('150')
  await page.getByLabel(/fees/i).fill('1')
  await page.getByRole('button', { name: /record fill/i }).click()
  await expect(page.getByLabel('status')).toHaveText(/open/i)
}

test('enter a Mark and see the worked-example P&L and risk/reward', async ({ page }) => {
  await onboard(page)
  await planAndFill(page)

  // No Mark yet → the dashboard prompts for today's price instead of numbers.
  await expect(page.getByText(/enter today's price/i)).toBeVisible()

  // Enter the worked-example Mark: 160.00.
  await page.getByLabel(/mark/i).fill('160')
  await page.getByRole('button', { name: /save mark/i }).click()

  // The six worked-example numbers appear.
  const pnl = page.getByLabel('profit and loss')
  await expect(pnl).toContainText('16000.00') // current value
  await expect(pnl).toContainText('1000.00') // unrealized
  await expect(pnl).toContainText('999.00') // total

  const rr = page.getByLabel('ongoing risk and reward')
  await expect(rr.getByLabel('planned risk')).toContainText('2000.00')
  await expect(rr.getByLabel('worst-case risk')).toContainText('16000.00')
  await expect(rr.getByLabel('planned reward')).toContainText('1000.00')
  await expect(rr.getByLabel('max reward')).toContainText(/unlimited/i)

  const original = page.getByLabel('original plan risk and reward')
  await expect(original.getByLabel('original risk')).toContainText('1000.00')
  await expect(original.getByLabel('original reward')).toContainText('2000.00')
})

test('editing a shared Mark warns, naming the two Trades that hold it', async ({ page }) => {
  await onboard(page)

  // First AAPL Trade, marked today.
  await planAndFill(page)
  await page.getByLabel(/mark/i).fill('160')
  await page.getByRole('button', { name: /save mark/i }).click()
  await expect(page.getByLabel('profit and loss')).toBeVisible()

  // A second AAPL Trade — it consumes the same shared Mark immediately.
  await planAndFill(page)
  await expect(page.getByLabel('profit and loss')).toBeVisible()

  // Editing today's shared Mark warns before overwriting, naming 2 Trades.
  await page.getByLabel(/mark/i).fill('161')
  await page.getByRole('button', { name: /save mark/i }).click()
  await expect(page.getByRole('alert')).toContainText(/2 Trades/i)
})
