import { expect, test, type Page } from '@playwright/test'

async function fillLongCall(page: Page) {
  await page.getByRole('button', { name: 'New Plan' }).click()
  await page.getByLabel('Strategy').selectOption('seed-long-call')
  for (const [label, value] of Object.entries({
    Underlying: 'AAPL', Quantity: '2', 'Entry price': '3.00', 'Stop price': '1.00',
    'Target price': '7.00', Strike: '190', Expiration: '2026-12-18', Multiplier: '100',
    Thesis: 'why now', Invalidation: 'below trend',
  })) await page.getByLabel(label).fill(value)
}

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
}

test('should confirm a Long Call even when crypto.randomUUID is unavailable', async ({ page }) => {
  await onboard(page)
  await fillLongCall(page)
  await page.evaluate(() => {
    Object.defineProperty(crypto, 'randomUUID', { value: undefined, configurable: true })
  })
  await page.getByRole('button', { name: 'Confirm plan' }).click()
  await expect(page.getByRole('region', { name: 'Planned trades' }).getByText('AAPL')).toBeVisible()
  await expect(page.getByRole('alert')).toHaveCount(0)
})

test('should surface a visible error when a command throws unexpectedly', async ({ page }) => {
  await onboard(page)
  await fillLongCall(page)
  await page.evaluate(() => {
    const original = IDBFactory.prototype.open
    IDBFactory.prototype.open = function () { throw new Error('storage unavailable') }
    ;(window as unknown as { __restoreIdb: () => void }).__restoreIdb = () => {
      IDBFactory.prototype.open = original
    }
  })
  await page.getByRole('button', { name: 'Confirm plan' }).click()
  await expect(page.getByRole('alert')).toContainText('storage unavailable')
})
