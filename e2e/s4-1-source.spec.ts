import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'

// The trader's local date is the trading date.
function todayISO(): string {
  const date = new Date()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

const TODAY = todayISO()

async function onboard(page: Page) {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: /set up your first account/i })).toBeVisible()
  await page.getByLabel(/institution name/i).fill('Schwab')
  await page.getByLabel(/account name/i).fill('Taxable')
  await page.getByRole('button', { name: /get started/i }).click()
  await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible()
}

test('enabling marketdata.app in Settings and testing it shows the fetched close', async ({
  page,
}) => {
  // A mocked marketdata.app endpoint — no real provider call in e2e. MSFT, not
  // AAPL: AAPL is the provider's keyless trial symbol (serves real data for
  // ANY token, even a bad one), so "Test this source" uses a non-trial ticker.
  await page.route('https://api.marketdata.app/v1/stocks/candles/D/MSFT/**', (route) => {
    const [year, month, day] = TODAY.split('-').map(Number)
    const t = Math.floor(Date.UTC(year, month - 1, day, 16, 0, 0) / 1000)
    void route.fulfill({
      status: 203,
      contentType: 'application/json',
      body: JSON.stringify({ s: 'ok', t: [t], c: [400] }),
    })
  })

  await onboard(page)

  await page.getByRole('link', { name: 'Settings' }).click()
  await page.getByLabel(/enable marketdata\.app/i).check()
  await page.getByLabel(/api key/i).fill('fake-key')
  await page.getByRole('button', { name: /save source/i }).click()
  await expect(page.getByText(/^saved\.$/i)).toBeVisible()

  // Adapter registration happens once at startup from persisted Settings
  // (docs/plan/slice-04-automated-pricing.md) — reload to pick up the change.
  await page.reload()
  await page.getByRole('button', { name: /test this source/i }).click()

  await expect(page.getByText(new RegExp(`${TODAY}.*400\\.00`))).toBeVisible()
})
