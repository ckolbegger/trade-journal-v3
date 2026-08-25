import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'

// S1.9 — the Daily Review walk carries both this story's additions: a
// one-tap "Nothing to note today" decline, and the Considered prompt for a
// written Action. Reopening Review shows both Trades reviewed, nothing owed,
// and the timeline carries the second Trade's considered-action.

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
  await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible()
}

async function planAndFill(page: Page, ticker: string) {
  await page.getByRole('link', { name: 'Trades' }).click()
  await page.getByRole('link', { name: 'New Trade' }).click()
  await page.getByLabel(/thesis/i).fill(`${ticker} breaks out`)
  await page.getByLabel(/ticker/i).fill(ticker)
  await page.getByLabel(/quantity/i).fill('100')
  await page.getByLabel(/stop/i).fill('140')
  await page.getByLabel(/target/i).fill('170')
  await page.getByRole('button', { name: /confirm plan/i }).click()

  await expect(page.getByRole('heading', { name: 'Plan journal' })).toBeVisible()
  await page.getByRole('button', { name: /write journal entry/i }).click()

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

// Fills every currently-listed gap row with the same price, one at a time —
// avoids hardcoding which calendar dates the market was open on (weekends
// simply never produce a row, domain/dates.isMarketClosed). Waits for each
// row to actually leave the DOM before moving to the next, so a re-render
// mid-save never races the next lookup.
async function fillAllMarks(page: Page, price: string) {
  const list = page.getByRole('list', { name: 'marks needed' })
  for (;;) {
    const rows = list.getByRole('listitem')
    if ((await rows.count()) === 0) return
    const row = rows.first()
    const label = await row.getAttribute('aria-label')
    if (!label) return
    await row.getByLabel(/price/i).fill(price)
    await row.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(page.getByRole('listitem', { name: label, exact: true })).toHaveCount(0)
  }
}

test('declining one checkpoint and writing a considered-action on the other both mark the walk reviewed', async ({
  page,
}) => {
  await onboard(page)
  await planAndFill(page, 'AAPL')
  await planAndFill(page, 'MSFT')

  await beginWalk(page)
  await expect(page.getByLabel('progress')).toHaveText(/0 of 2/)

  // ——— checkpoint 1: AAPL — "nothing to note today" ———
  await expect(page.getByRole('heading', { name: 'AAPL' })).toBeVisible()
  await fillAllMarks(page, '160')
  await page.getByRole('button', { name: /nothing to note today/i }).click()
  await expect(page.getByLabel('progress')).toHaveText(/1 of 2/)
  // Writing stays live — no disabled fields, no "action recorded" lock.
  await expect(page.getByLabel(/what will you do with this trade/i)).toBeEditable()

  await page.getByRole('button', { name: /next trade/i }).click()

  // ——— checkpoint 2: MSFT — an Action plus a written considered-action ———
  await expect(page.getByRole('heading', { name: 'MSFT' })).toBeVisible()
  await fillAllMarks(page, '160')

  await page.getByLabel(/what will you do with this trade/i).selectOption('Hold')
  await page
    .getByLabel(/anything you considered doing and decided against/i)
    .fill('Thought about adding, held off')
  await page.getByRole('button', { name: /record action/i }).click()
  await expect(page.getByLabel('action recorded')).toHaveText('Hold')
  await expect(page.getByLabel('progress')).toHaveText(/2 of 2/)

  await page.getByRole('button', { name: /next trade/i }).click()

  // ——— completion ———
  const summary = page.getByRole('list', { name: 'walk summary' })
  await expect(summary.getByRole('listitem', { name: 'AAPL' })).toContainText('Reviewed')
  await expect(summary.getByRole('listitem', { name: 'MSFT' })).toContainText('Reviewed')

  // Reopening Review: both flagged reviewed, nothing owed.
  await page.reload()
  await beginWalk(page)
  await expect(page.getByLabel('progress')).toHaveText(/2 of 2/)
  await expect(page.getByRole('list', { name: 'journal owed' })).toHaveCount(0)

  // The timeline carries MSFT's written considered-action.
  await page.getByRole('link', { name: 'Journal' }).click()
  await expect(page.getByRole('heading', { name: 'Journal', exact: true })).toBeVisible()
  const items = page.getByRole('list', { name: 'timeline' }).getByRole('listitem')
  await expect(items.filter({ hasText: 'Thought about adding, held off' })).toHaveCount(1)
})
