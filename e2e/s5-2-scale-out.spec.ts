import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'

// S5.2 partial close with FIFO: the full worked example (docs/plan/slice-05-scaling.md)
// — buy 100 @ 150.00 fees 1.00 (Lot A), buy 100 @ 160.00 fees 1.00 (Lot B),
// sell 120 @ 165.00 fees 1.00 (realizes 1597.00, leaves 80 shares basis
// 12800.00, unrealized 400.00 at mark 165), then sell 80 @ 170.00 fees 1.00
// (adds 799.00, totaling 2396.00, Trade flat).

async function onboard(page: Page) {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: /set up your first account/i })).toBeVisible()
  await page.getByLabel(/institution name/i).fill('Schwab')
  await page.getByLabel(/account name/i).fill('Taxable')
  await page.getByRole('button', { name: /get started/i }).click()
  await expect(page.getByRole('heading', { name: 'Trades' })).toBeVisible()
}

async function recordFill(
  page: Page,
  { side, qty, price, fees }: { side?: 'buy' | 'sell'; qty: string; price: string; fees: string },
) {
  await page.getByRole('button', { name: /record fill/i }).click()
  if (side) await page.getByLabel(/side/i).selectOption(side)
  await page.getByLabel(/quantity/i).fill(qty)
  await page.getByLabel(/price/i).fill(price)
  await page.getByLabel(/fees/i).fill(fees)
  await page.getByRole('button', { name: /record fill/i }).click()
}

test('scale out of a position across a partial and a final close (worked example)', async ({
  page,
}) => {
  await onboard(page)

  await page.getByRole('link', { name: 'New Trade' }).click()
  await expect(page.getByRole('heading', { name: 'New Trade' })).toBeVisible()
  await page.getByLabel(/thesis/i).fill('AAPL breaks out')
  await page.getByLabel(/ticker/i).fill('AAPL')
  await page.getByLabel(/quantity/i).fill('100')
  await page.getByLabel(/stop/i).fill('140')
  await page.getByLabel(/target/i).fill('170')
  await page.getByRole('button', { name: /confirm plan/i }).click()
  await expect(page.getByRole('heading', { name: 'Plan journal' })).toBeVisible()
  await page.getByRole('button', { name: /skip/i }).click()

  // Lot A and Lot B — the S5.1 scaling in.
  await recordFill(page, { qty: '100', price: '150', fees: '1' })
  await recordFill(page, { qty: '100', price: '160', fees: '1' })
  await expect(page.getByLabel('position')).toContainText('200')

  // Partial close: sell 120 @ 165.00, fees 1.00 — consumes Lot A fully and 20
  // of Lot B. No Close Reason prompt — the Trade is still open, 80 held.
  await recordFill(page, { side: 'sell', qty: '120', price: '165', fees: '1' })
  await expect(page.getByLabel('status')).toHaveText(/open/i)
  await expect(page.getByLabel('position')).toContainText('80')
  await expect(page.getByRole('heading', { name: 'Close this Trade' })).not.toBeVisible()

  // Enter today's Mark (165.00) to unlock realized/unrealized P&L.
  await page.getByLabel(/mark/i).fill('165')
  await page.getByRole('button', { name: /save mark/i }).click()

  const pnlAfterPartial = page.getByLabel('profit and loss')
  await expect(pnlAfterPartial).toContainText('1597.00') // realized
  await expect(pnlAfterPartial).toContainText('400.00') // unrealized on the remainder

  // History shows both closes plainly, alongside the two opening fills.
  const historyRows = page.getByLabel('execution history').getByRole('listitem')
  await expect(historyRows).toHaveCount(3)
  await expect(historyRows.nth(2)).toContainText('165.00')

  // Final close: sell the remaining 80 @ 170.00, fees 1.00 — flattens the
  // Trade and prompts for a Close Reason as usual.
  await recordFill(page, { side: 'sell', qty: '80', price: '170', fees: '1' })
  await expect(page.getByRole('heading', { name: 'Close this Trade' })).toBeVisible()
  await page.getByLabel(/close reason/i).selectOption('Hit Target')
  await page.getByRole('button', { name: /record close/i }).click()

  await expect(page.getByLabel('status')).toHaveText(/closed/i)
  const pnlFinal = page.getByLabel('profit and loss')
  await expect(pnlFinal).toContainText('2396.00') // total realized, both fee models agree once flat

  const finalHistoryRows = page.getByLabel('execution history').getByRole('listitem')
  await expect(finalHistoryRows).toHaveCount(4)
})
