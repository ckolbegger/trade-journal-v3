import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'

// The trader's local date is the trading date.
function daysAgo(days: number): string {
  const date = new Date()
  date.setDate(date.getDate() - days)
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

async function onboard(page: Page) {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: /set up your first account/i })).toBeVisible()
  await page.getByLabel(/institution name/i).fill('Schwab')
  await page.getByLabel(/account name/i).fill('Taxable')
  await page.getByRole('button', { name: /get started/i }).click()
  await expect(page.getByRole('heading', { name: 'Trades' })).toBeVisible()
}

// Plans and sells an in-the-money cash-secured put expiring yesterday —
// already past expiration by the time the review runs "today".
async function planAndSellItmCsp(page: Page) {
  await page.getByRole('link', { name: 'New Trade' }).click()
  await expect(page.getByRole('heading', { name: 'New Trade' })).toBeVisible()
  await page.getByLabel(/strategy/i).selectOption({ label: 'Cash-Secured Put' })
  await page.getByLabel(/thesis/i).fill('XYZ range-bound')
  await page.getByLabel(/ticker/i).fill('XYZ')
  await page.getByLabel(/expiration/i).fill(daysAgo(1))
  await page.getByLabel(/strike/i).fill('100')
  await page.getByLabel(/quantity/i).fill('1')
  await page.getByLabel(/stop/i).fill('95')
  await page.getByLabel(/target/i).fill('80')
  await page.getByRole('button', { name: /confirm plan/i }).click()
  await expect(page.getByRole('heading', { name: 'Plan journal' })).toBeVisible()
  await page.getByRole('button', { name: /skip/i }).click()

  await page.getByRole('button', { name: /record fill/i }).click()
  await page.getByLabel(/quantity/i).fill('1')
  await page.getByLabel(/price/i).fill('2.50')
  await page.getByLabel(/fees/i).fill('0.65')
  await page.getByLabel(/date/i).fill(daysAgo(3))
  await page.getByRole('button', { name: /record fill/i }).click()
  await expect(page.getByLabel('status')).toHaveText(/open/i)
}

test('reviews an ITM expired put, records assignment, and closes the Trade after selling the stock', async ({
  page,
}) => {
  await onboard(page)
  await planAndSellItmCsp(page)

  await page.getByRole('link', { name: 'Review' }).click()
  await page.getByRole('button', { name: /start review/i }).click()

  const row = page.getByRole('listitem', { name: /1 XYZ/ })
  await expect(row).toBeVisible()
  await expect(row).toContainText(`expired ${daysAgo(1)}`)

  await row.getByRole('button', { name: /^assigned$/i }).click()

  // Assignment leaves the Trade open holding the stock — no Close Reason
  // prompt, and the agenda row is gone (nothing left to record for this leg).
  await expect(page.getByLabel(/close reason/i)).not.toBeVisible()
  await expect(row).not.toBeVisible()

  // The Trade now holds 100 shares at the strike, in the same Trade.
  await page.getByRole('link', { name: 'Trades' }).click()
  await page.getByRole('link', { name: /XYZ/ }).click()
  await expect(page.getByLabel('status')).toHaveText(/open/i)
  await expect(page.getByLabel('position')).toContainText('100 XYZ long')
  const history = page.getByLabel('execution history')
  await expect(history).toContainText('XYZ')
  await expect(history).toContainText('100.00')

  // Sell the assigned stock at 99 — the Trade flattens.
  await page.getByRole('button', { name: /record fill/i }).click()
  await page.getByLabel(/side/i).selectOption('sell')
  await page.getByLabel(/quantity/i).fill('100')
  await page.getByLabel(/price/i).fill('99')
  await page.getByRole('button', { name: /record fill/i }).click()

  await expect(page.getByLabel(/close reason/i)).toBeVisible()
  await page.getByLabel(/close reason/i).selectOption({ label: 'Hit Target' })
  await page.getByRole('button', { name: /skip journal/i }).click()

  // Total P&L: option credit 249.35 (250.00 − 0.65 fees) plus the stock's
  // -100.00 (bought at strike 100.00, sold at 99.00) = 149.35.
  await expect(page.getByLabel('status')).toHaveText(/closed/i)
  const pnl = page.getByLabel('profit and loss', { exact: true })
  await expect(pnl).toContainText('149.35')
})
