import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'

// S6.2 — restore from backup: populate a Trade and a journal entry, export a
// backup, clear site data (simulating a fresh browser/profile), restore from
// onboarding, and confirm the Trade list and journal match pre-wipe.

async function onboard(page: Page) {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: /set up your first account/i })).toBeVisible()
  await page.getByLabel(/institution name/i).fill('Schwab')
  await page.getByLabel(/account name/i).fill('Taxable')
  await page.getByRole('button', { name: /get started/i }).click()
  await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible()
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

async function writeAReflection(page: Page) {
  await page.getByRole('link', { name: 'Journal' }).click()
  await expect(page.getByRole('heading', { name: 'Journal', exact: true })).toBeVisible()
  await page.getByRole('button', { name: /new entry/i }).click()
  await expect(page.getByRole('heading', { name: 'New entry' })).toBeVisible()
  await page.getByRole('combobox', { name: 'Entry Type' }).selectOption('Trader Reflection')
  await page.getByLabel("What's on your mind?").fill('Market feels frothy today')
  await page.getByRole('radio', { name: 'anxious' }).check()
  await page.getByRole('radio', { name: '3' }).check()
  await page.getByRole('button', { name: /save entry/i }).click()
  await expect(page.getByRole('heading', { name: 'Journal', exact: true })).toBeVisible()
}

test('restores a Trade and journal entry onto a fresh profile from an exported backup', async ({
  page,
}) => {
  await onboard(page)
  await page.getByRole('link', { name: 'Trades' }).click()
  await planAStock(page)
  await writeAReflection(page)

  await page.getByRole('link', { name: 'Home' }).click()
  await page.getByRole('link', { name: 'Settings' }).click()
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: /export backup/i }).click(),
  ])
  const backupPath = await download.path()

  // Clear site data (the DevTools gesture the story names): force-clears
  // storage for the origin via CDP so it applies even with the app's own
  // IndexedDB connection still open — a plain indexedDB.deleteDatabase() from
  // the same page would block on that connection.
  const client = await page.context().newCDPSession(page)
  await client.send('Storage.clearDataForOrigin', {
    origin: 'http://localhost:5173',
    storageTypes: 'all',
  })
  // A fresh profile lands at the site root, not wherever the tab happened to
  // be — page.reload() would instead preserve the /settings pathname.
  await page.goto('/')

  await expect(page.getByRole('heading', { name: /set up your first account/i })).toBeVisible()
  await page.getByRole('button', { name: /restore from backup/i }).click()
  await page.locator('input[type="file"]').setInputFiles(backupPath!)

  await expect(page.getByText(/will replace all current data/i)).toBeVisible()
  await page.getByRole('button', { name: /replace all data/i }).click()

  await page.getByRole('link', { name: 'Trades' }).click()
  await expect(page.getByRole('heading', { name: 'Trades' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'AAPL' })).toBeVisible()

  await page.getByRole('link', { name: 'Journal' }).click()
  await expect(page.getByText('Market feels frothy today')).toBeVisible()
})
