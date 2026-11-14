// Shared support for the D7 browser suite (plan section 6.2): D6's helpers (which re-export D5R's, D5's, D4's and D2's), the faults
// build as the served build (the default for every case), and the option steps: the option Plan form and the option exit. Dates follow the breakdown's fixtures:
// every contract expires Friday 2026-11-20 (EST, UTC-5).
import type { Locator, Page } from '@playwright/test';
import { answerCloseReviewIn, answerIn, closeReasonGroup, closingSection, closeReviewGroup, completeReflection, createTradeAt, currentTradeId, detail, executionRow, expect, openDrawer, openEntryForm, PLAN, reachCard, reachPanel, READY, tradeCard, type CardRef, type ProbedDatabase, type TradeRef, test as d1Test, type Row } from '../d6/support.ts'; // d6's test, whose automatic fixture serves current

export * from '../d6/support.ts';

// D4's test serves dist-releases/current through an automatic fixture; D7 cases measure the current source, so this one depends on it
// and switches the served build back to dist-faults before the case launches anything.
export const test = d1Test.extend<{ d7Faults: void }>({
  d7Faults: [
    async ({ server, d4Release }, provide) => {
      void d4Release;
      server.use('dist-faults');
      await provide();
    },
    { auto: true },
  ],
});

// Instants. October is EDT (UTC-4); from 2026-11-01 the Workspace zone is EST (UTC-5).
export const MONDAY_0900 = '2026-10-12T13:00:00Z';
export const MONDAY_1105 = '2026-10-12T15:05:00Z';
export const TUESDAY_1030 = '2026-10-13T14:30:00Z';
export const FRIDAY_NOV_1700 = '2026-11-20T22:00:00Z';
export const MONDAY_NOV_1700 = '2026-11-23T22:00:00Z';

export interface OptionPlanValues {
  readonly strategy: 'Long Call' | 'Long Put' | 'Cash-Secured Put';
  readonly underlying: string;
  readonly expiration: string;
  readonly strike: string;
  readonly contracts: string;
  readonly entry: string;
  readonly stop: string;
  readonly target: string;
  // Workspace-local Plan time, when the case's clock is later than the Plan's day.
  readonly planTime?: string;
}

// O-C: 2 Calls at 2.00, Stop XYZ at or below 48.00, Target at or above 60.00.
export const OC: OptionPlanValues = { strategy: 'Long Call', underlying: 'XYZ', expiration: '2026-11-20', strike: '55', contracts: '2', entry: '2.00', stop: '48', target: '60' };
// O-S: 2 short Puts at 1.20, Stop MNO at or below 42.00, Target at or above 50.00.
export const OS: OptionPlanValues = { strategy: 'Cash-Secured Put', underlying: 'MNO', expiration: '2026-11-20', strike: '45', contracts: '2', entry: '1.20', stop: '42', target: '50' };

const primary = (page: Page): Locator => page.getByRole('navigation', { name: 'Primary' });

// Fills the option Plan form and its reflection (Conviction 4, Calm).
export async function fillOptionPlan(page: Page, values: OptionPlanValues): Promise<void> {
  await primary(page).getByRole('link', { name: 'New Plan' }).click();
  await expect(page.getByRole('heading', { name: 'New Plan' })).toBeVisible(READY);
  await page.getByLabel('Strategy').selectOption({ label: values.strategy });
  await page.getByLabel('Underlying', { exact: true }).fill(values.underlying);
  await page.getByLabel('Expiration date').fill(values.expiration);
  await page.getByLabel('Strike').fill(values.strike);
  await page.getByLabel('Contracts').fill(values.contracts);
  await page.getByLabel('Intended entry price (per share)').fill(values.entry);
  await page.getByLabel(/^Stop \((?!option price)/).fill(values.stop);
  await page.getByLabel(/^Target \((?!option price)/).fill(values.target);
  if (values.planTime) await page.getByLabel('Plan time').fill(values.planTime);
  await page.getByLabel('Why this trade, why now?').fill('Earnings run-up with defined risk.');
  await page.getByLabel('What would invalidate the thesis?').fill('A close below the Stop.');
  await page.getByRole('radiogroup', { name: 'Conviction' }).getByLabel('4').check();
  await page.getByRole('radiogroup', { name: 'Primary emotion' }).getByLabel('Calm').check();
}

// Fills and confirms an option Plan at the pinned clock, ending on its Trade Detail.
export async function confirmOptionPlan(page: Page, values: OptionPlanValues): Promise<void> {
  await fillOptionPlan(page, values);
  await page.getByRole('button', { name: 'Confirm Plan' }).click();
  await expect(detail.heading(page, values.underlying)).toBeVisible(READY);
}

// An option Execution form's rows (labelled Contracts and Price (per share)).
export async function fillOptionRows(page: Page, rows: readonly Row[]): Promise<void> {
  for (const [index, row] of rows.entries()) {
    if (index > 0) await page.getByRole('button', { name: 'Add Execution' }).click();
    const group = executionRow(page, index + 1);
    await group.getByLabel('Contracts').fill(row.quantity);
    await group.getByLabel('Price (per share)').fill(row.price);
    await group.getByLabel('Fee').fill(row.fee);
    if (row.time !== '') await group.getByLabel('Economic Time').fill(row.time);
  }
}

// From a Trade Detail: an option exit saved (a partial one, which closes nothing), ending on its receipt.
export async function recordOptionExit(page: Page, rows: readonly Row[]): Promise<void> {
  await fillOptionExit(page, rows);
  await page.getByRole('button', { name: 'Save exit' }).click();
  await expect(page.getByRole('heading', { name: 'Exit recorded', level: 1 })).toBeVisible(READY);
}

export const FRIDAY_NOV = 'Fri Nov 20';

// The Settlement Review fixture, created through the UI at Tuesday 10:30 (so every Economic Time is past): T-1 is O-C through
// X1 (1 contract left of the XYZ Call), T-2 a Long Stock XYZ of 100 shares since Monday 10-12, and T-3 O-S after S1 (2 short
// MNO Puts). T-4 and T-5 of the plan's table are left out: they add no settlement and these cases name neither.
export async function createSettlementFixture(page: Page): Promise<{ t1: TradeRef; t2: TradeRef; t3: TradeRef }> {
  await confirmOptionPlan(page, { ...OC, planTime: '2026-10-12T09:00' });
  const t1 = await currentTradeId(page);
  await recordOptionEntry(page, [
    { quantity: '1', price: '2.10', fee: '0.65', time: '2026-10-12T10:00' },
    { quantity: '1', price: '1.90', fee: '0.65', time: '2026-10-12T11:00' },
  ]);
  await page.getByRole('link', { name: 'Back to the Trade' }).click();
  await recordOptionExit(page, [{ quantity: '1', price: '3.00', fee: '0.65', time: '2026-10-13T10:00' }]);
  const t2 = await createTradeAt(page, PLAN, '2026-10-12T09:30', [['100', '50.00', '2026-10-12T10:00']]);
  await confirmOptionPlan(page, { ...OS, planTime: '2026-10-12T09:00' });
  const t3 = await currentTradeId(page);
  await recordOptionEntry(page, [{ quantity: '2', price: '1.25', fee: '1.30', time: '2026-10-12T10:00' }]);
  return { t1: { symbol: 'XYZ', tradeId: t1, label: 'T-1' }, t2: { symbol: 'XYZ', tradeId: t2, label: 'T-2' }, t3: { symbol: 'MNO', tradeId: t3, label: 'T-3' } };
}

// An option's Mark row in a card's Marks panel, named by the contract's label (convention C6).
export async function optionMarkRow(page: Page, card: CardRef, label: string, date: string): Promise<Locator> {
  return (await reachPanel(page, card, 'Marks')).getByRole('region', { name: `${label} Mark, ${date}`, exact: true });
}

// Fills one Mark price in the open card's Marks panel and presses Save Marks (D5R, A153).
export async function saveMarkPrice(page: Page, card: CardRef, row: Locator, price: string): Promise<void> {
  await row.getByLabel('Price').fill(price);
  await (await reachPanel(page, card, 'Marks')).getByRole('button', { name: /^Save Marks/ }).click();
}

// After Save Marks succeeded the card clears its drafts and moves on to its next panel (A157); this waits for that, then
// opens the Marks panel again and returns the saved option row.
export async function savedOptionMarkRow(page: Page, card: CardRef, label: string, date: string): Promise<Locator> {
  await expect(tradeCard(page, card).locator('section[aria-label="Marks"] button', { hasText: /^Save Marks/ })).toHaveText('Save Marks (0)', READY);
  return optionMarkRow(page, card, label, date);
}

// A card's Settlement panel header and its content, and the panel opened.
export const settlementHeader = (page: Page, card: CardRef): Locator => tradeCard(page, card).getByRole('button', { name: /^Settlement\b/ });
export async function openSettlement(page: Page, card: CardRef): Promise<Locator> {
  await reachCard(page, card);
  const header = settlementHeader(page, card);
  if ((await header.getAttribute('aria-expanded')) !== 'true') await header.click();
  await expect(header).toHaveAttribute('aria-expanded', 'true');
  return tradeCard(page, card).getByRole('region', { name: 'Settlement', exact: true });
}

// On the expiration form: answers the expiration's own reflection, then either defers the Close Review (Reflect later, the
// default) or answers it now, and saves. The Close Reason is never asked for an Expiration (row 21.16).
export async function recordExpiration(page: Page, closeReview: 'later' | 'now' = 'later'): Promise<void> {
  await expect(page.getByRole('heading', { name: 'Expiration', level: 1 })).toBeVisible(READY);
  await answerIn(page.getByRole('region', { name: 'Reflection on this expiration' }));
  await expect(closeReasonGroup(page)).toHaveCount(0);
  if (closeReview === 'later') await closeReviewGroup(page).getByLabel('Reflect later').check();
  else await answerCloseReviewIn(closingSection(page));
  await page.getByRole('button', { name: 'Save expiration' }).click();
  await expect(page.getByRole('heading', { name: 'Expiration recorded', level: 1 })).toBeVisible(READY);
}

// A payoff line with a value: the drawer's one chart (named by the captions of the tables it draws) and the table that is that line's text
// equivalent.
export async function expectPayoffChart(page: Page, kind: 'Planned' | 'Current'): Promise<void> {
  await openDrawer(page, 'Payoff');
  await expect(detail.payoffChart(page).filter({ visible: true })).toHaveCount(1, READY);
  await expect(detail.payoffChart(page)).toHaveAccessibleName(new RegExp(`${kind} payoff at expiration by `));
  const table = detail.payoff(page, kind).getByRole('table', { name: new RegExp(`^${kind} payoff at expiration by `) });
  await expect(table).toBeVisible();
  await expect(table.getByRole('columnheader')).toHaveCount(3);
  expect(await table.locator('tbody tr').count()).toBeGreaterThan(0);
}

// A payoff line that does not apply: text naming the reason ("Now: Not applicable: no open position", or a stock Trade's one line), with no
// table for that line, so the state is not colour alone.
export async function expectPayoffNotApplicable(page: Page, kind: 'Planned' | 'Current', reason: RegExp): Promise<void> {
  await openDrawer(page, 'Payoff');
  await expect(detail.payoffDrawer(page).getByText(reason)).toBeVisible(READY);
  await expect(detail.anywhere(() => detail.payoff(page, kind))).toHaveCount(0);
}

// The Workspace's stored Journal Entries (by their entry type key).
export const entriesOf = (workspace: ProbedDatabase): { entryTypeKey: string }[] => (workspace.stores['journalEntries'] ?? []) as { entryTypeKey: string }[];

// O-S after S1 (Sell to open 2 @ 1.25, Monday 10:00), planned Monday 09:00 and recorded at whatever the clock is now, ending on its
// Trade Detail; returns the Trade's id.
export async function createShortPutTrade(page: Page): Promise<string> {
  await confirmOptionPlan(page, { ...OS, planTime: '2026-10-12T09:00' });
  const tradeId = await currentTradeId(page);
  await recordOptionEntry(page, [{ quantity: '2', price: '1.25', fee: '1.30', time: '2026-10-12T10:00' }]);
  await page.getByRole('link', { name: 'Back to the Trade' }).click();
  await expect(detail.heading(page, 'MNO')).toBeVisible(READY);
  return tradeId;
}

// From a Trade Detail: one option entry (Buy to open or Sell to open) with these rows and the reflection, ending on its receipt.
export async function recordOptionEntry(page: Page, rows: readonly Row[]): Promise<void> {
  await openEntryForm(page);
  await fillOptionRows(page, rows);
  await completeReflection(page);
  await page.getByRole('button', { name: 'Save entry' }).click();
  await expect(page.getByRole('heading', { name: 'Entry recorded' })).toBeVisible();
}

// From a Trade Detail, opens the exit form (a Buy to close or Sell to close), fills its rows and its reflection.
export async function fillOptionExit(page: Page, rows: readonly Row[]): Promise<void> {
  await detail.recordExitLink(page).click();
  await expect(page.getByRole('heading', { name: 'Record exit', level: 1 })).toBeVisible(READY);
  await fillOptionRows(page, rows);
  const section = page.getByRole('region', { name: 'Reflection on this exit' });
  await section.getByRole('radiogroup', { name: 'Decision mode' }).getByLabel('As Planned').check();
  await section.getByRole('radiogroup', { name: 'Primary emotion' }).getByLabel('Calm').check();
  await section.getByRole('radiogroup', { name: 'Decision confidence' }).getByLabel('4').check();
}
