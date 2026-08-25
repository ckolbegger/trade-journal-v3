import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'

// The covered-call worked example (docs/plan/slice-07-multi-leg.md, S7.1):
// buy 100 XYZ @ 50.00 fees $1.00; sell 1 XYZ 2026-09-18 C 55 @ 1.50 fees
// $0.65, legged in as two fills against ONE Trade — the call's strike/
// expiration left TBD at plan time, completed by its fill. Marks: stock
// 52.00, call 1.00 → currentValue 5,100.00, unrealized 250.00, total 248.35;
// stop 46 / target 55 → plannedRisk 500.00, plannedReward 400.00,
// worstCaseRisk 5,100.00, maxReward 400.00 CAPPED (not "Unlimited").

async function onboard(page: Page) {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: /set up your first account/i })).toBeVisible()
  await page.getByLabel(/institution name/i).fill('Schwab')
  await page.getByLabel(/account name/i).fill('Taxable')
  await page.getByRole('button', { name: /get started/i }).click()
  await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible()
}

test('plans, legs in, and marks a covered call — worked-example dashboard numbers', async ({
  page,
}) => {
  await onboard(page)
  await page.getByRole('link', { name: 'Trades' }).click()

  // ——— plan: both legs pre-filled from the Covered Call template, the call TBD ———
  await page.getByRole('link', { name: 'New Trade' }).click()
  await expect(page.getByRole('heading', { name: 'New Trade' })).toBeVisible()
  await page.getByLabel(/strategy/i).selectOption({ label: 'Covered Call' })
  await page.getByLabel(/thesis/i).fill('Sell premium against XYZ stock')
  await page.getByLabel(/ticker/i).fill('XYZ')
  await expect(page.getByText(/strike tbd/i)).toBeVisible()
  await page.getByLabel(/quantity.*buy/i).fill('100')
  await page.getByLabel(/quantity.*sell/i).fill('1')
  await page.getByLabel(/stop/i).fill('46')
  await page.getByLabel(/target/i).fill('55')
  await page.getByRole('button', { name: /confirm plan/i }).click()
  await expect(page.getByRole('heading', { name: 'Plan journal' })).toBeVisible()
  await page.getByRole('button', { name: /skip/i }).click()

  // ——— leg in: the stock fill first ———
  await page.getByRole('button', { name: /record fill/i }).click()
  await expect(page.getByLabel(/planned leg/i)).toBeVisible()
  await page.getByLabel(/quantity/i).fill('100')
  await page.getByLabel(/price/i).fill('50.00')
  await page.getByLabel(/fees/i).fill('1.00')
  await page.getByRole('button', { name: /record fill/i }).click()
  await expect(page.getByLabel('status')).toHaveText(/open/i)

  // ——— leg in: the call fill later, completing its TBD strike/expiration ———
  await page.getByRole('button', { name: /record fill/i }).click()
  await expect(page.getByRole('textbox', { name: 'Expiration' })).toBeVisible()
  await page.getByRole('textbox', { name: 'Expiration' }).fill('2026-09-18')
  await page.getByRole('textbox', { name: 'Strike' }).fill('55')
  await expect(page.getByLabel(/side/i)).toHaveValue('sell')
  await page.getByLabel(/quantity/i).fill('1')
  await page.getByLabel(/price/i).fill('1.50')
  await page.getByLabel(/fees/i).fill('0.65')
  await page.getByRole('button', { name: /record fill/i }).click()

  // The position lists both Legs signed.
  await expect(page.getByLabel('position')).toContainText('100 XYZ long')
  await expect(page.getByLabel('position')).toContainText("-1 × XYZ Sep'26 55C")

  // ——— marks: both the stock and the contract ———
  await expect(page.getByText(/enter today's price/i)).toBeVisible()
  const marks = page.getByLabel(/today's mark/i)
  await marks.first().fill('52.00')
  await page
    .getByRole('button', { name: /save mark/i })
    .first()
    .click()
  await expect(page.getByLabel(/today's mark/i)).toHaveCount(1)
  await page.getByLabel(/today's mark/i).fill('1.00')
  await page.getByRole('button', { name: /save mark/i }).click()

  // ——— the worked-example numbers ———
  const pnl = page.getByLabel('profit and loss', { exact: true })
  await expect(pnl).toContainText('5100.00')
  await expect(pnl).toContainText('250.00')
  await expect(pnl).toContainText('1.65')
  await expect(pnl).toContainText('248.35')

  const perLeg = page.getByLabel('per-leg profit and loss')
  await expect(perLeg).toContainText('XYZ')
  await expect(perLeg).toContainText("XYZ Sep'26 55C")

  const rr = page.getByLabel('ongoing risk and reward')
  await expect(rr.getByLabel('planned risk')).toContainText('500.00')
  await expect(rr.getByLabel('worst-case risk')).toContainText('5100.00')
  await expect(rr.getByLabel('planned reward')).toContainText('400.00')
  // The short call caps the upside — the math yields a NUMBER, never
  // "Unlimited", even though the stock leg alone would be unbounded.
  await expect(rr.getByLabel('max reward')).toContainText('400.00')
  await expect(rr.getByLabel('max reward')).not.toContainText(/unlimited/i)
})
