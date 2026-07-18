import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'

// S4.3 — the "Refresh prices" ad-hoc action on Trade detail: a mocked
// marketdata.app source answers today's close for the held stock, the
// button's PriceBook.fetch(heldInstrumentsOf(trade), today..today) stores it,
// and the dashboard's P&L/R-R re-render from the new Mark — the same worked
// example used elsewhere (buy 100 @ 150.00, mark 160.00 → unrealized 1000.00).

function daysAgo(days: number): string {
  const date = new Date()
  date.setDate(date.getDate() - days)
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

const TODAY = daysAgo(0)
const YESTERDAY = daysAgo(1)

function toUnix(iso: string): number {
  const [year, month, day] = iso.split('-').map(Number)
  return Math.floor(Date.UTC(year, month - 1, day, 16, 0, 0) / 1000)
}

async function onboard(page: Page) {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: /set up your first account/i })).toBeVisible()
  await page.getByLabel(/institution name/i).fill('Schwab')
  await page.getByLabel(/account name/i).fill('Taxable')
  await page.getByRole('button', { name: /get started/i }).click()
  await expect(page.getByRole('heading', { name: 'Trades' })).toBeVisible()
}

async function enableSource(page: Page) {
  await page.getByRole('link', { name: 'Settings' }).click()
  await page.getByLabel(/enable marketdata\.app/i).check()
  await page.getByLabel(/api key/i).fill('fake-key')
  await page.getByRole('button', { name: /save source/i }).click()
  await expect(page.getByText(/^saved\.$/i)).toBeVisible()
  // Adapter registration reads Settings once, at startup — reload to pick it up.
  await page.reload()
}

async function planAndFillStock(page: Page) {
  await page.getByRole('link', { name: 'Trades' }).click()
  await page.getByRole('link', { name: 'New Trade' }).click()
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
  await page.getByLabel(/date/i).fill(YESTERDAY)
  await page.getByRole('button', { name: /record fill/i }).click()
  await expect(page.getByLabel('status')).toHaveText(/open/i)
}

test("refresh prices fetches today's close and updates the dashboard numbers", async ({ page }) => {
  await page.route('https://api.marketdata.app/v1/stocks/candles/D/AAPL/**', (route) => {
    void route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ s: 'ok', t: [toUnix(TODAY)], c: [160] }),
    })
  })

  await onboard(page)
  await enableSource(page)
  await planAndFillStock(page)

  await expect(page.getByText(/enter today's price/i)).toBeVisible()

  await page.getByRole('button', { name: /refresh prices/i }).click()

  const pnl = page.getByLabel('profit and loss')
  await expect(pnl).toContainText('1000.00')
  await expect(page.getByLabel('planned risk')).toBeVisible()
})
