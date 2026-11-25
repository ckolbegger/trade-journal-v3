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

async function fillCommon(page: Page, strategy: string) {
  await page.getByLabel('Strategy').selectOption(strategy)
  await page.getByLabel('Underlying').fill('AAPL')
  await page.getByLabel('Quantity').fill('2')
  await page.getByLabel('Entry price').fill('3.00')
  await page.getByLabel('Stop price').fill('1.00')
  await page.getByLabel('Target price').fill('7.00')
  await page.getByLabel('Thesis').fill('why now')
  await page.getByLabel('Invalidation').fill('below trend')
}

async function fillContract(page: Page) {
  await page.getByLabel('Option type').selectOption('Call')
  await page.getByLabel('Strike').fill('190')
  await page.getByLabel('Expiration').fill('2026-12-18')
  await page.getByLabel('Multiplier').fill('100')
}

test('should select only three single-leg Strategies with exact contract fields and a live positive Baseline', async ({ page }) => {
  await onboard(page)
  const options = await page.getByLabel('Strategy').locator('option').allTextContents()
  expect(options).toEqual(['Long Stock', 'Long Call', 'Long Put', 'Cash-Secured Put'])
  await fillCommon(page, 'seed-long-call')
  await fillContract(page)
  await expect(page.getByTestId('one-r')).toHaveText('400.00')
  await expect(page.getByTestId('baseline')).toHaveText('2.00')
  const body = await page.locator('body').innerText()
  for (const forbidden of ['Spread', 'Iron Condor', 'Covered Call', 'adherence', 'Provider']) {
    expect(body).not.toContain(forbidden)
  }
})

test('should reject an incomplete contract with visible prose and no write', async ({ page }) => {
  await onboard(page)
  await fillCommon(page, 'seed-long-put')
  await page.getByLabel('Option type').selectOption('Put')
  await page.getByLabel('Strike').fill('')
  await page.getByLabel('Expiration').fill('2026-12-18')
  await page.getByLabel('Multiplier').fill('100')
  await page.getByRole('button', { name: 'Confirm plan' }).click()
  await expect(page.getByRole('alert')).toContainText('Strike')
  const trades = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const r = indexedDB.open('tjv3'); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error)
    })
    return await new Promise<{ id: string }[]>((resolve, reject) => {
      const r = db.transaction('trade').objectStore('trade').getAll()
      r.onsuccess = () => resolve(r.result as { id: string }[])
      r.onerror = () => reject(r.error)
    })
  })
  expect(trades.filter(t => t.id.startsWith('trade-aapl'))).toEqual([])
})

test('should open and close a Long Call with an exact contract, lot matches and a Close Reason', async ({ page }) => {
  await onboard(page)
  await fillCommon(page, 'seed-long-call')
  await fillContract(page)
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
  await expect(page.getByRole('region', { name: 'Open trade detail' })).toBeVisible()
  await expect(page.getByTestId('option-contract')).toHaveText('AAPL 190Call 2026-12-18 x100')

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
  await expect(page.getByTestId('trade-lifecycle')).toHaveText('Closed')
})

test('should show an intrinsic payoff panel without a theoretical price, adherence score or spread control', async ({ page }) => {
  await onboard(page)
  await fillCommon(page, 'seed-long-call')
  await fillContract(page)
  await page.getByRole('button', { name: 'Confirm plan' }).click()
  await page.getByRole('region', { name: 'Planned trades' }).getByText('AAPL').click()
  await expect(page.getByTestId('payoff-panel')).toBeVisible()
  await expect(page.getByTestId('payoff-break-even')).toContainText('193')
  const body = await page.locator('body').innerText()
  for (const forbidden of ['theoretical price', 'adherence', 'Spread', 'Insights', 'Black-Scholes']) {
    expect(body.toLowerCase()).not.toContain(forbidden.toLowerCase())
  }
})
