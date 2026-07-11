import { test, expect } from '@playwright/test'

async function onboard(page: import('@playwright/test').Page) {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: /set up your first account/i })).toBeVisible()
  await page.getByLabel(/institution name/i).fill('Schwab')
  await page.getByLabel(/account name/i).fill('Taxable')
  await page.getByRole('button', { name: /get started/i }).click()
  await expect(page.getByRole('heading', { name: 'Trades' })).toBeVisible()
}

async function planAndSkipJournal(page: import('@playwright/test').Page, thesis: string) {
  await page.getByRole('link', { name: 'New Trade' }).click()
  await expect(page.getByRole('heading', { name: 'New Trade' })).toBeVisible()
  await page.getByLabel(/thesis/i).fill(thesis)
  await page.getByLabel(/ticker/i).fill('AAPL')
  await page.getByLabel(/quantity/i).fill('100')
  await page.getByLabel(/stop/i).fill('140')
  await page.getByLabel(/target/i).fill('170')
  await page.getByRole('button', { name: /confirm plan/i }).click()
  await expect(page.getByRole('heading', { name: 'Plan journal' })).toBeVisible()
  await page.getByRole('button', { name: /skip/i }).click()
}

test('close a flattened Trade and abandon a planned one (worked example)', async ({ page }) => {
  await onboard(page)

  // Worked example: plan, buy 100 @ 150, sell 100 @ 168 fees 1 → flat.
  await planAndSkipJournal(page, 'AAPL breaks out')

  await page.getByRole('button', { name: /record fill/i }).click()
  await page.getByLabel(/quantity/i).fill('100')
  await page.getByLabel(/price/i).fill('150')
  await page.getByLabel(/fees/i).fill('1')
  await page.getByRole('button', { name: /record fill/i }).click()
  await expect(page.getByLabel('status')).toHaveText(/open/i)

  await page.getByRole('button', { name: /record fill/i }).click()
  await page.getByLabel(/side/i).selectOption('sell')
  await page.getByLabel(/quantity/i).fill('100')
  await page.getByLabel(/price/i).fill('168')
  await page.getByLabel(/fees/i).fill('1')
  await page.getByRole('button', { name: /record fill/i }).click()

  // The flattening fill prompts for a Close Reason. Pick Hit Target and answer.
  await expect(page.getByRole('heading', { name: 'Close this Trade' })).toBeVisible()
  await page.getByLabel(/close reason/i).selectOption('Hit Target')
  await page.getByLabel('Would you take this trade again?').selectOption('yes')
  await page.getByLabel('Lesson').fill('Let winners run to target')
  await page.getByRole('button', { name: /record close/i }).click()

  // Badge closed, reason shown.
  await expect(page.getByLabel('status')).toHaveText(/closed/i)
  await expect(page.getByLabel('close reason')).toHaveText('Hit Target')
  await expect(page.getByText('Let winners run to target')).toBeVisible()

  // Second Trade: plan it, then abandon with Never Filled.
  await page.getByRole('link', { name: 'Trades' }).click()
  await planAndSkipJournal(page, 'MSFT pullback')
  await expect(page.getByLabel('status')).toHaveText(/planned/i)

  await page.getByRole('button', { name: /abandon/i }).click()
  await page.getByLabel(/close reason/i).selectOption('Never Filled')
  await page.getByRole('button', { name: /record close/i }).click()

  await expect(page.getByLabel('status')).toHaveText(/closed/i)
  await expect(page.getByLabel('close reason')).toHaveText('Never Filled')
})
