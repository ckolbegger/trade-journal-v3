import { expect, test } from '@playwright/test'

test('should surface a global banner for an unguarded async command failure', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('main')).toHaveAttribute('data-view', /^(empty|ready)$/)
  await page.evaluate(() => {
    IDBFactory.prototype.open = function () { throw new Error('storage blocked') }
  })
  await page.getByLabel('Institution name').fill('Schwab')
  await page.getByRole('button', { name: 'Add institution' }).click()
  await expect(page.getByTestId('global-error')).toContainText('storage blocked')
})

test('should surface a global banner for an unhandled promise rejection', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('global-error')).toHaveCount(0)
  await page.evaluate(() => {
    window.dispatchEvent(new PromiseRejectionEvent('unhandledrejection', {
      promise: Promise.resolve(), reason: new Error('synthetic failure'),
    }))
  })
  await expect(page.getByTestId('global-error')).toContainText('synthetic failure')
  await page.getByRole('button', { name: 'Dismiss error' }).click()
  await expect(page.getByTestId('global-error')).toHaveCount(0)
})

test('should ignore resource-load errors such as the favicon 404', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('main')).toHaveAttribute('data-view', /^(empty|ready)$/)
  await expect(page.getByTestId('global-error')).toHaveCount(0)
})
