import { expect, test, type Page } from '@playwright/test'

async function setupOpenTrade(page: Page) {
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
  await page.getByLabel('Underlying').fill('AAPL')
  await page.getByLabel('Quantity').fill('10')
  await page.getByLabel('Entry price').fill('100')
  await page.getByLabel('Stop price').fill('95')
  await page.getByLabel('Target price').fill('110')
  await page.getByLabel('Thesis').fill('Why now')
  await page.getByLabel('Invalidation').fill('Close below 50d')
  await page.getByRole('button', { name: 'Confirm plan' }).click()
  await page.getByRole('region', { name: 'Planned trades' }).getByText('AAPL').click()
  await page.getByRole('button', { name: 'Add execution' }).click()
  await page.getByLabel('Execution 1 instrument').fill('AAPL')
  await page.getByLabel('Execution 1 quantity').fill('10')
  await page.getByLabel('Execution 1 price').fill('100')
  await page.getByLabel('Execution 1 fee').fill('5')
  await page.getByLabel('Execution 1 economic time').fill('2026-11-23T20:00:00Z')
  await page.getByRole('radio', { name: 'Defer reflection' }).check()
  await page.getByRole('button', { name: 'Record position change' }).click()
  await page.getByRole('region', { name: 'Open trades' }).getByText('AAPL').click()
}

test('should keep realized-to-date visible and mark-dependent figures Unavailable before a Mark', async ({ page }) => {
  await setupOpenTrade(page)
  await expect(page.getByTestId('expected-mark-date')).toHaveText('2026-11-23')
  await expect(page.getByTestId('mark-status')).toContainText('Missing')
  await expect(page.getByTestId('realized-to-date')).toHaveText('0.00')
  await expect(page.getByTestId('marked-pnl')).toContainText('Unavailable')
  await expect(page.getByTestId('marked-pnl')).toContainText('AAPL')
  await expect(page.getByTestId('marked-pnl')).toContainText('2026-11-23')
  await expect(page.getByTestId('eval-one-r')).toHaveText('50.00')
})

test('should record a Manual Mark and show Values with an unchanged 1R', async ({ page }) => {
  await setupOpenTrade(page)
  await page.getByLabel('Manual Mark price').fill('105')
  await page.getByRole('button', { name: 'Record mark' }).click()
  await expect(page.getByTestId('mark-status')).toContainText('Available')
  await expect(page.getByTestId('marked-pnl')).toHaveText('45.00')
  await expect(page.getByTestId('ongoing-risk')).toHaveText('100.00')
  await expect(page.getByTestId('incremental-reward')).toHaveText('50.00')
  await expect(page.getByTestId('eval-one-r')).toHaveText('50.00')
  await expect(page.getByTestId('condition-stop')).toContainText('Unbreached')
  await expect(page.getByTestId('condition-target')).toContainText('Unreached')
  const body = await page.locator('main').innerText()
  expect(body).not.toContain('Close position')
})

test('should acknowledge unavailability without a price and keep the calculation Unavailable', async ({ page }) => {
  await setupOpenTrade(page)
  await page.getByLabel('Unavailability reason').fill('no close published')
  await page.getByRole('button', { name: 'Acknowledge unavailable' }).click()
  await expect(page.getByTestId('mark-status')).toContainText('Acknowledged Unavailable')
  await expect(page.getByTestId('marked-pnl')).toContainText('ExpectedMarkAcknowledgedUnavailable')
  const journal = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('tjv3')
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    return await new Promise<{ marks: unknown[] }[]>((resolve, reject) => {
      const request = db.transaction('market').objectStore('market').getAll()
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  })
  expect(journal[0].marks).toEqual([])
})

test('should disclose a Stop Overrun from a lower Mark without a close control', async ({ page }) => {
  await setupOpenTrade(page)
  await page.getByLabel('Manual Mark price').fill('90')
  await page.getByRole('button', { name: 'Record mark' }).click()
  await expect(page.getByTestId('overrun')).toHaveText('50.00')
  await expect(page.getByTestId('condition-stop')).toContainText('Crossed')
  await expect(page.getByTestId('ongoing-risk')).toHaveText('0.00')
})
