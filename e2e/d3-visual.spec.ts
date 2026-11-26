import { expect, test, type Page } from '@playwright/test'

async function seedConfirmAndRecord(page: Page) {
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
  await page.getByRole('region', { name: 'Planned trades' }).locator('.trade-row').filter({ hasText: 'AAPL' }).click()
  await page.getByRole('button', { name: 'Add execution' }).click()
  await page.getByLabel('Execution 1 instrument').fill('AAPL')
  await page.getByLabel('Execution 1 quantity').fill('10')
  await page.getByLabel('Execution 1 price').fill('100')
  await page.getByLabel('Execution 1 fee').fill('5')
  await page.getByLabel('Execution 1 economic time').fill('2026-11-24T20:00:00Z')
  await page.getByRole('radio', { name: 'Defer reflection' }).check()
  await page.getByRole('button', { name: 'Record position change' }).click()
}

test('should present Open Trades and detail with prototype cards, small-caps labels and tabular figures', async ({ page }) => {
  await seedConfirmAndRecord(page)
  const background = await page.locator('body').evaluate(el => getComputedStyle(el).backgroundColor)
  expect(background).toBe('rgb(245, 242, 234)')

  const rowCard = page.getByRole('region', { name: 'Open trades' }).locator('.trade-row').first()
  await expect(rowCard).toBeVisible()
  const cardStyle = await rowCard.evaluate(el => {
    const s = getComputedStyle(el)
    return { background: s.backgroundColor, radius: parseFloat(s.borderRadius) }
  })
  expect(cardStyle.background).toBe('rgb(255, 255, 255)')
  expect(cardStyle.radius).toBeGreaterThanOrEqual(8)

  const title = await rowCard.locator('.row-title').boundingBox()
  const subtitle = await rowCard.locator('.row-sub').boundingBox()
  expect(title).not.toBeNull()
  expect(subtitle).not.toBeNull()
  expect(subtitle!.y).toBeGreaterThanOrEqual(title!.y + title!.height - 1)

  const sectionLabel = page.locator('.section-label').first()
  expect(await sectionLabel.evaluate(el => getComputedStyle(el).textTransform)).toBe('uppercase')

  await page.getByRole('region', { name: 'Open trades' }).locator('.trade-row').filter({ hasText: 'AAPL' }).click()
  const figure = page.getByTestId('open-position')
  expect(await figure.evaluate(el => getComputedStyle(el).textAlign)).toBe('right')
  expect(await figure.evaluate(el => getComputedStyle(el).fontVariantNumeric)).toContain('tabular-nums')
})

test('should present Add Execution as a sheet with pill action chips', async ({ page }) => {
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
  await page.getByRole('region', { name: 'Planned trades' }).locator('.trade-row').filter({ hasText: 'AAPL' }).click()
  await page.getByRole('button', { name: 'Add execution' }).click()

  const sheet = page.getByRole('form', { name: 'Add execution' })
  expect(await sheet.evaluate(el => getComputedStyle(el).position)).toBe('fixed')
  const actionPill = page.locator('.action-pill')
  await expect(actionPill).toHaveText('Buy')
  expect(await actionPill.evaluate(el => parseFloat(getComputedStyle(el).borderRadius))).toBeGreaterThanOrEqual(999)
})
