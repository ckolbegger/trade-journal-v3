import { test, expect } from '@playwright/test'

async function onboard(page: import('@playwright/test').Page) {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: /set up your first account/i })).toBeVisible()
  await page.getByLabel(/institution name/i).fill('Schwab')
  await page.getByLabel(/account name/i).fill('Taxable')
  await page.getByRole('button', { name: /get started/i }).click()
  await expect(page.getByRole('heading', { name: 'Trades' })).toBeVisible()
}

async function fillPlan(page: import('@playwright/test').Page, thesis: string) {
  await page.getByRole('link', { name: 'New Trade' }).click()
  await expect(page.getByRole('heading', { name: 'New Trade' })).toBeVisible()
  await page.getByLabel(/thesis/i).fill(thesis)
  await page.getByLabel(/ticker/i).fill('AAPL')
  await page.getByLabel(/quantity/i).fill('100')
  await page.getByLabel(/stop/i).fill('140')
  await page.getByLabel(/target/i).fill('170')
  await page.getByRole('button', { name: /confirm plan/i }).click()
}

test('journal the plan at confirm, and skip it as debt', async ({ page }) => {
  await onboard(page)

  // First Trade: confirm the plan, then answer the Plan journal prompts.
  await fillPlan(page, 'AAPL breaks out')
  await expect(page.getByRole('heading', { name: 'Plan journal' })).toBeVisible()
  await page.getByLabel('Why this trade, why now?').fill('Breakout confirmed on volume')
  await page.getByRole('radio', { name: '4' }).check()
  await page.getByLabel('Emotional state').selectOption('calm')
  await page.getByRole('button', { name: /write journal entry/i }).click()

  // Detail shows the written entry with its prompts and answers.
  await expect(page.getByText('Breakout confirmed on volume')).toBeVisible()
  await expect(page.getByText('calm')).toBeVisible()
  await expect(page.getByLabel('journal entries')).toHaveText('1')
  await expect(page.getByLabel('journal owed')).toHaveCount(0)

  // Second Trade: skip the Plan journal — it becomes Journal Debt (owed marker).
  await page.getByRole('link', { name: 'Trades' }).click()
  await fillPlan(page, 'MSFT pullback')
  await expect(page.getByRole('heading', { name: 'Plan journal' })).toBeVisible()
  await page.getByRole('button', { name: /skip/i }).click()

  await expect(page.getByLabel('journal owed')).toBeVisible()
  await expect(page.getByLabel('journal entries')).toHaveText('1')
})
