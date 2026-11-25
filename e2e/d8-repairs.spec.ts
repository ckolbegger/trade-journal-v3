import { expect, test, type Page } from '@playwright/test'

async function onboard(page: Page) {
  await page.goto('/')
  await expect(page.locator('main')).toHaveAttribute('data-view', /^(empty|ready)$/)
  if (await page.locator('[aria-label="Institutions"] li').count() === 0) {
    await page.getByLabel('Institution name').fill('Schwab')
    await page.getByRole('button', { name: 'Add institution' }).click()
  }
  if (await page.locator('[aria-label="Accounts"] li').count() === 0) {
    await page.locator('#acct-inst').selectOption({ label: 'Schwab' })
    await page.getByLabel('Account name').fill('Main')
    await page.getByRole('button', { name: 'Add account' }).click()
  }
  await page.getByRole('button', { name: 'New Plan' }).click()
}

async function fillOption(page: Page, strategy: string, kind: string, strike: string, thesis: string) {
  await page.getByLabel('Strategy').selectOption(strategy)
  await page.getByLabel('Underlying').fill('AAPL')
  await page.getByLabel('Quantity').fill('2')
  await page.getByLabel('Entry price').fill('3.00')
  await page.getByLabel('Stop price').fill('1.00')
  await page.getByLabel('Target price').fill('7.00')
  await page.getByLabel('Option type').selectOption(kind)
  await page.getByLabel('Strike').fill(strike)
  await page.getByLabel('Expiration').fill('2026-12-18')
  await page.getByLabel('Multiplier').fill('100')
  await page.getByLabel('Thesis').fill(thesis)
  await page.getByLabel('Invalidation').fill('below trend')
}

const tradeRows = (page: Page) => page.evaluate(async () => {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const r = indexedDB.open('tjv3'); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error)
  })
  return await new Promise<{ id: string; plan?: { strategyId?: string } }[]>((resolve, reject) => {
    const r = db.transaction('trade').objectStore('trade').getAll()
    r.onsuccess = () => resolve(r.result as { id: string; plan?: { strategyId?: string } }[])
    r.onerror = () => reject(r.error)
  })
})

test('should keep two identical same-day option Plans as distinct Trades', async ({ page }) => {
  await onboard(page)
  await fillOption(page, 'seed-long-call', 'Call', '190', 'first thesis')
  await page.getByRole('button', { name: 'Confirm plan' }).click()
  await page.getByRole('button', { name: 'New Plan' }).click()
  await fillOption(page, 'seed-long-call', 'Call', '190', 'second thesis')
  await page.getByRole('button', { name: 'Confirm plan' }).click()
  const rows = (await tradeRows(page)).filter(r => r.plan?.strategyId === 'seed-long-call')
  expect(rows).toHaveLength(2)
  expect(new Set(rows.map(r => r.id)).size).toBe(2)
})

test('should show the FIFO Lot Match immediately after a close, before reload', async ({ page }) => {
  await onboard(page)
  await fillOption(page, 'seed-long-call', 'Call', '190', 'why now')
  await page.getByRole('button', { name: 'Confirm plan' }).click()
  await page.getByRole('region', { name: 'Planned trades' }).getByText('AAPL').click()
  await page.getByRole('button', { name: 'Add execution' }).click()
  await page.getByLabel('Execution 1 instrument').fill('AAPL 190Call 2026-12-18 x100')
  await page.getByLabel('Execution 1 quantity').fill('2')
  await page.getByLabel('Execution 1 price').fill('3.00')
  await page.getByLabel('Execution 1 fee').fill('1.00')
  await page.getByLabel('Execution 1 economic time').fill('2026-11-24T20:00:00Z')
  await page.getByRole('radio', { name: 'Defer reflection' }).check()
  await page.getByRole('button', { name: 'Record position change' }).click()
  await page.getByRole('button', { name: 'Close position' }).click()
  const close = page.getByRole('form', { name: 'Close position' })
  await close.getByLabel('Close 1 instrument').fill('AAPL 190Call 2026-12-18 x100')
  await close.getByLabel('Close 1 quantity').fill('2')
  await close.getByLabel('Close 1 price').fill('5.00')
  await close.getByLabel('Close 1 fee').fill('1.00')
  await close.getByLabel('Close 1 economic time').fill('2026-11-25T20:00:00Z')
  await close.getByLabel('Close reason').selectOption('Target Reached')
  await close.getByRole('button', { name: 'Record close' }).click()
  await expect(page.getByTestId('closed-realized-pnl')).toHaveText('398.00')
  await expect(page.getByTestId('closed-lot-matches')).toHaveText('1')
  await expect(page.getByRole('region', { name: 'Lot Matches' })).toContainText('FIFO')
  await expect(page.getByRole('region', { name: 'Lot Matches' })).toContainText('opening fee 1.00 · disposal fee 1.00')
})

test('should show the short opening action on a Cash-Secured Put execution form', async ({ page }) => {
  await onboard(page)
  await fillOption(page, 'seed-cash-secured-put', 'Put', '190', 'why now')
  await page.getByRole('button', { name: 'Confirm plan' }).click()
  await page.getByRole('region', { name: 'Planned trades' }).getByText('AAPL').click()
  await page.getByRole('button', { name: 'Add execution' }).click()
  await expect(page.locator('.action-pill')).toHaveText('Sell')
})

test('should bound a Long Put payoff at its correct attainment ranges', async ({ page }) => {
  await onboard(page)
  await fillOption(page, 'seed-long-put', 'Put', '180', 'why now')
  await page.getByRole('button', { name: 'Confirm plan' }).click()
  await page.getByRole('region', { name: 'Planned trades' }).getByText('AAPL').click()
  const panel = page.getByTestId('payoff-panel')
  await expect(panel).toContainText('Break-even: 177')
  await expect(panel).toContainText('Minimum: -600.00 on 180..Infinity')
  await expect(panel).toContainText('Maximum: 35400.00 on 0..0')
  await expect(panel).not.toContainText('Unbounded')
})
