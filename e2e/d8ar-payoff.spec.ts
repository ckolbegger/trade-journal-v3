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

async function confirmLongCall(page: Page) {
  await page.getByRole('button', { name: 'New Plan' }).click()
  await page.getByLabel('Strategy').selectOption('seed-long-call')
  for (const [label, value] of Object.entries({
    Underlying: 'AAPL', Quantity: '2', 'Entry price': '3.00', 'Stop price': '1.00',
    'Target price': '7.00', Strike: '190', Expiration: '2026-12-18', Multiplier: '100',
    Thesis: 'why now', Invalidation: 'below trend',
  })) await page.getByLabel(label).fill(value)
  await page.getByRole('button', { name: 'Confirm plan' }).click()
  await expect(page.getByRole('region', { name: 'Planned trades' }).locator('.trade-row').filter({ hasText: 'AAPL' })).toBeVisible()
}

test('should render the option payoff in Complete detail and the standalone panel from one domain result', async ({ page }) => {
  await onboard(page)
  await confirmLongCall(page)
  await page.getByRole('region', { name: 'Planned trades' }).locator('.trade-row').filter({ hasText: 'AAPL' }).click()
  await expect(page.getByTestId('payoff-panel')).toBeVisible()
  const panelBreakEven = (await page.getByTestId('payoff-break-even').textContent()) ?? ''

  await page.getByRole('button', { name: /Complete detail|Detail/ }).first().click()
  await expect(page.getByTestId('detail-payoff')).toHaveText('Available')
  const detailBreakEven = (await page.getByTestId('detail-payoff-break-even').textContent()) ?? ''
  expect(panelBreakEven).toContain(detailBreakEven.replace('Break-even: ', '').trim())
  await expect(page.getByRole('alert')).toHaveCount(0)
})

test('should keep the stock-only payoff NotApplicable in Complete detail', async ({ page }) => {
  await onboard(page)
  await page.getByRole('button', { name: 'New Plan' }).click()
  await page.getByLabel('Strategy').selectOption('seed-long-stock')
  for (const [label, value] of Object.entries({
    Underlying: 'MSFT', Quantity: '1', 'Entry price': '100', 'Stop price': '95',
    'Target price': '110', Thesis: 'thesis', Invalidation: 'invalidation',
  })) await page.getByLabel(label).fill(value)
  await page.getByRole('button', { name: 'Confirm plan' }).click()
  await expect(page.getByRole('region', { name: 'Planned trades' }).locator('.trade-row').filter({ hasText: 'MSFT' })).toBeVisible()
  await page.getByRole('region', { name: 'Planned trades' }).locator('.trade-row').filter({ hasText: 'MSFT' }).click()
  await page.getByRole('button', { name: /Complete detail|Detail/ }).first().click()
  await expect(page.getByTestId('detail-payoff')).toHaveText('NotApplicable: StockOnly')
})
