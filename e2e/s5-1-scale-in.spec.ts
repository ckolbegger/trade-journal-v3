import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'

// S5.1 scaling in: the worked example (docs/plan/slice-05-scaling.md) — buy
// 100 AAPL @ 150.00 fees 1.00, then buy 100 @ 160.00 fees 1.00 on the same Leg
// -> position 200, basis 31000.00, average cost 155.00; at mark 165.00,
// unrealized 2000.00 (gross).

async function onboard(page: Page) {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: /set up your first account/i })).toBeVisible()
  await page.getByLabel(/institution name/i).fill('Schwab')
  await page.getByLabel(/account name/i).fill('Taxable')
  await page.getByRole('button', { name: /get started/i }).click()
  await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible()
}

test('scale into a position across two fills and see position/average cost', async ({ page }) => {
  await onboard(page)
  await page.getByRole('link', { name: 'Trades' }).click()

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

  // Lot A: buy 100 @ 150.00, fees 1.00.
  await page.getByRole('button', { name: /record fill/i }).click()
  await page.getByLabel(/quantity/i).fill('100')
  await page.getByLabel(/price/i).fill('150')
  await page.getByLabel(/fees/i).fill('1')
  await page.getByRole('button', { name: /record fill/i }).click()
  await expect(page.getByLabel('status')).toHaveText(/open/i)
  await expect(page.getByLabel('position')).toHaveText(/100 AAPL long/i)

  // Lot B: buy 100 more @ 160.00, fees 1.00 — the same Leg, a second fill.
  await page.getByRole('button', { name: /record fill/i }).click()
  await page.getByLabel(/quantity/i).fill('100')
  await page.getByLabel(/price/i).fill('160')
  await page.getByLabel(/fees/i).fill('1')
  await page.getByRole('button', { name: /record fill/i }).click()

  // Both fills land as separate history rows.
  const historyRows = page.getByLabel('execution history').getByRole('listitem')
  await expect(historyRows).toHaveCount(2)
  await expect(historyRows.nth(0)).toContainText('150.00')
  await expect(historyRows.nth(1)).toContainText('160.00')

  // Enter today's Mark (165.00) to unlock average cost and unrealized P&L.
  await page.getByLabel(/mark/i).fill('165')
  await page.getByRole('button', { name: /save mark/i }).click()

  // Position: 200 total, average cost 155.00.
  await expect(page.getByLabel('position')).toContainText('200')
  await expect(page.getByLabel('position')).toContainText('155.00')

  // Unrealized 2000.00 gross at mark 165.00 (fees are shown separately, 2.00).
  const pnl = page.getByLabel('profit and loss')
  await expect(pnl).toContainText('2000.00')
  await expect(pnl).toContainText('2.00')
})
