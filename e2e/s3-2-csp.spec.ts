import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'

async function onboard(page: Page) {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: /set up your first account/i })).toBeVisible()
  await page.getByLabel(/institution name/i).fill('Schwab')
  await page.getByLabel(/account name/i).fill('Taxable')
  await page.getByRole('button', { name: /get started/i }).click()
  await expect(page.getByRole('heading', { name: 'Trades' })).toBeVisible()
}

// Plans the worked-example cash-secured put, skips the Plan journal, and
// records the sell-to-open fill — leaving the browser on the open Trade's
// detail page.
async function planAndSellCsp(page: Page) {
  await page.getByRole('link', { name: 'New Trade' }).click()
  await expect(page.getByRole('heading', { name: 'New Trade' })).toBeVisible()
  await page.getByLabel(/strategy/i).selectOption({ label: 'Cash-Secured Put' })
  await page.getByLabel(/thesis/i).fill('XYZ range-bound')
  await page.getByLabel(/ticker/i).fill('XYZ')
  await page.getByLabel(/expiration/i).fill('2026-08-21')
  await page.getByLabel(/strike/i).fill('100')
  await page.getByLabel(/quantity/i).fill('1')
  await page.getByLabel(/stop/i).fill('95')
  await page.getByLabel(/target/i).fill('0.50')
  await page.getByRole('button', { name: /confirm plan/i }).click()
  await expect(page.getByRole('heading', { name: 'Plan journal' })).toBeVisible()
  await page.getByRole('button', { name: /skip/i }).click()

  await page.getByRole('button', { name: /record fill/i }).click()
  await page.getByLabel(/quantity/i).fill('1')
  await page.getByLabel(/price/i).fill('2.50')
  await page.getByLabel(/fees/i).fill('0.65')
  await page.getByRole('button', { name: /record fill/i }).click()
  await expect(page.getByLabel('status')).toHaveText(/open/i)
}

test('plans, sells, and marks a cash-secured put — worked-example dashboard numbers', async ({
  page,
}) => {
  await onboard(page)
  await planAndSellCsp(page)

  // The position reads negative — a short contract, not a long one.
  await expect(page.getByLabel('position')).toContainText("-1 × XYZ Aug'26 100P")

  // No Mark yet → the dashboard prompts for today's price instead of numbers.
  await expect(page.getByText(/enter today's price/i)).toBeVisible()

  // Enter the worked-example contract Mark: 1.25.
  await page.getByLabel(/mark/i).fill('1.25')
  await page.getByRole('button', { name: /save mark/i }).click()

  // The worked-example numbers appear (docs/plan/slice-03-single-leg-options.md):
  // currentValue -125.00, unrealized 125.00, fees 0.65, total 124.35 — a credit
  // trade shows honest mark-to-market risk, not "premium collected" comfort.
  const pnl = page.getByLabel('profit and loss')
  await expect(pnl).toContainText('-125.00')
  await expect(pnl).toContainText('124.35')

  // ADR-0010 framing: risking $375 (to the stop) to make $75 (to the target),
  // both counting the unrealized gain already banked — not "premium collected."
  const rr = page.getByLabel('ongoing risk and reward')
  await expect(rr.getByLabel('planned risk')).toContainText('375.00')
  await expect(rr.getByLabel('worst-case risk')).toContainText('9875.00')
  await expect(rr.getByLabel('planned reward')).toContainText('75.00')
  await expect(rr.getByLabel('max reward')).toContainText('125.00')

  // The underlying-stop projection is explained as intrinsic (ADR 0009 — no
  // pricing model exists to value the time remaining).
  await expect(rr.getByText(/at intrinsic/i)).toBeVisible()

  // Buy back at 0.60 — the Trade flattens and prompts for a Close Reason.
  await page.getByRole('button', { name: /record fill/i }).click()
  await page.getByLabel(/side/i).selectOption('buy')
  await page.getByLabel(/quantity/i).fill('1')
  await page.getByLabel(/price/i).fill('0.60')
  await page.getByLabel(/fees/i).fill('0.65')
  await page.getByRole('button', { name: /record fill/i }).click()

  await expect(page.getByLabel(/close reason/i)).toBeVisible()
})
