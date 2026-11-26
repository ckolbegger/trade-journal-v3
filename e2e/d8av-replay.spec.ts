import { expect, test, type Page } from '@playwright/test'

async function setup(page: Page) {
  await page.goto('/')
  await page.getByLabel('Institution name').fill('Schwab')
  await page.getByRole('button', { name: 'Add institution' }).click()
  await page.locator('#acct-inst').selectOption({ label: 'Schwab' })
  await page.getByLabel('Account name').fill('Main')
  await page.getByRole('button', { name: 'Add account' }).click()
  await page.getByRole('button', { name: 'New Plan' }).click()
  await page.getByLabel('Strategy').selectOption('seed-long-call')
  for (const [label, value] of Object.entries({
    Underlying: 'AAPL', Quantity: '2', 'Entry price': '3.00', 'Stop price': '1.00',
    'Target price': '7.00', Strike: '190', Expiration: '2026-12-18', Multiplier: '100',
    Thesis: 'why now', Invalidation: 'below trend',
  })) await page.getByLabel(label).fill(value)
  await page.getByRole('button', { name: 'Confirm plan' }).click()
  await page.getByRole('region', { name: 'Planned trades' }).locator('.trade-row').filter({ hasText: 'AAPL' }).click()
  await page.getByRole('button', { name: 'Add execution' }).click()
  await page.getByLabel('Execution 1 instrument').fill('AAPL 190Call 2026-12-18 x100')
  await page.getByLabel('Execution 1 quantity').fill('2')
  await page.getByLabel('Execution 1 price').fill('3.00')
  await page.getByLabel('Execution 1 fee').fill('1.00')
  await page.getByLabel('Execution 1 economic time').fill('2026-11-23T20:00:00Z')
  await page.getByRole('radio', { name: 'Defer reflection' }).check()
  await page.getByRole('button', { name: 'Record position change' }).click()
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const r = indexedDB.open('tjv3'); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error)
    })
    const option = 'AAPL 190Call 2026-12-18 x100'
    const rows = [
      { id: `${option}:2026-11-20`, instrument: option, date: '2026-11-20', revision: '1', marks: [{ revision: '1', price: '3.20', source: 'Manual', intention: 'RecordManualMark', observedAt: '2026-11-20T20:00:00Z', savedAt: '2026-11-20T20:30:00Z' }], acknowledgments: [] },
      { id: `${option}:2026-11-23`, instrument: option, date: '2026-11-23', revision: '1', marks: [{ revision: '1', price: '3.80', source: 'Manual', intention: 'RecordManualMark', observedAt: '2026-11-23T20:00:00Z', savedAt: '2026-11-23T20:30:00Z' }], acknowledgments: [] },
      { id: 'AAPL:2026-11-20', instrument: 'AAPL', date: '2026-11-20', revision: '1', marks: [{ revision: '1', price: '100.00', source: 'Manual', intention: 'RecordManualMark', observedAt: '2026-11-20T20:00:00Z', savedAt: '2026-11-20T20:30:00Z' }], acknowledgments: [] },
      { id: 'AAPL:2026-11-23', instrument: 'AAPL', date: '2026-11-23', revision: '1', marks: [{ revision: '1', price: '102.00', source: 'Manual', intention: 'RecordManualMark', observedAt: '2026-11-23T20:00:00Z', savedAt: '2026-11-23T20:30:00Z' }], acknowledgments: [] },
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
  await page.getByRole('tab', { name: /Journal/ }).click()
  await page.getByRole('button', { name: 'Open replay' }).click()
  await expect(page.getByTestId('replay-view')).toBeVisible()
}

async function counts(page: Page) {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const r = indexedDB.open('tjv3'); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error)
    })
    const read = (s: string) => new Promise<number>((resolve, reject) => {
      const r = db.transaction(s).objectStore(s).count(); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error)
    })
    return { trade: await read('trade'), journal: await read('journal'), market: await read('market') }
  })
}

test('should render the Corridor control bar, chart, status strip and readout', async ({ page }) => {
  await setup(page)
  await expect(page.getByRole('slider', { name: 'Replay session' })).toBeVisible()
  await expect(page.getByRole('tablist', { name: 'Visualization' }).getByRole('tab')).toHaveCount(6)
  await expect(page.getByRole('tab', { name: 'Corridor' })).toHaveAttribute('aria-selected', 'true')
  await expect(page.locator('svg[data-testid="corridor-chart"]')).toBeVisible()
  await expect(page.locator('svg[data-testid="corridor-chart"] .rail')).toHaveCount(2)
  await expect(page.getByTestId('replay-status')).toContainText('R')
  const readout = page.getByTestId('replay-readout')
  for (const group of ['How it is going', 'At stake from here', 'Marks', 'Position', 'The Plan']) {
    await expect(readout).toContainText(group)
  }
})

test('should render advisory chips with estimates and a named split bar', async ({ page }) => {
  await setup(page)
  const iv = page.getByRole('button', { name: /Implied volatility/ })
  await expect(iv).toBeVisible()
  await iv.click()
  await expect(page.getByRole('heading', { name: /Implied volatility/ })).toBeVisible()
  await expect(page.locator('.pop.open')).toContainText('Estimate')
  await expect(page.getByRole('button', { name: /Share equivalent/ })).toBeVisible()
  await expect(page.getByTestId('split-bar')).toContainText('Underlying')
  await expect(page.getByTestId('split-bar')).toContainText('estimate')
})

test('should label advisory chips and step buttons clearly and disclaim each popover', async ({ page }) => {
  await setup(page)
  const iv = page.getByRole('button', { name: /Implied volatility/ })
  await expect(iv).not.toContainText('[object Object]')
  await expect(iv).toContainText(/Implied volatility \d+\.\d{4}/)
  const shares = page.getByRole('button', { name: /Share equivalent/ })
  await expect(shares).not.toContainText('[object Object]')
  await expect(shares).toContainText(/Share equivalent \d+/)
  await expect(page.getByRole('button', { name: 'Earlier session' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Later session' })).toBeVisible()
  await iv.click()
  await expect(page.locator('.pop.open')).toContainText('Never used for valuation')
  await iv.click()
  await shares.click()
  await expect(page.locator('.pop.open')).toContainText('Never used for valuation')
})

test('should seek by chart click and keep every session table explicit and read-only', async ({ page }) => {
  await setup(page)
  const before = await counts(page)
  const first = await page.getByTestId('replay-session').innerText()
  await page.locator('svg[data-testid="corridor-chart"]').click({ position: { x: 10, y: 40 } })
  const after = await page.getByTestId('replay-session').innerText()
  expect(after).not.toBe(first)
  const table = page.locator('table.session-table')
  await expect(table).toContainText('Plan')
  await expect(table.locator('tbody tr')).toHaveCount(5)
  await expect(table.locator('tbody')).toContainText('—')
  expect(await page.locator('input[type=number]')).toHaveCount(0)
  expect(await counts(page)).toEqual(before)
})

test('should keep the replay layout inside the viewport at narrow width', async ({ page }) => {
  await setup(page)
  await page.setViewportSize({ width: 480, height: 900 })
  const width = await page.evaluate(() => ({ body: document.body.scrollWidth, viewport: window.innerWidth }))
  expect(width.body).toBeLessThanOrEqual(width.viewport)
  await expect(page.getByTestId('replay-readout')).toBeVisible()
})
