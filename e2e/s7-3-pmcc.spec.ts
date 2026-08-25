import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'

// The PMCC worked example (docs/plan/slice-07-multi-leg.md, S7.3): buy 1
// AAPL 2028-01-21 C 150 @ 62.00 fees $0.65, sell 1 AAPL 2026-09-18 C 220 @
// 3.00 fees $0.65 — the far leg concrete, the near leg TBD until its fill,
// two DIFFERENT expirations. Marks: LEAP 65.00, short call 2.00 →
// currentValue 6,300.00, unrealized 400.00, total 398.70; Position price
// stop 55.00 / target 68.00 (net quote — amended per exit-level ruling
// 2026-07-19) → plannedRisk 800.00, plannedReward 500.00; worstCaseRisk
// 6,300.00, maxReward 700.00.

async function onboard(page: Page) {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: /set up your first account/i })).toBeVisible()
  await page.getByLabel(/institution name/i).fill('Schwab')
  await page.getByLabel(/account name/i).fill('Taxable')
  await page.getByRole('button', { name: /get started/i }).click()
  await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible()
}

test('plans, legs in, and marks a PMCC — worked-example dashboard numbers and mixed expirations', async ({
  page,
}) => {
  await onboard(page)
  await page.getByRole('link', { name: 'Trades' }).click()

  // ——— plan: the far LEAP concrete, the near call TBD ———
  await page.getByRole('link', { name: 'New Trade' }).click()
  await expect(page.getByRole('heading', { name: 'New Trade' })).toBeVisible()
  await page.getByLabel(/strategy/i).selectOption({ label: 'PMCC' })
  await page.getByLabel(/thesis/i).fill('PMCC on AAPL')
  await page.getByLabel(/ticker/i).fill('AAPL')

  const expirations = page.getByLabel(/expiration/i)
  await expect(expirations).toHaveCount(2)
  await expirations.nth(0).fill('2028-01-21')
  const strikes = page.getByLabel(/strike/i)
  await expect(strikes).toHaveCount(2)
  await strikes.nth(0).fill('150')
  await expect(page.getByText(/strike tbd/i)).toBeVisible()
  await expect(page.getByText(/expiration tbd/i)).toBeVisible()

  await page.getByLabel(/quantity.*buy/i).fill('1')
  await page.getByLabel(/quantity.*sell/i).fill('1')
  await page.getByLabel(/stop/i).fill('55.00')
  await page.getByLabel(/target/i).fill('68.00')
  await page.getByRole('button', { name: /confirm plan/i }).click()
  await expect(page.getByRole('heading', { name: 'Plan journal' })).toBeVisible()
  await page.getByRole('button', { name: /skip/i }).click()

  // ——— leg in: the LEAP first ———
  await page.getByRole('button', { name: /record fill/i }).click()
  await expect(page.getByLabel(/planned leg/i)).toBeVisible()
  await expect(page.getByLabel(/side/i)).toHaveValue('buy')
  await page.getByLabel(/quantity/i).fill('1')
  await page.getByLabel(/price/i).fill('62.00')
  await page.getByLabel(/fees/i).fill('0.65')
  await page.getByRole('button', { name: /record fill/i }).click()
  await expect(page.getByLabel('status')).toHaveText(/open/i)

  // ——— leg in: the near call later, completing its TBD strike/expiration ———
  await page.getByRole('button', { name: /record fill/i }).click()
  await expect(page.getByRole('textbox', { name: 'Expiration' })).toBeVisible()
  await page.getByRole('textbox', { name: 'Expiration' }).fill('2026-09-18')
  await page.getByRole('textbox', { name: 'Strike' }).fill('220')
  await expect(page.getByLabel(/side/i)).toHaveValue('sell')
  await page.getByLabel(/quantity/i).fill('1')
  await page.getByLabel(/price/i).fill('3.00')
  await page.getByLabel(/fees/i).fill('0.65')
  await page.getByRole('button', { name: /record fill/i }).click()

  // The position lists both Legs signed, with their MIXED expirations.
  await expect(page.getByLabel('position')).toContainText("1 × AAPL Jan'28 150C")
  await expect(page.getByLabel('position')).toContainText("-1 × AAPL Sep'26 220C")

  // ——— marks: both contracts ———
  await expect(page.getByText(/enter today's price/i)).toBeVisible()
  const marks = page.getByLabel(/today's mark/i)
  await marks.first().fill('65.00')
  await page
    .getByRole('button', { name: /save mark/i })
    .first()
    .click()
  await expect(page.getByLabel(/today's mark/i)).toHaveCount(1)
  await page.getByLabel(/today's mark/i).fill('2.00')
  await page.getByRole('button', { name: /save mark/i }).click()

  // ——— the worked-example numbers ———
  const pnl = page.getByLabel('profit and loss', { exact: true })
  await expect(pnl).toContainText('6300.00')
  await expect(pnl).toContainText('400.00')
  await expect(pnl).toContainText('1.30')
  await expect(pnl).toContainText('398.70')

  const rr = page.getByLabel('ongoing risk and reward')
  await expect(rr.getByLabel('planned risk')).toContainText('800.00')
  await expect(rr.getByLabel('worst-case risk')).toContainText('6300.00')
  await expect(rr.getByLabel('planned reward')).toContainText('500.00')
  await expect(rr.getByLabel('max reward')).toContainText('700.00')
})
