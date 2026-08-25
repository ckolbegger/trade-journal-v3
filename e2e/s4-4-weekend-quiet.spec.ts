import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'

// S4.4 — quiet weekends & source visibility. Two independent happy paths:
// (1) a review spanning a weekend gap never prompts Saturday/Sunday rows;
// (2) the no-source notice appears on a fresh, unconfigured workspace.

function daysAgo(days: number): string {
  const date = new Date()
  date.setDate(date.getDate() - days)
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

function isWeekend(iso: string): boolean {
  const [year, month, day] = iso.split('-').map(Number)
  const weekday = new Date(year, month - 1, day).getDay()
  return weekday === 0 || weekday === 6
}

async function onboard(page: Page) {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: /set up your first account/i })).toBeVisible()
  await page.getByLabel(/institution name/i).fill('Schwab')
  await page.getByLabel(/account name/i).fill('Taxable')
  await page.getByRole('button', { name: /get started/i }).click()
  await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible()
}

// A fill 9 days ago guarantees the review's gap spans at least one full
// Saturday/Sunday, whatever weekday "today" happens to be.
async function planAndFillNineDaysAgo(page: Page) {
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
  await page.getByLabel(/date/i).fill(daysAgo(9))
  await page.getByRole('button', { name: /record fill/i }).click()
  await expect(page.getByLabel('status')).toHaveText(/open/i)
}

test('a review spanning a weekend gap prompts no Saturday/Sunday rows', async ({ page }) => {
  await onboard(page)
  await planAndFillNineDaysAgo(page)

  await page.getByRole('link', { name: 'Review' }).click()
  await page.getByRole('button', { name: /start review/i }).click()

  const trade = page.getByRole('listitem', { name: 'AAPL', exact: true })
  await expect(trade).toBeVisible()

  for (let days = 9; days >= 0; days--) {
    const date = daysAgo(days)
    const row = trade.getByRole('listitem', { name: `AAPL ${date}`, exact: true })
    if (isWeekend(date)) {
      await expect(row).not.toBeVisible()
    } else {
      await expect(row).toBeVisible()
    }
  }
})

test('the no-source notice appears on a fresh, unconfigured workspace', async ({ page }) => {
  await onboard(page)

  await page.getByRole('link', { name: 'Review' }).click()
  await expect(page.getByLabel('no source notice')).toBeVisible()
  await expect(page.getByLabel('no source notice')).toContainText(/no pricing source configured/i)
})
