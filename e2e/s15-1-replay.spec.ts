import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'

// S15.1 Replay: a single-lot AAPL Trade (buy 100 @ 150.00 fees 1.00, stop
// 140.00, target 170.00 — the Slice 1 worked example) held open across five
// real weekdays, marked day by day through the Daily Review walk (the only
// UI path that can enter a Mark for a date other than today). Sliding the
// replay to the day marked 160.00 reproduces the Slice 1 worked numbers
// exactly (docs/plan/slice-01-stock-lifecycle.md): unrealized 1000.00, fees
// 1.00, total 999.00; plannedRisk 2000.00, worstCaseRisk 16000.00,
// plannedReward 1000.00, maxReward unlimited.
//
// Dates are pinned to real WEEKDAYS (never a Saturday/Sunday) so the test
// can't go intermittent once S4.4's weekend-quiet ruling lands (weekends
// stop enumerating as "marks needed" rows at all) — today, a weekend may
// still enumerate its own rows too (pre-S4.4 behavior), but this test only
// ever targets its five known weekday rows by name and leaves any other row
// alone; recording the walk's Action never requires every row cleared.

function weekdaysAgo(n: number): string {
  const date = new Date()
  // Land on today, or the most recent prior weekday.
  while (date.getDay() === 0 || date.getDay() === 6) date.setDate(date.getDate() - 1)
  for (let i = 0; i < n; i++) {
    date.setDate(date.getDate() - 1)
    while (date.getDay() === 0 || date.getDay() === 6) date.setDate(date.getDate() - 1)
  }
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

// Chronological, oldest first — every entry a real weekday. Index 2 (the
// middle weekday) is the "known date" the test slides to, marked 160.00.
const DAYS = [weekdaysAgo(4), weekdaysAgo(3), weekdaysAgo(2), weekdaysAgo(1), weekdaysAgo(0)]
const PRICES = ['150', '155', '160', '158', '162']
const KNOWN_DATE_INDEX = 2

async function onboard(page: Page) {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: /set up your first account/i })).toBeVisible()
  await page.getByLabel(/institution name/i).fill('Schwab')
  await page.getByLabel(/account name/i).fill('Taxable')
  await page.getByRole('button', { name: /get started/i }).click()
  await expect(page.getByRole('heading', { name: 'Trades' })).toBeVisible()
}

async function planAndFill(page: Page) {
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

  await page.getByRole('button', { name: /record fill/i }).click()
  await page.getByLabel(/quantity/i).fill('100')
  await page.getByLabel(/price/i).fill('150')
  await page.getByLabel(/fees/i).fill('1')
  await page.getByLabel(/date/i).fill(DAYS[0])
  await page.getByRole('button', { name: /record fill/i }).click()
  await expect(page.getByLabel('status')).toHaveText(/open/i)
}

// Marks each of the five known weekday rows through the Daily Review walk —
// the only UI path that can enter a Mark for a date other than today
// (MarkEntry is today-only). Any OTHER row the agenda happens to enumerate
// (a weekend day, pre-S4.4) is left alone — recording the Action never
// requires every row cleared.
async function markKnownDays(page: Page) {
  await page.getByRole('link', { name: 'Review' }).click()
  await page.getByRole('button', { name: /start review/i }).click()
  await page.getByRole('button', { name: /begin walk/i }).click()

  const rows = page.getByRole('list', { name: 'marks needed' })
  for (let i = 0; i < DAYS.length; i++) {
    const row = rows.getByRole('listitem', { name: `AAPL ${DAYS[i]}`, exact: true })
    await row.getByLabel(/price/i).fill(PRICES[i])
    await row.getByRole('button', { name: 'Save', exact: true }).click()
  }

  await page.getByLabel(/what will you do with this trade/i).selectOption('Hold')
  await page.getByRole('button', { name: /record action/i }).click()
  await page.getByRole('button', { name: /next trade/i }).click()
  await expect(page.getByRole('heading', { name: 'Review complete' })).toBeVisible()
}

test('replays a seeded lifecycle and slides to a known date', async ({ page }) => {
  await onboard(page)
  await planAndFill(page)
  await markKnownDays(page)

  await page.getByRole('link', { name: 'Trades' }).click()
  await page.getByRole('link', { name: 'AAPL' }).click()
  await expect(page.getByRole('heading', { name: 'Trade', exact: true })).toBeVisible()

  await page.getByRole('button', { name: /^replay$/i }).click()
  const slider = page.getByLabel('replay date')
  await expect(slider).toBeVisible()
  await slider.fill(String(KNOWN_DATE_INDEX))

  const pnl = page.getByLabel('replay profit and loss')
  await expect(pnl).toContainText('1000.00') // unrealized
  await expect(pnl).toContainText('999.00') // total

  const rr = page.getByLabel('replay risk and reward')
  await expect(rr.getByLabel('planned risk')).toContainText('2000.00')
  await expect(rr.getByLabel('worst-case risk')).toContainText('16000.00')
  await expect(rr.getByLabel('planned reward')).toContainText('1000.00')
  await expect(rr.getByLabel('max reward')).toContainText(/unlimited/i)

  // Reflective only (ADR 0009) — nothing on this surface projects forward.
  await expect(page.getByText(/forecast|predict|project/i)).toHaveCount(0)
  await expect(page.getByLabel('execution dates')).toContainText(DAYS[0])
})
