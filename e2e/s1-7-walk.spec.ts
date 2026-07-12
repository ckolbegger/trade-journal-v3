import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'

// The Daily Review walk, end to end: two open Trades (the second owes its plan
// journal), the trader types the missing Marks, records an Action on each, and
// settles the debt at its checkpoint. Reopening Review shows both Trades reviewed
// and nothing owed — the review entries are the only "reviewed" record there is.

// The trader's local date is the trading date.
function daysAgo(days: number): string {
  const date = new Date()
  date.setDate(date.getDate() - days)
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

const TODAY = daysAgo(0)

async function onboard(page: Page) {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: /set up your first account/i })).toBeVisible()
  await page.getByLabel(/institution name/i).fill('Schwab')
  await page.getByLabel(/account name/i).fill('Taxable')
  await page.getByRole('button', { name: /get started/i }).click()
  await expect(page.getByRole('heading', { name: 'Trades' })).toBeVisible()
}

// Plans and fills a Trade yesterday, so today's Mark is the only gap. `skipJournal`
// leaves a plan-journal placeholder — the Journal Debt the walk settles.
async function planAndFill(page: Page, ticker: string, skipJournal: boolean) {
  await page.getByRole('link', { name: 'Trades' }).click()
  await page.getByRole('link', { name: 'New Trade' }).click()
  await page.getByLabel(/thesis/i).fill(`${ticker} breaks out`)
  await page.getByLabel(/ticker/i).fill(ticker)
  await page.getByLabel(/quantity/i).fill('100')
  await page.getByLabel(/stop/i).fill('140')
  await page.getByLabel(/target/i).fill('170')
  await page.getByRole('button', { name: /confirm plan/i }).click()

  await expect(page.getByRole('heading', { name: 'Plan journal' })).toBeVisible()
  if (skipJournal) {
    await page.getByRole('button', { name: /skip/i }).click()
  } else {
    await page.getByRole('button', { name: /write journal entry/i }).click()
  }

  await page.getByRole('button', { name: /record fill/i }).click()
  await page.getByLabel(/quantity/i).fill('100')
  await page.getByLabel(/price/i).fill('150')
  await page.getByLabel(/fees/i).fill('1')
  await page.getByLabel(/date/i).fill(daysAgo(1))
  await page.getByRole('button', { name: /record fill/i }).click()
  await expect(page.getByLabel('status')).toHaveText(/open/i)
}

async function beginWalk(page: Page) {
  await page.getByRole('link', { name: 'Review' }).click()
  await page.getByRole('button', { name: /start review/i }).click()
  await page.getByRole('button', { name: /begin walk/i }).click()
}

// Types the price for one gap row and saves it as a manual Mark.
async function markRow(page: Page, instrument: string, date: string, price: string) {
  const row = page.getByRole('listitem', { name: `${instrument} ${date}`, exact: true })
  await row.getByLabel(/price/i).fill(price)
  await row.getByRole('button', { name: 'Save', exact: true }).click()
}

test('the walk collects Marks, records an Action per Trade, and settles the debt', async ({
  page,
}) => {
  await onboard(page)
  await planAndFill(page, 'AAPL', false)
  await planAndFill(page, 'MSFT', true) // the skipped plan journal IS the debt

  await beginWalk(page)
  await expect(page.getByLabel('progress')).toHaveText(/0 of 2/)

  // ——— checkpoint 1: AAPL ———
  await expect(page.getByRole('heading', { name: 'AAPL' })).toBeVisible()
  await markRow(page, 'AAPL', daysAgo(1), '150')
  await markRow(page, 'AAPL', TODAY, '160')

  // The dashboard refreshes on the Marks the trader just typed — the worked
  // example at 160: unrealized $1,000, planned risk $2,000 (giveback counts).
  await expect(page.getByLabel('profit and loss')).toContainText('1000.00')
  await expect(page.getByLabel('ongoing risk and reward').getByLabel('planned risk')).toContainText(
    '2000.00',
  )

  // Recording the Action IS reviewing the Trade.
  await page.getByLabel(/what will you do with this trade/i).selectOption('Hold')
  await page.getByRole('radio', { name: '4' }).check()
  await page.getByRole('button', { name: /record action/i }).click()
  await expect(page.getByLabel('action recorded')).toHaveText('Hold')
  await expect(page.getByLabel('progress')).toHaveText(/1 of 2/)

  await page.getByRole('button', { name: /next trade/i }).click()

  // ——— checkpoint 2: MSFT (owes its plan journal) ———
  await expect(page.getByRole('heading', { name: 'MSFT' })).toBeVisible()
  await markRow(page, 'MSFT', daysAgo(1), '150')
  await markRow(page, 'MSFT', TODAY, '160')

  await page.getByLabel(/what will you do with this trade/i).selectOption('Hold')
  await page.getByRole('button', { name: /record action/i }).click()
  await expect(page.getByLabel('progress')).toHaveText(/2 of 2/)

  // The debt is offered at its Trade's checkpoint — answered against the prompts
  // as they were asked at plan time.
  const owed = page.getByRole('list', { name: 'journal owed' })
  await owed.getByLabel(/why this trade, why now/i).fill('Cloud reacceleration')
  await owed.getByRole('button', { name: /settle entry/i }).click()

  await page.getByRole('button', { name: /next trade/i }).click()

  // ——— completion ———
  const summary = page.getByRole('list', { name: 'walk summary' })
  await expect(summary.getByRole('listitem', { name: 'AAPL' })).toContainText('Reviewed')
  await expect(summary.getByRole('listitem', { name: 'MSFT' })).toContainText('Reviewed')

  // Reopening Review: both Trades flagged reviewed (their Actions exist for today)
  // and no journal is owed.
  await page.reload()
  await beginWalk(page)
  await expect(page.getByLabel('progress')).toHaveText(/2 of 2/)
  await expect(page.getByRole('list', { name: 'journal owed' })).toHaveCount(0)
})
