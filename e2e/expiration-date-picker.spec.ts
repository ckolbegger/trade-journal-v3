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
}

test('should offer a date picker for Expiration and save a Long Call with the chosen date', async ({ page }) => {
  await onboard(page)
  await page.getByRole('button', { name: 'New Plan' }).click()
  await page.getByLabel('Strategy').selectOption('seed-long-call')
  const expiration = page.getByLabel('Expiration')
  await expect(expiration).toHaveAttribute('type', 'date')
  await expiration.fill('2026-12-16')
  await expect(expiration).toHaveValue('2026-12-16')

  for (const [label, value] of Object.entries({
    Underlying: 'AAPL', Quantity: '2', 'Entry price': '3.00', 'Stop price': '1.00',
    'Target price': '7.00', Strike: '190', Multiplier: '100',
    Thesis: 'why now', Invalidation: 'below trend',
  })) await page.getByLabel(label).fill(value)

  await expect(page.getByRole('alert')).toHaveCount(0)
  await page.getByRole('button', { name: 'Confirm plan' }).click()
  await expect(page.getByRole('region', { name: 'Planned trades' }).getByText('AAPL')).toBeVisible()
  await expect(page.getByTestId('global-error')).toHaveCount(0)

  await page.getByRole('region', { name: 'Planned trades' }).getByText('AAPL').click()
  await expect(page.getByText('AAPL 190Call 2026-12-16 x100')).toBeVisible()
})

test('should still show a helpful Expiration error if the stored draft has an invalid format', async ({ page }) => {
  await onboard(page)
  await page.getByRole('button', { name: 'New Plan' }).click()
  await page.getByLabel('Strategy').selectOption('seed-long-call')
  // A corrupted/restored draft can bypass the picker; validation must explain itself.
  await page.getByLabel('Expiration').evaluate((el: HTMLInputElement) => {
    el.type = 'text'
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
    setValue.call(el, '12/16/2026')
    el.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await page.getByLabel('Underlying').fill('AAPL')
  await page.getByLabel('Quantity').fill('2')
  await page.getByLabel('Entry price').fill('3.00')
  await page.getByLabel('Stop price').fill('1.00')
  await page.getByLabel('Target price').fill('7.00')
  await page.getByLabel('Strike').fill('190')
  await page.getByLabel('Multiplier').fill('100')
  await page.getByLabel('Thesis').fill('why now')
  await page.getByLabel('Invalidation').fill('below trend')
  await page.getByRole('button', { name: 'Confirm plan' }).click()
  await expect(page.getByRole('alert')).toContainText('Enter the expiration as YYYY-MM-DD.')
  await expect(page.getByTestId('global-error')).toHaveCount(0)
})
