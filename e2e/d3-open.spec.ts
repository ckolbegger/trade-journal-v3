import { expect, test, type Page } from '@playwright/test'

async function seedAndConfirm(page: Page) {
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
  await expect(page.getByRole('region', { name: 'Planned trades' }).getByText('AAPL')).toBeVisible()
  await page.getByRole('region', { name: 'Planned trades' }).getByText('AAPL').click()
}

async function fillExecution(page: Page, row: number, quantity: string, price: string, fee: string) {
  await page.getByLabel(`Execution ${row} instrument`).fill('AAPL')
  await page.getByLabel(`Execution ${row} quantity`).fill(quantity)
  await page.getByLabel(`Execution ${row} price`).fill(price)
  await page.getByLabel(`Execution ${row} fee`).fill(fee)
  await page.getByLabel(`Execution ${row} economic time`).fill('2026-11-24T20:00:00Z')
}

test('should record several executions as one decision and show Open position, lots and fees', async ({ page }) => {
  await seedAndConfirm(page)
  await page.getByRole('button', { name: 'Add execution' }).click()
  await fillExecution(page, 1, '6', '100', '3')
  await page.getByRole('button', { name: 'Add another execution' }).click()
  await fillExecution(page, 2, '4', '102.5', '2')
  await page.getByRole('radio', { name: 'Defer reflection' }).check()
  await page.getByRole('button', { name: 'Record position change' }).click()
  const open = page.getByRole('region', { name: 'Open trades' })
  await expect(open.getByText('AAPL')).toBeVisible()
  await open.getByText('AAPL').click()
  await expect(page.getByTestId('trade-lifecycle')).toHaveText('Open')
  await expect(page.getByTestId('open-position')).toHaveText('10')
  await expect(page.getByTestId('open-fees')).toHaveText('5.00')
  await expect(page.getByTestId('realized-to-date')).toHaveText('0.00')
  await expect(page.getByTestId('open-lots')).toContainText('2 open lots')
  const body = await page.locator('main').innerText()
  // D4 installs Marks on Open detail; only later capabilities stay forbidden.
  for (const forbidden of ['Close position', 'Valuation', 'Review', 'Restore']) expect(body).not.toContain(forbidden)
})

test('should defer reflection without a blank Entry and keep the recorded fact', async ({ page }) => {
  await seedAndConfirm(page)
  await page.getByRole('button', { name: 'Add execution' }).click()
  await fillExecution(page, 1, '10', '100', '5')
  await page.getByRole('radio', { name: 'Defer reflection' }).check()
  await page.getByRole('button', { name: 'Record position change' }).click()
  await expect(page.getByRole('region', { name: 'Open trades' }).getByText('AAPL')).toBeVisible()

  const journal = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('tjv3')
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    return await new Promise<unknown[]>((resolve, reject) => {
      const request = db.transaction('journal').objectStore('journal').getAll()
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  })
  const debt = journal.find((row: { kind?: string }) => row.kind === 'Debt')
  expect(debt).toBeDefined()
  expect((debt as { obligationKey: string }).obligationKey).toContain('PositionChange:')
  expect(journal.filter((row: { kind?: string }) => row.kind === 'Entry')).toEqual([])
})

test('should validate a completed reflection and accept an explicit decline', async ({ page }) => {
  await seedAndConfirm(page)
  await page.getByRole('button', { name: 'Add execution' }).click()
  await fillExecution(page, 1, '10', '100', '5')
  await page.getByRole('radio', { name: 'Complete reflection' }).check()
  await page.getByRole('button', { name: 'Record position change' }).click()
  await expect(page.getByRole('alert')).toContainText('Decision mode is required.')

  await page.getByRole('radio', { name: 'Decline reflection' }).check()
  await page.getByLabel('Decline reason').fill('No time')
  await page.getByRole('button', { name: 'Record position change' }).click()
  await expect(page.getByRole('region', { name: 'Open trades' }).getByText('AAPL')).toBeVisible()
})

test('should keep the Add execution action clear of bottom navigation at narrow width', async ({ page }) => {
  await seedAndConfirm(page)
  await page.setViewportSize({ width: 480, height: 800 })
  const button = page.getByRole('button', { name: 'Add execution' })
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
  const action = await button.boundingBox()
  const nav = await page.getByRole('navigation', { name: 'Primary' }).boundingBox()
  expect(action).not.toBeNull()
  expect(nav).not.toBeNull()
  expect(action!.y + action!.height).toBeLessThanOrEqual(nav!.y + 1)
  await button.click({ timeout: 5000 })
  await expect(page.getByRole('form', { name: 'Add execution' })).toBeVisible()
})

test('should preserve unsaved execution values across a live resize', async ({ page }) => {
  await seedAndConfirm(page)
  await page.setViewportSize({ width: 1200, height: 900 })
  await page.getByRole('button', { name: 'Add execution' }).click()
  await fillExecution(page, 1, '7', '101', '2')
  await page.setViewportSize({ width: 480, height: 900 })
  await expect(page.getByLabel('Execution 1 quantity')).toHaveValue('7')
  await expect(page.getByLabel('Execution 1 price')).toHaveValue('101')
})
