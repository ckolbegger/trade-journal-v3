import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'

// The growth timeline, end to end: a full Trade lifecycle (plan journal, a
// Daily Review Action, and a close journal) plus a standalone reflection, all
// read back on the Journal page as one chronological story — newest first —
// with the plan entry's Trade label landing back on that Trade.

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

async function markRow(page: Page, instrument: string, date: string, price: string) {
  const row = page.getByRole('listitem', { name: `${instrument} ${date}`, exact: true })
  await row.getByLabel(/price/i).fill(price)
  await row.getByRole('button', { name: 'Save', exact: true }).click()
}

// Plans, journals, fills (yesterday), and reviews (today) one Trade while it's
// still open — the review-anchored Action entry needs an open Trade, so this
// runs before the close that follows.
async function planFillAndReview(page: Page) {
  await page.getByRole('link', { name: 'New Trade' }).click()
  await page.getByLabel(/thesis/i).fill('AAPL breaks out')
  await page.getByLabel(/ticker/i).fill('AAPL')
  await page.getByLabel(/quantity/i).fill('100')
  await page.getByLabel(/stop/i).fill('140')
  await page.getByLabel(/target/i).fill('170')
  await page.getByRole('button', { name: /confirm plan/i }).click()

  await expect(page.getByRole('heading', { name: 'Plan journal' })).toBeVisible()
  await page.getByLabel('Why this trade, why now?').fill('Breakout confirmed on volume')
  await page.getByRole('radio', { name: '4' }).check()
  await page.getByLabel('Emotional state').selectOption('calm')
  await page.getByRole('button', { name: /write journal entry/i }).click()

  await page.getByRole('button', { name: /record fill/i }).click()
  await page.getByLabel(/quantity/i).fill('100')
  await page.getByLabel(/price/i).fill('150')
  await page.getByLabel(/fees/i).fill('1')
  await page.getByLabel(/date/i).fill(daysAgo(1))
  await page.getByRole('button', { name: /record fill/i }).click()
  await expect(page.getByLabel('status')).toHaveText(/open/i)

  await page.getByRole('link', { name: 'Review' }).click()
  await page.getByRole('button', { name: /start review/i }).click()
  await page.getByRole('button', { name: /begin walk/i }).click()
  await markRow(page, 'AAPL', daysAgo(1), '150')
  await markRow(page, 'AAPL', TODAY, '160')
  await page.getByLabel(/what will you do with this trade/i).selectOption('Hold')
  await page.getByRole('button', { name: /record action/i }).click()
  await expect(page.getByLabel('action recorded')).toHaveText('Hold')
}

async function closeTrade(page: Page) {
  await page.getByRole('link', { name: 'Trades' }).click()
  await page.getByRole('link', { name: 'AAPL' }).click()

  await page.getByRole('button', { name: /record fill/i }).click()
  await page.getByLabel(/side/i).selectOption('sell')
  await page.getByLabel(/quantity/i).fill('100')
  await page.getByLabel(/price/i).fill('168')
  await page.getByLabel(/fees/i).fill('1')
  await page.getByRole('button', { name: /record fill/i }).click()

  await expect(page.getByRole('heading', { name: 'Close this Trade' })).toBeVisible()
  await page.getByLabel(/close reason/i).selectOption('Hit Target')
  await page.getByLabel('Would you take this trade again?').selectOption('yes')
  await page.getByLabel('Lesson').fill('Let winners run to target')
  await page.getByRole('button', { name: /record close/i }).click()
  await expect(page.getByLabel('status')).toHaveText(/closed/i)
}

async function writeStandaloneReflection(page: Page) {
  await page.getByRole('link', { name: 'Journal' }).click()
  await page.getByRole('button', { name: /new entry/i }).click()
  await page.getByRole('combobox', { name: 'Entry Type' }).selectOption('Trader Reflection')
  await page.getByLabel("What's on your mind?").fill('Proud of following the plan')
  await page.getByRole('combobox', { name: 'Current emotional state' }).selectOption('calm')
  await page.getByRole('radio', { name: '4' }).check()
  await page.getByRole('button', { name: /save entry/i }).click()
}

test('the timeline shows a full lifecycle newest-first, and a plan entry links back to its Trade', async ({
  page,
}) => {
  await onboard(page)
  await planFillAndReview(page)
  await closeTrade(page)
  await writeStandaloneReflection(page)

  await expect(page.getByRole('heading', { name: 'Journal', exact: true })).toBeVisible()
  const items = page.getByRole('list', { name: 'timeline' }).getByRole('listitem')
  await expect(items).toHaveCount(4)

  // Newest first: standalone, close, review, plan.
  await expect(items.nth(0)).toContainText('Standalone')
  await expect(items.nth(0)).toContainText('Proud of following the plan')
  await expect(items.nth(1)).toContainText('Close —')
  await expect(items.nth(1)).toContainText('Let winners run to target')
  await expect(items.nth(2)).toContainText('Review —')
  await expect(items.nth(2)).toContainText('Hold')
  await expect(items.nth(3)).toContainText('Plan —')
  await expect(items.nth(3)).toContainText('Breakout confirmed on volume')

  // Clicking the plan entry's Trade label lands on that Trade.
  await items.nth(3).getByRole('link', { name: 'AAPL' }).click()
  await expect(page.getByRole('heading', { name: 'Trade' })).toBeVisible()
  await expect(page.getByText('AAPL breaks out')).toBeVisible()
})
