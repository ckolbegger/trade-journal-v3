import { expect, test } from '@playwright/test'

// Automated browser tests reproducing the D1 critic findings. These must FAIL
// on the static scaffold and pass only after the UI is wired to the domain.
test('readiness resolves and the shell reaches a real view', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('main')).toHaveAttribute('data-view', /^(empty|ready|error)$/, {
    timeout: 10_000,
  })
})

test('navigation declares only installed capabilities', async ({ page }) => {
  await page.goto('/')
  const nav = await page.locator('nav[aria-label="Primary"]').innerText()
  // D1 capabilities remain installed; D2 adds New Plan and Trades. Assert the
  // exact installed set and that no later capability appears.
  for (const entry of ['Institutions & Accounts', 'Workspace', 'New Plan', 'Trades']) {
    expect(nav).toContain(entry)
  }
  for (const forbidden of ['Execution', 'Mark', 'Review', 'Report', 'Backup', 'Restore']) {
    expect(nav).not.toContain(forbidden)
  }
})

test('a trader can create an institution and account through the UI', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('main')).toHaveAttribute('data-view', /^(empty|ready)$/)
  await page.getByLabel('Institution name').fill('Charles Schwab')
  await page.getByRole('button', { name: 'Add institution' }).click()
  await expect(page.getByRole('region', { name: 'Institutions' }).getByText('Charles Schwab')).toBeVisible()
  await page.getByLabel('Account name').fill('Main')
  await page.getByRole('button', { name: 'Add account' }).click()
  await expect(page.getByRole('region', { name: 'Accounts' }).getByText('Main')).toBeVisible()
  await expect(page.locator('main')).toHaveAttribute('data-view', 'ready')
})

test('responsive layout switches on live resize without reload', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await expect(page.locator('main')).toHaveAttribute('data-layout', 'wide')
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(page.locator('main')).toHaveAttribute('data-layout', 'narrow')
})

test('manifest is served with stable identity', async ({ request }) => {
  const res = await request.get('/manifest.webmanifest')
  expect(res.ok()).toBeTruthy()
  const body = await res.json()
  expect(body.id).toBe('/')
  expect(body.display).toBe('standalone')
})
