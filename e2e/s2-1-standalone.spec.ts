import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'

async function onboard(page: Page) {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: /set up your first account/i })).toBeVisible()
  await page.getByLabel(/institution name/i).fill('Schwab')
  await page.getByLabel(/account name/i).fill('Taxable')
  await page.getByRole('button', { name: /get started/i }).click()
  await expect(page.getByRole('heading', { name: 'Trades' })).toBeVisible()
}

test('write a standalone Trader Reflection and see it on the Journal page', async ({ page }) => {
  await onboard(page)

  await page.getByRole('link', { name: 'Journal' }).click()
  await expect(page.getByRole('heading', { name: 'Journal', exact: true })).toBeVisible()

  await page.getByRole('button', { name: /new entry/i }).click()
  await expect(page.getByRole('heading', { name: 'New entry' })).toBeVisible()
  await page.getByRole('combobox', { name: 'Entry Type' }).selectOption('Trader Reflection')

  await page.getByLabel("What's on your mind?").fill('Market feels frothy today')
  await page.getByRole('combobox', { name: 'Current emotional state' }).selectOption('anxious')
  await page.getByRole('radio', { name: '3' }).check()
  await page.getByRole('button', { name: /save entry/i }).click()

  // Back on the Journal page, the standalone entry is visible with its answers.
  await expect(page.getByRole('heading', { name: 'Journal', exact: true })).toBeVisible()
  await expect(page.getByText('Market feels frothy today')).toBeVisible()
  await expect(page.getByText('anxious')).toBeVisible()
})
