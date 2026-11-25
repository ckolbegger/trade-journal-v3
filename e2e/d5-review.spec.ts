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
  await page.getByRole('button', { name: 'Review', exact: true }).click()
  await expect(page.getByRole('region', { name: 'Daily Review' })).toBeVisible()
}

test('should open a Review with task families in Mark, Debt, settlement and Trade order', async ({ page }) => {
  await setupOpenTrade(page)
  const steps = await page.locator('[data-review-step]').allTextContents()
  expect(steps.map(s => s.trim())).toEqual(['Marks', 'Debt', 'Settlement', 'Trades'])
  await expect(page.getByTestId('review-completion')).toContainText('Incomplete')
  await expect(page.getByTestId('review-date')).toHaveText('2026-11-23')
  await expect(page.getByText('AAPL', { exact: true }).first()).toBeVisible()
})

test('should gate Action Save on an exact Mark and accept an acknowledged unavailable Mark', async ({ page }) => {
  await setupOpenTrade(page)
  const save = page.getByRole('button', { name: 'Save action' })
  await expect(save).toBeDisabled()
  await expect(page.getByTestId('action-gate')).toContainText('MarkMissing')

  await page.getByLabel('Review unavailability reason').fill('no honest close')
  await page.getByRole('button', { name: 'Acknowledge for review' }).click()
  await expect(page.getByTestId('review-mark-status')).toContainText('Acknowledged Unavailable')
  await expect(save).toBeEnabled()
  await save.click()
  await page.getByRole('button', { name: 'Resolve debt' }).click()
  await expect(page.getByTestId('review-completion')).toContainText('Complete with unavailable Marks')
})

test('should atomically save one Action and one Stop episode from a breached Mark', async ({ page }) => {
  await setupOpenTrade(page)
  await page.getByLabel('Review mark price').fill('90')
  await page.getByRole('button', { name: 'Record mark for review' }).click()
  await expect(page.getByTestId('review-mark-status')).toContainText('Available')
  await expect(page.getByTestId('review-episode')).toContainText('2026-11-23')
  await page.getByRole('button', { name: 'Save action' }).click()
  await expect(page.getByTestId('review-episode')).toContainText('reconciled')
  const stored = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const r = indexedDB.open('tjv3'); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error)
    })
    const journal = await new Promise<unknown[]>((resolve, reject) => {
      const r = db.transaction('journal').objectStore('journal').getAll(); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error)
    })
    const trades = await new Promise<{ id: string; deviations?: unknown[] }[]>((resolve, reject) => {
      const r = db.transaction('trade').objectStore('trade').getAll(); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error)
    })
    return {
      actions: journal.filter((row: { obligationKey?: string }) => String(row.obligationKey ?? '').startsWith('DailyReview:')),
      deviations: trades.find(t => t.id.startsWith('trade-aapl'))?.deviations ?? [],
    }
  })
  expect(stored.actions).toHaveLength(1)
  expect(stored.deviations).toHaveLength(1)
})

test('should refresh Trade Detail with a Mark recorded in Review and show it on reopen', async ({ page }) => {
  await setupOpenTrade(page)
  await page.getByLabel('Review mark price').fill('105')
  await page.getByRole('button', { name: 'Record mark for review' }).click()
  await expect(page.getByTestId('review-mark-status')).toContainText('Available')

  await page.getByRole('button', { name: 'Trades' }).click()
  await expect(page.getByTestId('mark-status')).toContainText('Available')
  await expect(page.getByTestId('marked-pnl')).toHaveText('45.00')

  await page.getByRole('button', { name: 'Review', exact: true }).click()
  await expect(page.getByTestId('review-mark-status')).toContainText('Available')
})

test('should preserve unsaved Action state across resize and write nothing on leave', async ({ page }) => {
  await setupOpenTrade(page)
  await page.getByLabel('Review mark price').fill('100')
  await page.getByRole('button', { name: 'Record mark for review' }).click()
  await page.setViewportSize({ width: 1200, height: 900 })
  await page.getByRole('radio', { name: 'Exit action' }).check()
  await page.getByLabel('Review action intent').fill('thesis broke')
  await page.setViewportSize({ width: 480, height: 900 })
  await expect(page.getByLabel('Review action intent')).toHaveValue('thesis broke')
  await expect(page.getByRole('radio', { name: 'Exit action' })).toBeChecked()
  await page.getByRole('button', { name: 'Trades' }).click()
  await page.getByRole('button', { name: 'Review', exact: true }).click()
  const journal = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const r = indexedDB.open('tjv3'); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error)
    })
    return await new Promise<unknown[]>((resolve, reject) => {
      const r = db.transaction('journal').objectStore('journal').getAll(); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error)
    })
  })
  expect(journal.filter((row: { obligationKey?: string }) => String(row.obligationKey ?? '').startsWith('DailyReview:'))).toEqual([])
})
