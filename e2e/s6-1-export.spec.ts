import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import { readFileSync } from 'node:fs'

// S6.1 — export & storage health: populate a Trade, then Export backup on the
// Settings page downloads one JSON file whose parsed counts match what was
// populated, stamped with the current schema version.

async function onboard(page: Page) {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: /set up your first account/i })).toBeVisible()
  await page.getByLabel(/institution name/i).fill('Schwab')
  await page.getByLabel(/account name/i).fill('Taxable')
  await page.getByRole('button', { name: /get started/i }).click()
  await expect(page.getByRole('heading', { name: 'Trades' })).toBeVisible()
}

async function planAStock(page: Page) {
  await page.getByRole('link', { name: 'New Trade' }).click()
  await expect(page.getByRole('heading', { name: 'New Trade' })).toBeVisible()
  await page.getByLabel(/thesis/i).fill('AAPL breaks out')
  await page.getByLabel(/ticker/i).fill('AAPL')
  await page.getByLabel(/quantity/i).fill('100')
  await page.getByLabel(/stop/i).fill('140')
  await page.getByLabel(/target/i).fill('170')
  await page.getByRole('button', { name: /confirm plan/i }).click()
  await expect(page.getByRole('heading', { name: 'Plan journal' })).toBeVisible()
  await page.getByRole('button', { name: /skip/i }).click()
}

test('exports a backup file whose counts and schema version match the populated journal', async ({
  page,
}) => {
  await onboard(page)
  await planAStock(page)

  await page.getByRole('link', { name: 'Settings' }).click()
  await expect(page.getByText(/never exported/i)).toBeVisible()

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: /export backup/i }).click(),
  ])

  expect(download.suggestedFilename()).toMatch(/^trade-journal-\d{4}-\d{2}-\d{2}\.json$/)

  const path = await download.path()
  const file = JSON.parse(readFileSync(path!, 'utf-8'))

  expect(file.schemaVersion).toBe(6)
  expect(file.stores.institutions).toHaveLength(1)
  expect(file.stores.accounts).toHaveLength(1)
  expect(file.stores.trades).toHaveLength(1)

  await expect(page.getByText(/never exported/i)).not.toBeVisible()
  await expect(page.getByText(/last export:/i)).toBeVisible()
})
