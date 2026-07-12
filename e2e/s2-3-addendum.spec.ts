import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'

// Growing an immutable entry: an addendum added to a plan entry from Trade
// detail appears nested there — and on the Journal timeline too, since both
// surfaces read the same growth story (S2.3 — journal.md).

async function onboard(page: Page) {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: /set up your first account/i })).toBeVisible()
  await page.getByLabel(/institution name/i).fill('Schwab')
  await page.getByLabel(/account name/i).fill('Taxable')
  await page.getByRole('button', { name: /get started/i }).click()
  await expect(page.getByRole('heading', { name: 'Trades' })).toBeVisible()
}

async function planWithJournal(page: Page) {
  await page.getByRole('link', { name: 'New Trade' }).click()
  await expect(page.getByRole('heading', { name: 'New Trade' })).toBeVisible()
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
}

test('add an addendum to a plan entry from Trade detail: nested there and on the timeline', async ({
  page,
}) => {
  await onboard(page)
  await planWithJournal(page)

  // Trade detail shows the plan entry — grow it with an addendum.
  await expect(page.getByText('Breakout confirmed on volume')).toBeVisible()
  await page.getByRole('button', { name: /add addendum/i }).click()
  await page.getByLabel('Why this trade, why now?').fill('Hindsight: the breakout held for a week')
  await page.getByRole('button', { name: /save addendum/i }).click()

  const addendaOnDetail = page.getByLabel('addenda')
  await expect(addendaOnDetail).toBeVisible()
  await expect(addendaOnDetail).toContainText('Hindsight: the breakout held for a week')
  // No edit affordance anywhere on the page.
  await expect(page.getByRole('button', { name: /^edit/i })).toHaveCount(0)

  // The same growth story shows on the Journal timeline, nested under the root.
  await page.getByRole('link', { name: 'Journal' }).click()
  await expect(page.getByRole('heading', { name: 'Journal', exact: true })).toBeVisible()
  // Direct children only — a nested addendum is also a `listitem`, so this
  // avoids double-counting it as its own top-level timeline row.
  const items = page.getByRole('list', { name: 'timeline' }).locator('> li')
  await expect(items).toHaveCount(1)
  await expect(items.first()).toContainText('Plan —')
  await expect(items.first()).toContainText('Breakout confirmed on volume')
  const addendaOnTimeline = items.first().getByLabel('addenda')
  await expect(addendaOnTimeline).toContainText('Hindsight: the breakout held for a week')
})
