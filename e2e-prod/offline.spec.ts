import { expect, test, type Page } from '@playwright/test'

async function seedAndOpen(page: Page) {
  await page.goto('/')
  await expect(page.locator('main')).toHaveAttribute('data-view', /^(empty|ready)$/, { timeout: 15_000 })
  await page.waitForFunction(() => 'serviceWorker' in navigator && !!navigator.serviceWorker.controller)
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
  await page.getByRole('region', { name: 'Planned trades' }).locator('.trade-row').filter({ hasText: 'AAPL' }).click()
  await page.getByRole('button', { name: 'Add execution' }).click()
  await page.getByLabel('Execution 1 instrument').fill('AAPL')
  await page.getByLabel('Execution 1 quantity').fill('10')
  await page.getByLabel('Execution 1 price').fill('100')
  await page.getByLabel('Execution 1 fee').fill('5')
  await page.getByLabel('Execution 1 economic time').fill('2026-11-23T20:00:00Z')
  await page.getByRole('radio', { name: 'Defer reflection' }).check()
  await page.getByRole('button', { name: 'Record position change' }).click()
  await page.getByRole('region', { name: 'Open trades' }).locator('.trade-row').filter({ hasText: 'AAPL' }).click()
  await page.getByLabel('Manual Mark price').fill('105')
  await page.getByRole('button', { name: 'Record mark' }).click()
  await expect(page.getByTestId('mark-status')).toContainText('Available')
}

test('should re-establish Writable and run the installed Manual Mark workflow offline after a full stop', async ({ page }) => {
  await seedAndOpen(page)
  const provenance = await page.evaluate(() => ({
    secure: isSecureContext,
    controller: !!navigator.serviceWorker?.controller,
    ua: navigator.userAgent,
  }))
  expect(provenance.secure).toBe(true)
  expect(provenance.controller).toBe(true)

  await page.context().setOffline(true)
  await page.reload()
  await expect(page.locator('main')).toHaveAttribute('data-view', /^(empty|ready)$/, { timeout: 15_000 })
  await page.getByRole('button', { name: 'Trades' }).click()
  await page.getByRole('region', { name: 'Open trades' }).locator('.trade-row').filter({ hasText: 'AAPL' }).click()
  await expect(page.getByTestId('mark-status')).toContainText('Available')
  await expect(page.getByTestId('marked-pnl')).toHaveText('45.00')

  await page.getByLabel('Manual Mark price').fill('107')
  await page.getByRole('button', { name: 'Record mark' }).click()
  await expect(page.getByTestId('marked-pnl')).toHaveText('65.00')

  await page.context().setOffline(false)
})
