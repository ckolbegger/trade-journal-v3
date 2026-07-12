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

// Plans the worked-example Trade, SKIPS the plan journal (that placeholder is the
// Journal Debt), and records the fill three days ago — so nothing has ever been
// marked and the review owes Marks for every day since the fill.
async function planAndFillThreeDaysAgo(page: Page) {
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
  await page.getByLabel(/date/i).fill(daysAgo(3))
  await page.getByRole('button', { name: /record fill/i }).click()
  await expect(page.getByLabel('status')).toHaveText(/open/i)
}

test('the review agenda shows every gap day since the fill and the journal debt', async ({
  page,
}) => {
  await onboard(page)
  await planAndFillThreeDaysAgo(page)

  await page.getByRole('link', { name: 'Review' }).click()
  await page.getByRole('button', { name: /start review/i }).click()

  // The Trade's missing (instrument, date) rows — every calendar day since the
  // fill, including the days the trader skipped.
  const trade = page.getByRole('listitem', { name: 'AAPL', exact: true })
  await expect(trade).toBeVisible()
  for (const days of [3, 2, 1, 0]) {
    await expect(
      trade.getByRole('listitem', { name: `AAPL ${daysAgo(days)}`, exact: true }),
    ).toBeVisible()
  }

  // The skipped plan entry is owed.
  await expect(page.getByLabel('journal debt')).toContainText('1')
})
