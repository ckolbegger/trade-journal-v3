import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'

// The bull-put-spread worked example (docs/plan/slice-07-multi-leg.md, S7.2):
// sell 1 XYZ 2026-08-21 P 100 @ 2.60 fees $0.65, buy 1 XYZ 2026-08-21 P 90 @
// 0.60 fees $0.65 — one linked expiration, two distinct strikes. Marks: short
// put 1.10, long put 0.20 → structure -90.00, unrealized 110.00, total
// 108.70; stop 97 / target Position price 0.50 (75% of the 2.00 credit —
// amended per exit-level ruling 2026-07-19) → plannedRisk 210.00,
// plannedReward 40.00, worstCaseRisk 910.00, maxReward 90.00.

async function onboard(page: Page) {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: /set up your first account/i })).toBeVisible()
  await page.getByLabel(/institution name/i).fill('Schwab')
  await page.getByLabel(/account name/i).fill('Taxable')
  await page.getByRole('button', { name: /get started/i }).click()
  await expect(page.getByRole('heading', { name: 'Trades' })).toBeVisible()
}

test('plans, legs in, and marks a bull put spread — worked-example dashboard numbers', async ({
  page,
}) => {
  await onboard(page)

  // ——— plan: both legs, one linked expiration, per-leg strikes ———
  await page.getByRole('link', { name: 'New Trade' }).click()
  await expect(page.getByRole('heading', { name: 'New Trade' })).toBeVisible()
  await page.getByLabel(/strategy/i).selectOption({ label: 'Bull Put Spread' })
  await page.getByLabel(/thesis/i).fill('XYZ range-bound, bullish bias')
  await page.getByLabel(/ticker/i).fill('XYZ')
  await expect(page.getByLabel(/expiration/i)).toHaveCount(1)
  await page.getByLabel(/expiration/i).fill('2026-08-21')
  const strikes = page.getByLabel(/strike/i)
  await expect(strikes).toHaveCount(2)
  await strikes.nth(0).fill('100')
  await strikes.nth(1).fill('90')
  await page.getByLabel(/quantity.*sell/i).fill('1')
  await page.getByLabel(/quantity.*buy/i).fill('1')
  await page.getByLabel(/stop/i).fill('97')
  await page.getByLabel(/target/i).fill('0.50')
  await page.getByRole('button', { name: /confirm plan/i }).click()
  await expect(page.getByRole('heading', { name: 'Plan journal' })).toBeVisible()
  await page.getByRole('button', { name: /skip/i }).click()

  // ——— leg in: the short put first ———
  await page.getByRole('button', { name: /record fill/i }).click()
  await expect(page.getByLabel(/planned leg/i)).toBeVisible()
  await expect(page.getByLabel(/side/i)).toHaveValue('sell')
  await page.getByLabel(/quantity/i).fill('1')
  await page.getByLabel(/price/i).fill('2.60')
  await page.getByLabel(/fees/i).fill('0.65')
  await page.getByRole('button', { name: /record fill/i }).click()
  await expect(page.getByLabel('status')).toHaveText(/open/i)

  // ——— leg in: the long put second ———
  await page.getByRole('button', { name: /record fill/i }).click()
  await expect(page.getByLabel(/side/i)).toHaveValue('buy')
  await page.getByLabel(/quantity/i).fill('1')
  await page.getByLabel(/price/i).fill('0.60')
  await page.getByLabel(/fees/i).fill('0.65')
  await page.getByRole('button', { name: /record fill/i }).click()

  // The position lists both Legs signed.
  await expect(page.getByLabel('position')).toContainText("-1 × XYZ Aug'26 100P")
  await expect(page.getByLabel('position')).toContainText("1 × XYZ Aug'26 90P")

  // ——— marks: both contracts ———
  await expect(page.getByText(/enter today's price/i)).toBeVisible()
  const marks = page.getByLabel(/today's mark/i)
  await marks.first().fill('1.10')
  await page
    .getByRole('button', { name: /save mark/i })
    .first()
    .click()
  await expect(page.getByLabel(/today's mark/i)).toHaveCount(1)
  await page.getByLabel(/today's mark/i).fill('0.20')
  await page.getByRole('button', { name: /save mark/i }).click()

  // ——— the worked-example numbers ———
  const pnl = page.getByLabel('profit and loss', { exact: true })
  await expect(pnl).toContainText('-90.00')
  await expect(pnl).toContainText('110.00')
  await expect(pnl).toContainText('1.30')
  await expect(pnl).toContainText('108.70')

  const rr = page.getByLabel('ongoing risk and reward')
  await expect(rr.getByLabel('planned risk')).toContainText('210.00')
  await expect(rr.getByLabel('worst-case risk')).toContainText('910.00')
  await expect(rr.getByLabel('planned reward')).toContainText('40.00')
  await expect(rr.getByLabel('max reward')).toContainText('90.00')
})
