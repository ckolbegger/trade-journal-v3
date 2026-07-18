import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'

// S6.3 — backup nudge: a fresh profile has never exported, so opening Review
// shows the nudge before the trader even starts a session. Exporting from the
// nudge clears it, and the session was never blocked along the way.

async function onboard(page: Page) {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: /set up your first account/i })).toBeVisible()
  await page.getByLabel(/institution name/i).fill('Schwab')
  await page.getByLabel(/account name/i).fill('Taxable')
  await page.getByRole('button', { name: /get started/i }).click()
  await expect(page.getByRole('heading', { name: 'Trades' })).toBeVisible()
}

test('nudges on a never-exported profile, then clears after exporting', async ({ page }) => {
  await onboard(page)

  await page.getByRole('link', { name: 'Review' }).click()
  const nudge = page.getByLabel('backup nudge')
  await expect(nudge).toBeVisible()

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    nudge.getByRole('button', { name: /export backup/i }).click(),
  ])
  expect(download.suggestedFilename()).toMatch(/^trade-journal-\d{4}-\d{2}-\d{2}\.json$/)

  await expect(nudge).not.toBeVisible()

  // The session was never blocked by the nudge.
  await page.getByRole('button', { name: /start review/i }).click()
  await expect(page.getByText(/all caught up/i)).toBeVisible()
})
