import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'

// The review's one bulk fetch, end to end: a stock Trade (MSFT) and an option
// Trade (an AAPL call) — a mocked marketdata.app source that answers for both
// stock tickers but has no data for the contract (the real provider's own
// no_data behaviour, S4.1's live findings) — so the review's stock rows
// arrive pre-filled and only the contract is left to type in the walk. UI
// changes by zero lines for this (docs/plan/slice-04-automated-pricing.md):
// the collection screen already calls PriceBook.fetch unconditionally.

function weekdaysAgo(n: number): string {
  const date = new Date()
  // Land on today, or the most recent prior weekday.
  while (date.getDay() === 0 || date.getDay() === 6) date.setDate(date.getDate() - 1)
  for (let i = 0; i < n; i++) {
    date.setDate(date.getDate() - 1)
    while (date.getDay() === 0 || date.getDay() === 6) date.setDate(date.getDate() - 1)
  }
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

const TODAY = weekdaysAgo(0)
const YESTERDAY = weekdaysAgo(1)
// AAPL 2027-06-18 C 200 → OCC symbol (ticker + yymmdd + C/P + strike*1000, per
// pricebook.md's mapping, verified against docs/plan/slice-04-automated-pricing.md's
// worked example).
const CONTRACT_OCC = 'AAPL270618C00200000'

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

async function planAndFillStock(page: Page) {
  await page.getByRole('link', { name: 'Trades' }).click()
  await page.getByRole('link', { name: 'New Trade' }).click()
  await page.getByLabel(/thesis/i).fill('MSFT breaks out')
  await page.getByLabel(/ticker/i).fill('MSFT')
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

async function planAndFillCall(page: Page) {
  await page.getByRole('link', { name: 'Trades' }).click()
  await page.getByRole('link', { name: 'New Trade' }).click()
  await page.getByLabel(/strategy/i).selectOption({ label: 'Long Call' })
  await page.getByLabel(/thesis/i).fill('AAPL call')
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
  await page.getByLabel(/date/i).fill(YESTERDAY)
  await page.getByRole('button', { name: /record fill/i }).click()
  await expect(page.getByLabel('status')).toHaveText(/open/i)
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

test('the review fetch pre-fills both stock tickers and leaves only the contract to type', async ({
  page,
}) => {
  // Both stock tickers resolve — MSFT (the stock Trade) and AAPL (the option
  // Trade's underlying, per heldInstrumentsOf). The contract itself has no
  // data — the provider's own closed-market/no-quote behaviour, not a
  // distinct "unsupported" error (S4.1's live findings).
  for (const ticker of ['MSFT', 'AAPL']) {
    await page.route(`https://api.marketdata.app/v1/stocks/candles/D/${ticker}/**`, (route) => {
      void route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          s: 'ok',
          t: [toUnix(YESTERDAY), toUnix(TODAY)],
          c: [150, 160],
        }),
      })
    })
  }
  await page.route(`https://api.marketdata.app/v1/options/quotes/${CONTRACT_OCC}/**`, (route) => {
    void route.fulfill({
      status: 404,
      contentType: 'application/json',
      body: JSON.stringify({ s: 'no_data', prevTime: null, nextTime: null }),
    })
  })

  await onboard(page)
  await planAndFillStock(page)
  await planAndFillCall(page)
  await enableSource(page)

  await page.getByRole('link', { name: 'Review' }).click()
  await page.getByRole('button', { name: /start review/i }).click()

  // The stock Trade's fetched rows are pre-filled for an eyeball check —
  // nothing left to type.
  const stockCard = page.getByRole('listitem', { name: 'MSFT', exact: true })
  const stockFetched = stockCard.getByRole('list', { name: 'fetched' })
  await expect(
    stockFetched.getByRole('listitem', { name: `MSFT ${TODAY}`, exact: true }),
  ).toContainText('160.00')
  await expect(
    stockFetched.getByRole('listitem', { name: `MSFT ${YESTERDAY}`, exact: true }),
  ).toContainText('150.00')
  await expect(stockCard.getByRole('list', { name: 'missing' })).toBeEmpty()

  // The option Trade's shared AAPL underlying is fetched too — only the
  // contract itself stays missing.
  const optionCard = page.getByRole('listitem', { name: 'AAPL', exact: true })
  const optionFetched = optionCard.getByRole('list', { name: 'fetched' })
  await expect(
    optionFetched.getByRole('listitem', { name: `AAPL ${TODAY}`, exact: true }),
  ).toContainText('160.00')
  const optionMissing = optionCard.getByRole('list', { name: 'missing' })
  await expect(optionMissing.getByRole('listitem')).toHaveCount(2)
  await expect(
    optionMissing.getByRole('listitem', {
      name: `AAPL 2027-06-18 C 200 ${YESTERDAY}`,
      exact: true,
    }),
  ).toBeVisible()
  await expect(
    optionMissing.getByRole('listitem', { name: `AAPL 2027-06-18 C 200 ${TODAY}`, exact: true }),
  ).toBeVisible()

  await page.getByRole('button', { name: /begin walk/i }).click()

  // ——— checkpoint 1: the stock Trade — nothing left to type ———
  await expect(page.getByRole('heading', { name: 'MSFT' })).toBeVisible()
  await expect(page.getByRole('list', { name: 'marks needed' })).toHaveCount(0)
  await page.getByLabel(/what will you do with this trade/i).selectOption('Hold')
  await page.getByRole('button', { name: /record action/i }).click()
  await page.getByRole('button', { name: /next trade/i }).click()

  // ——— checkpoint 2: the option Trade — only the contract is typed ———
  await expect(page.getByRole('heading', { name: 'AAPL' })).toBeVisible()
  const rows = page.getByRole('list', { name: 'marks needed' })
  await expect(rows.getByRole('listitem')).toHaveCount(2)
  await expect(
    rows.getByRole('listitem', { name: `AAPL 2027-06-18 C 200 ${YESTERDAY}`, exact: true }),
  ).toBeVisible()
  await expect(
    rows.getByRole('listitem', { name: `AAPL 2027-06-18 C 200 ${TODAY}`, exact: true }),
  ).toBeVisible()
  // The underlying's own rows never reappear — the fetch already satisfied them.
  await expect(rows.getByRole('listitem', { name: `AAPL ${TODAY}`, exact: true })).toHaveCount(0)

  // Typing the contract's price is the only manual work left in this session.
  const contractRow = rows.getByRole('listitem', {
    name: `AAPL 2027-06-18 C 200 ${YESTERDAY}`,
    exact: true,
  })
  await contractRow.getByLabel(/price/i).fill('14')
  await contractRow.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(
    rows.getByRole('listitem', { name: `AAPL 2027-06-18 C 200 ${YESTERDAY}`, exact: true }),
  ).toHaveCount(0)
  await expect(rows.getByRole('listitem')).toHaveCount(1)
})
