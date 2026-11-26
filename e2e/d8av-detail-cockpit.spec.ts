import { expect, test, type Page } from '@playwright/test'

async function onboardWithCall(page: Page) {
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
  await page.getByLabel('Strategy').selectOption('seed-long-call')
  for (const [label, value] of Object.entries({
    Underlying: 'AAPL', Quantity: '2', 'Entry price': '3.00', 'Stop price': '1.00',
    'Target price': '7.00', Strike: '190', Expiration: '2026-12-18', Multiplier: '100',
    Thesis: 'why now', Invalidation: 'below trend',
  })) await page.getByLabel(label).fill(value)
  await page.getByRole('button', { name: 'Confirm plan' }).click()
  await expect(page.getByRole('region', { name: 'Planned trades' }).locator('.trade-row')).toHaveCount(1)
  await page.getByRole('button', { name: /Complete detail for AAPL/ }).click()
  await expect(page.getByTestId('complete-detail')).toBeVisible()
}

async function seedMarks(page: Page) {
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const r = indexedDB.open('tjv3'); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error)
    })
    const option = 'AAPL 190Call 2026-12-18 x100'
    const rows = [
      { id: `${option}:2026-11-20`, instrument: option, date: '2026-11-20', revision: '1', marks: [{ revision: '1', price: '3.00', source: 'Manual', intention: 'RecordManualMark', observedAt: '2026-11-20T20:00:00Z', savedAt: '2026-11-20T20:30:00Z' }], acknowledgments: [] },
      { id: `${option}:2026-11-23`, instrument: option, date: '2026-11-23', revision: '1', marks: [{ revision: '1', price: '3.80', source: 'Manual', intention: 'RecordManualMark', observedAt: '2026-11-23T20:00:00Z', savedAt: '2026-11-23T20:30:00Z' }], acknowledgments: [] },
    ]
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('market', 'readwrite')
      for (const row of rows) tx.objectStore('market').put(row)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  })
  await page.reload()
  await page.getByRole('button', { name: 'Trades', exact: true }).click()
  await page.getByRole('button', { name: /Complete detail for AAPL/ }).click()
  await expect(page.getByTestId('complete-detail')).toBeVisible()
}

async function storeCounts(page: Page) {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const r = indexedDB.open('tjv3'); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error)
    })
    const read = (store: string) => new Promise<number>((resolve, reject) => {
      const r = db.transaction(store).objectStore(store).count()
      r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error)
    })
    return { trade: await read('trade'), journal: await read('journal'), market: await read('market') }
  })
}

test('should render the Cockpit rail and drawer tabs from the prototype', async ({ page }) => {
  await onboardWithCall(page)
  const rail = page.getByRole('complementary', { name: 'State of play' })
  await expect(rail).toBeVisible()
  await expect(rail.locator('.card')).toHaveCount(4)
  await expect(rail.getByText('Conditions')).toBeVisible()
  await expect(rail.getByText('Needs you')).toBeVisible()

  const tabs = page.getByRole('tablist', { name: 'Detail' })
  await expect(tabs.getByRole('tab')).toHaveCount(6)
  await expect(tabs.getByRole('tab', { name: /Payoff/ })).toBeVisible()
  await expect(page.getByRole('tabpanel')).toBeVisible()
})

test('should render Today tracks, a comparison table and the payoff SVG', async ({ page }) => {
  await onboardWithCall(page)
  await seedMarks(page)
  await page.getByRole('tab', { name: /Today/ }).click()
  await expect(page.locator('table.cmp')).toBeVisible()
  await expect(page.locator('table.cmp thead')).toContainText('Today')
  await expect(page.locator('table.cmp thead')).toContainText('Change')
  await expect(page.getByRole('tabpanel').locator('.track')).toHaveCount(2)

  await page.getByRole('tab', { name: /Payoff/ }).click()
  await expect(page.locator('svg[data-testid="payoff-chart"]')).toBeVisible()
  await expect(page.getByTestId('detail-payoff')).toHaveText('Available')
  await expect(page.getByTestId('detail-payoff-break-even')).toContainText('193')
})

test('should render session rail and read-only integrity banner without writing', async ({ page }) => {
  await onboardWithCall(page)
  const before = await storeCounts(page)
  await page.getByRole('tab', { name: /Journal/ }).click()
  await expect(page.locator('.rail-x')).toBeVisible()
  await expect(page.getByTestId('session-timeline')).toHaveCount(1)
  await expect(page.getByRole('button', { name: 'Earlier sessions' })).toBeVisible()
  await expect(page.getByTestId('detail-integrity')).toHaveText('Agreement')
  expect(await storeCounts(page)).toEqual(before)
})

test('should not present the plan entry as an observed Mark when none is stored', async ({ page }) => {
  await onboardWithCall(page)
  await expect(page.locator('.c-pnl')).not.toContainText('Since last Mark')
  await page.getByRole('tab', { name: /Today/ }).click()
  await expect(page.getByRole('tabpanel')).toContainText('No Marks yet')
  await expect(page.locator('table.cmp')).toHaveCount(0)
  await expect(page.getByTestId('complete-detail')).not.toContainText('Mark 3.00 / 3.00 / 0.00')
})

test('should offer a Review link in Price History and two Plan and Risk groups', async ({ page }) => {
  await onboardWithCall(page)
  await page.getByRole('tab', { name: /Price History/ }).click()
  await expect(page.getByRole('button', { name: 'Enter Marks in the Review' })).toBeVisible()
  await page.getByRole('tab', { name: /Plan and Risk/ }).click()
  await expect(page.getByRole('tabpanel').locator('.kv-group')).toHaveCount(2)
  await expect(page.getByRole('tabpanel')).toContainText('Entry, resolved')
})

test('should suppress derived drawers and figures when facts cannot be replayed', async ({ page }) => {
  await onboardWithCall(page)
  await page.getByRole('button', { name: 'Back to trades' }).click()
  await page.getByRole('region', { name: 'Planned trades' }).locator('.trade-row').filter({ hasText: 'AAPL' }).click()
  await page.getByRole('button', { name: 'Add execution' }).click()
  await page.getByLabel('Execution 1 instrument').fill('AAPL 190Call 2026-12-18 x100')
  await page.getByLabel('Execution 1 quantity').fill('3')
  await page.getByLabel('Execution 1 price').fill('3.00')
  await page.getByLabel('Execution 1 fee').fill('1.00')
  await page.getByLabel('Execution 1 economic time').fill('2026-11-24T20:00:00Z')
  await page.getByRole('radio', { name: 'Defer reflection' }).check()
  await page.getByRole('button', { name: 'Record position change' }).click()
  await page.getByRole('button', { name: 'Close position' }).click()
  const close = page.getByRole('form', { name: 'Close position' })
  await close.getByLabel('Close 1 instrument').fill('AAPL 190Call 2026-12-18 x100')
  await close.getByLabel('Close 1 quantity').fill('4')
  await close.getByLabel('Close 1 price').fill('5.00')
  await close.getByLabel('Close 1 fee').fill('1.00')
  await close.getByLabel('Close 1 economic time').fill('2026-11-25T20:00:00Z')
  await close.getByLabel('Close reason').selectOption('Target Reached')
  await close.getByRole('button', { name: 'Record close' }).click()
  await page.getByRole('button', { name: /Complete detail for AAPL/ }).first().click()
  await expect(page.getByRole('region', { name: "Facts can't be replayed" })).toBeVisible()
  await expect(page.getByRole('tablist', { name: 'Detail' }).getByRole('tab')).toHaveCount(3)
  for (const name of ['Today', 'Price History', 'Payoff']) {
    await expect(page.getByRole('tab', { name: new RegExp(name) })).toHaveCount(0)
  }
  await expect(page.getByTestId('detail-figures')).toHaveCount(0)
  await expect(page.getByTestId('complete-detail')).toContainText('Figures unavailable')
})

test('should keep the Journal tab inside the viewport at narrow width', async ({ page }) => {
  await onboardWithCall(page)
  await page.setViewportSize({ width: 480, height: 900 })
  await page.getByRole('tab', { name: /Journal/ }).click()
  const widths = await page.evaluate(() => ({
    body: document.body.scrollWidth, viewport: window.innerWidth,
  }))
  expect(widths.body).toBeLessThanOrEqual(widths.viewport)
  const railWidth = await page.locator('.rail-x').evaluate(el => el.clientWidth)
  expect(railWidth).toBeLessThanOrEqual(widths.viewport)
})

test('should collapse the cockpit to one column at narrow width', async ({ page }) => {
  await onboardWithCall(page)
  await page.setViewportSize({ width: 480, height: 900 })
  const columns = await page.locator('.cockpit').evaluate(el => getComputedStyle(el).gridTemplateColumns)
  expect(columns.split(' ').length).toBe(1)
})
