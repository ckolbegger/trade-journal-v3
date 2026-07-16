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
  await expect(page.getByRole('heading', { name: 'Trades' })).toBeVisible()
}

// Plans and fills a long call — the worked-example instrument (docs/plan/
// slice-03-single-leg-options.md), leaving the browser on the open Trade's
// detail page.
async function planAndFillCall(page: Page) {
  await page.getByRole('link', { name: 'New Trade' }).click()
  await page.getByLabel(/strategy/i).selectOption({ label: 'Long Call' })
  await page.getByLabel(/thesis/i).fill('AAPL breaks out')
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
  await page.getByRole('button', { name: /record fill/i }).click()
  await expect(page.getByLabel('status')).toHaveText(/open/i)
}

async function goToTheTrade(page: Page) {
  await page.getByRole('link', { name: 'Trades' }).click()
  await page.getByRole('link', { name: /AAPL.*200C/ }).click()
}

test('marked long call shows an IV percentage; changing the rate in Settings changes it', async ({
  page,
}) => {
  await onboard(page)
  await planAndFillCall(page)

  // The contract Mark, entered directly on the Trade detail page.
  await page.getByLabel(/mark/i).fill('14')
  await page.getByRole('button', { name: /save mark/i }).click()
  await expect(page.getByLabel('profit and loss')).toBeVisible()

  // The underlying Mark arrives via the Daily Review walk — the only place
  // both the contract and underlying are prompted for (S3.1.T4).
  await page.getByRole('link', { name: 'Review' }).click()
  await page.getByRole('button', { name: /start review/i }).click()
  await page.getByRole('button', { name: /begin walk/i }).click()
  const row = page.getByRole('listitem', { name: `AAPL ${TODAY}`, exact: true })
  await row.getByLabel(/price/i).fill('205')
  await row.getByRole('button', { name: 'Save', exact: true }).click()

  const marks = page.getByLabel('option marks')
  await expect(marks).toContainText(/IV \d+%/)
  const before = await marks.textContent()

  // Changing the risk-free rate in Settings changes the recovered IV for the
  // same Marks (a lower rate, still within reach of this deep-ITM contract's
  // discounted-intrinsic floor — see domain/trademath/implied-vol.ts).
  await page.getByRole('link', { name: 'Settings' }).click()
  const rateField = page.getByLabel(/risk-free rate/i)
  await rateField.fill('1')
  await page.getByRole('button', { name: /save rate/i }).click()

  await goToTheTrade(page)
  const marksAfter = page.getByLabel('option marks')
  await expect(marksAfter).toContainText(/IV \d+%/)
  await expect(async () => {
    expect(await marksAfter.textContent()).not.toBe(before)
  }).toPass()
})
