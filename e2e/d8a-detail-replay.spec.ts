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
  await page.getByRole('button', { name: 'New Plan' }).click()
}

async function confirmLongCall(page: Page) {
  await page.getByLabel('Strategy').selectOption('seed-long-call')
  await page.getByLabel('Underlying').fill('AAPL')
  await page.getByLabel('Quantity').fill('2')
  await page.getByLabel('Entry price').fill('3.00')
  await page.getByLabel('Stop price').fill('1.00')
  await page.getByLabel('Target price').fill('7.00')
  await page.getByLabel('Option type').selectOption('Call')
  await page.getByLabel('Strike').fill('190')
  await page.getByLabel('Expiration').fill('2026-12-18')
  await page.getByLabel('Multiplier').fill('100')
  await page.getByLabel('Thesis').fill('why now')
  await page.getByLabel('Invalidation').fill('below trend')
  await page.getByRole('button', { name: 'Confirm plan' }).click()
}

async function seedMarks(page: Page) {
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const r = indexedDB.open('tjv3')
      r.onsuccess = () => resolve(r.result)
      r.onerror = () => reject(r.error)
    })
    const option = 'AAPL 190Call 2026-12-18 x100'
    const rows = [
      { id: `${option}:2026-11-20`, instrument: option, date: '2026-11-20', revision: '1', marks: [{ revision: '1', price: '3.00', source: 'Manual', intention: 'RecordManualMark', observedAt: '2026-11-20T20:00:00Z', savedAt: '2026-11-20T20:30:00Z' }], acknowledgments: [] },
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
}

async function openDetail(page: Page) {
  await page.reload()
  await page.getByRole('button', { name: 'Trades', exact: true }).click()
  await page.getByRole('button', { name: 'Complete detail for AAPL' }).first().click()
  await expect(page.getByTestId('complete-detail')).toBeVisible()
}

test('should present one complete Trade Detail with all required sections and descriptive figure slots', async ({ page }) => {
  await onboard(page)
  await confirmLongCall(page)
  await seedMarks(page)
  await openDetail(page)
  const detail = page.getByTestId('complete-detail')
  const sections: { name: string; drawer?: string }[] = [
    { name: 'Identity' },
    { name: 'Today against yesterday/entry', drawer: 'Today' },
    { name: 'Stops and Targets' },
    { name: 'Position and Plan/entry', drawer: 'Position' },
    { name: 'Payoff at expiration', drawer: 'Payoff' },
    { name: 'Earlier Marks', drawer: 'Price History' },
    { name: 'Journal narrative', drawer: 'Journal' },
    { name: 'Needs you' },
    { name: 'Session timeline', drawer: 'Journal' },
    { name: 'Integrity' },
  ]
  for (const section of sections) {
    if (section.drawer) await page.getByRole('tab', { name: new RegExp(section.drawer) }).click()
    await expect(detail.getByRole('heading', { name: section.name })).toBeVisible()
  }
  const figures = page.getByTestId('detail-figures')
  await expect(figures).toContainText('Planned Leg Fulfillment')
  await expect(figures).toContainText('Entry Quality')
  await expect(figures).toContainText('Realized R')
  await expect(figures).toContainText('Plan conformance')
  await expect(figures).toContainText('Coverage')
  await expect(figures).toContainText('PlannedLegTerms')
  await expect(figures).toContainText('EntrySize')
  await expect(figures).toContainText('UnplannedExposure')
  await expect(figures).toContainText('StopDiscipline')
  const body = (await detail.innerText()).toLowerCase()
  for (const forbidden of ['adherence', 'composite', 'grade', 'ohlc']) {
    expect(body).not.toContain(forbidden)
  }
})

test('should replay session by session with a slider, explicit gaps and no interpolation or OHLC entry', async ({ page }) => {
  await onboard(page)
  await confirmLongCall(page)
  await seedMarks(page)
  await openDetail(page)
  await page.getByRole('tab', { name: /Journal/ }).click()
  const slider = page.getByTestId('replay-slider')
  await expect(slider).toBeVisible()
  const timeline = page.getByTestId('session-timeline')
  await expect(timeline).toContainText('2026-11-20')
  await expect(timeline).toContainText('2026-11-23')
  await expect(timeline).toContainText('gap')
  await expect(timeline).toContainText('3.00')
  await expect(timeline).toContainText('3.80')
  const gapRow = timeline.locator('[data-gap="true"]').first()
  await expect(gapRow).toBeVisible()
  await expect(gapRow).not.toContainText('3.00')
  expect(await page.locator('input[type="number"]').count()).toBe(0)
  const dates = await timeline.locator('li').evaluateAll(
    els => els.map(el => el.firstElementChild?.textContent?.trim() ?? ''),
  )
  await slider.fill('0')
  await expect(page.getByTestId('replay-session')).toContainText(dates[0])
  await slider.fill('2')
  await expect(page.getByTestId('replay-session')).toContainText('3.00')
  await slider.fill(String(dates.length - 1))
  await expect(page.getByTestId('replay-session')).toContainText('3.80')
})

test('should show advisory IV, share-equivalent chips and an estimate-labelled decomposition', async ({ page }) => {
  await onboard(page)
  await confirmLongCall(page)
  await seedMarks(page)
  await openDetail(page)
  const advisory = page.getByTestId('advisory-explanation')
  await expect(advisory).toBeVisible()
  await expect(advisory).toContainText('Advisory implied volatility')
  await expect(advisory).not.toContainText('on the expiration session the price no longer depends on volatility')
  await expect(advisory).toContainText(/Advisory implied volatility: \d+\.\d{4}/)
  await expect(advisory).toContainText('Share equivalent')
  await expect(advisory).toContainText('Estimate')
  await expect(advisory).toContainText('Underlying')
  await expect(advisory).toContainText('Time')
  await expect(advisory).toContainText('Volatility')
  const body = await advisory.innerText()
  expect(body).not.toMatch(/theoretical price/i)
  expect(body).not.toMatch(/prediction|coach/i)
})

test('should keep navigation read-only and write no Trade or Journal fact from detail or replay', async ({ page }) => {
  await onboard(page)
  await confirmLongCall(page)
  await seedMarks(page)
  const before = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const r = indexedDB.open('tjv3'); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error)
    })
    return await new Promise<Record<string, number>>((resolve, reject) => {
      const tx = db.transaction(['trade', 'journal', 'market'])
      const out: Record<string, number> = {}
      for (const name of ['trade', 'journal', 'market']) {
        const r = tx.objectStore(name).count()
        r.onsuccess = () => { out[name] = r.result }
      }
      tx.oncomplete = () => resolve(out)
      tx.onerror = () => reject(tx.error)
    })
  })
  await openDetail(page)
  await page.getByRole('tab', { name: /Journal/ }).click()
  await page.getByTestId('replay-slider').fill('2')
  const nav = await page.getByRole('navigation', { name: 'Primary' }).innerText()
  expect(nav).toBe('Accounts\nStatus\nNew Plan\nTrades\nReview')
  const after = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const r = indexedDB.open('tjv3'); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error)
    })
    return await new Promise<Record<string, number>>((resolve, reject) => {
      const tx = db.transaction(['trade', 'journal', 'market'])
      const out: Record<string, number> = {}
      for (const name of ['trade', 'journal', 'market']) {
        const r = tx.objectStore(name).count()
        r.onsuccess = () => { out[name] = r.result }
      }
      tx.oncomplete = () => resolve(out)
      tx.onerror = () => reject(tx.error)
    })
  })
  expect(after).toEqual(before)
})
