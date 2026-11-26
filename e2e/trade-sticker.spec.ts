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

async function stickerTexts(page: Page, region: string, expectedCount: number): Promise<string[]> {
  const stickers = page.getByRole('region', { name: region }).locator('.monogram')
  await expect(stickers).toHaveCount(expectedCount)
  return stickers.allTextContents()
}

async function gotoTrades(page: Page) {
  await page.getByRole('button', { name: 'Trades' }).click()
  await expect(page.locator('[data-screen="open"]')).toBeVisible()
}

test('should show the full underlying in Planned, Open and Closed trade stickers', async ({ page }) => {
  await onboard(page)

  await page.getByRole('button', { name: 'New Plan' }).click()
  await page.getByLabel('Underlying').fill('AAPL')
  await page.getByLabel('Quantity').fill('10')
  await page.getByLabel('Entry price').fill('100')
  await page.getByLabel('Stop price').fill('95')
  await page.getByLabel('Target price').fill('110')
  await page.getByLabel('Thesis').fill('why now')
  await page.getByLabel('Invalidation').fill('below trend')
  await page.getByRole('button', { name: 'Confirm plan' }).click()
  expect(await stickerTexts(page, 'Planned trades', 1)).toEqual(['AAPL'])

  await page.getByRole('region', { name: 'Planned trades' }).locator('.trade-row').filter({ hasText: 'AAPL' }).click()
  await page.getByRole('button', { name: 'Add execution' }).click()
  await page.getByLabel('Execution 1 instrument').fill('AAPL')
  await page.getByLabel('Execution 1 quantity').fill('10')
  await page.getByLabel('Execution 1 price').fill('100')
  await page.getByLabel('Execution 1 fee').fill('5')
  await page.getByLabel('Execution 1 economic time').fill('2026-11-24T20:00:00Z')
  await page.getByRole('radio', { name: 'Defer reflection' }).check()
  await page.getByRole('button', { name: 'Record position change' }).click()
  await gotoTrades(page)
  expect(await stickerTexts(page, 'Open trades', 1)).toEqual(['AAPL'])

  await page.getByRole('region', { name: 'Open trades' }).locator('.trade-row').filter({ hasText: 'AAPL' }).click()
  await page.getByRole('button', { name: 'Close position' }).click()
  const close = page.getByRole('form', { name: 'Close position' })
  await close.getByLabel('Close 1 instrument').fill('AAPL')
  await close.getByLabel('Close 1 quantity').fill('10')
  await close.getByLabel('Close 1 price').fill('110')
  await close.getByLabel('Close 1 fee').fill('4')
  await close.getByLabel('Close 1 economic time').fill('2026-11-25T20:00:00Z')
  await close.getByLabel('Close reason').selectOption('Target Reached')
  await close.getByRole('button', { name: 'Record close' }).click()
  await gotoTrades(page)
  expect(await stickerTexts(page, 'Closed trades', 1)).toEqual(['AAPL'])

  await page.getByRole('button', { name: 'New Plan' }).click()
  await page.getByLabel('Strategy').selectOption('seed-long-call')
  await page.getByLabel('Underlying').fill('MSFT')
  await page.getByLabel('Quantity').fill('2')
  await page.getByLabel('Entry price').fill('3.00')
  await page.getByLabel('Stop price').fill('1.00')
  await page.getByLabel('Target price').fill('7.00')
  await page.getByLabel('Strike').fill('200')
  await page.getByLabel('Expiration').fill('2026-12-18')
  await page.getByLabel('Multiplier').fill('100')
  await page.getByLabel('Thesis').fill('why now')
  await page.getByLabel('Invalidation').fill('below trend')
  await page.getByRole('button', { name: 'Confirm plan' }).click()
  expect(await stickerTexts(page, 'Planned trades', 1)).toEqual(['MSFT'])

  await page.getByRole('region', { name: 'Planned trades' }).locator('.trade-row').filter({ hasText: 'MSFT' }).click()
  await page.getByRole('button', { name: 'Add execution' }).click()
  await page.getByLabel('Execution 1 instrument').fill('MSFT 200Call 2026-12-18 x100')
  await page.getByLabel('Execution 1 quantity').fill('2')
  await page.getByLabel('Execution 1 price').fill('3.00')
  await page.getByLabel('Execution 1 fee').fill('1.00')
  await page.getByLabel('Execution 1 economic time').fill('2026-11-24T20:00:00Z')
  await page.getByRole('radio', { name: 'Defer reflection' }).check()
  await page.getByRole('button', { name: 'Record position change' }).click()
  await gotoTrades(page)
  expect(await stickerTexts(page, 'Open trades', 1)).toEqual(['MSFT'])
  expect(await stickerTexts(page, 'Closed trades', 1)).toEqual(['AAPL'])
})

test('should keep the full sticker legible at a narrow viewport', async ({ page }) => {
  await page.setViewportSize({ width: 480, height: 900 })
  await onboard(page)
  await page.getByRole('button', { name: 'New Plan' }).click()
  await page.getByLabel('Underlying').fill('AAPL')
  await page.getByLabel('Quantity').fill('1')
  await page.getByLabel('Entry price').fill('100')
  await page.getByLabel('Stop price').fill('95')
  await page.getByLabel('Target price').fill('110')
  await page.getByLabel('Thesis').fill('why now')
  await page.getByLabel('Invalidation').fill('below trend')
  await page.getByRole('button', { name: 'Confirm plan' }).click()

  const sticker = page.getByRole('region', { name: 'Planned trades' }).locator('.monogram')
  await expect(sticker).toHaveText('AAPL')
  const fits = await sticker.evaluate(el => el.scrollWidth <= el.clientWidth + 1)
  expect(fits).toBe(true)
})
