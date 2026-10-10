import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

// VD1 T1.2 structural verification: the static shell renders in both layouts,
// switches layout live without reload/route/scroll loss, and passes an
// axe scan with zero critical/serious violations in both layouts.

const NARROW = { width: 375, height: 667 }
const WIDE = { width: 1280, height: 720 }

const routes = [
  { path: '/', heading: 'Trade Journal' },
  { path: '/trades', heading: 'Trades' },
  { path: '/plan', heading: 'New Plan' },
  { path: '/review', heading: 'Daily Review' },
  { path: '/journal', heading: 'Journal' },
  { path: '/reports', heading: 'Reports' },
  { path: '/settings', heading: 'Settings' },
]

async function criticalSeriousViolations(page: Page) {
  const results = await new AxeBuilder({ page }).analyze()
  return results.violations.filter(
    (v) => v.impact === 'critical' || v.impact === 'serious',
  )
}

for (const layout of [
  { name: 'narrow', size: NARROW, nav: 'bottom-nav' },
  { name: 'wide', size: WIDE, nav: 'side-nav' },
]) {
  for (const { path, heading } of routes) {
    test(`shell renders + axe clean (${layout.name}): ${path}`, async ({
      page,
    }) => {
      await page.setViewportSize(layout.size)
      await page.goto(path)
      await expect(
        page.getByRole('navigation', { name: 'Main menu' }),
      ).toBeVisible()
      await expect(
        page.getByRole('heading', { name: heading, exact: true }),
      ).toBeVisible()
      expect(await criticalSeriousViolations(page)).toEqual([])
    })
  }
}

test('live resize switches layout without reload, route, or scroll loss', async ({
  page,
}) => {
  await page.setViewportSize(NARROW)
  await page.goto('/trades')
  await expect(page.locator('[data-shell="bottom-nav"]')).toBeVisible()
  await expect(page.locator('[data-shell="side-nav"]')).toBeHidden()

  await page.evaluate(() => window.scrollTo(0, 400))
  expect(await page.evaluate(() => window.scrollY)).toBe(400)
  await page.evaluate(() => {
    ;(window as { __shellAlive?: boolean }).__shellAlive = true
  })

  await page.setViewportSize(WIDE)
  await expect(page.locator('[data-shell="side-nav"]')).toBeVisible()
  await expect(page.locator('[data-shell="bottom-nav"]')).toBeHidden()
  expect(page.url()).toContain('/trades')
  await expect(
    page.getByRole('heading', { name: 'Trades', exact: true }),
  ).toBeVisible()
  expect(await page.evaluate(() => window.scrollY)).toBe(400)
  expect(
    await page.evaluate(() => (window as { __shellAlive?: boolean }).__shellAlive),
  ).toBe(true)

  await page.setViewportSize(NARROW)
  await expect(page.locator('[data-shell="bottom-nav"]')).toBeVisible()
  expect(page.url()).toContain('/trades')
  expect(
    await page.evaluate(() => (window as { __shellAlive?: boolean }).__shellAlive),
  ).toBe(true)
})
