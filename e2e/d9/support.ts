// Shared support for the D09 browser suite (plan section 7.2): D8R's helpers (which re-export D8P's and the earlier folders'), and the replay test
// Trades of plan section 5 built through the UI. Each Trade is planned, entered and Marked in ONE launch whose clock is the end of the last session
// shown: every earlier session's Mark is entered in the Review's Marks panel (its rows are the missed sessions), and every Position Change is
// recorded with its own Economic Time. The prices are the series' observed Marks (the same arrays the Node suite replays); every figure and
// word a spec asserts is plan section 5's or a W row's. All dates are 2026 and fall in EST (UTC-5).
import type { Locator, Page } from '@playwright/test';
import { K_SALE, R_BREN_U, R_CORV_D, R_DALE_U } from '../../src/domain/trade-analysis/option-trade.ts';
import { R_AXIO_D, REPLAY_SESSION_DATES } from '../../src/domain/trade-analysis/reference-trade.ts';
import {
  answerIn, closeTheTrade, currentTradeId, detail, exitReflection, expect, fillOptionPlan, fillPlan, fillOptionRows, fillRows, onboardedAt, openDrawer as openDetailDrawer, openExitForm, openReview, READY, reachPanel,
  recordExpiration, recordOptionEntry, recordEntry, test, tradeCard, type OptionPlanValues, type PlanValues, type Row, type TradeRef,
} from '../d8r/support.ts';
import type { BrowserContext } from '@playwright/test';

export * from '../d8r/support.ts';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;
// "2026-11-09" as the Review's row label date, "Mon Nov 9".
export const label = (iso: string): string => {
  const d = new Date(`${iso}T12:00:00Z`);
  return `${DAYS[d.getUTCDay()]} ${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
};
// The end of a session (17:00 New York, EST) and a time inside it (10:00 New York), as instants and as Workspace-local entries.
export const closeOf = (iso: string): string => `${iso}T22:00:00Z`;
export const SAT_1121_1000 = '2026-11-21T15:00:00Z';
export const MON_1123_1700 = '2026-11-23T22:00:00Z';

interface Series {
  readonly underlying: readonly (string | null)[];
  readonly held: readonly (string | null)[];
}

// One Trade of section 5: its Plan (an option Plan's four price fields, or a stock Plan), its Position Changes as Row sets, and its observed Marks.
export interface Fixture {
  readonly symbol: string;
  readonly contract?: string; // the option's label in the Review, such as "BREN Nov 20 $100 Call"
  readonly plan: { readonly option: OptionPlanValues; readonly stopOption?: string; readonly targetOption?: string } | { readonly stock: PlanValues };
  readonly entry: Row;
  // Position Changes after the entry, in order: a partial sale, or a final sale that closes the Trade, or the Expiration.
  readonly changes: readonly ({ readonly kind: 'sell'; readonly row: Row; readonly closes?: true } | { readonly kind: 'expiration' })[];
  readonly series: Series;
}

const free = (underlying: string, strike: string, strategy: OptionPlanValues['strategy'], contracts: string, entry: string, stop: string, target: string): OptionPlanValues => ({
  strategy, underlying, expiration: '2026-11-20', strike, contracts, entry, stop, target, planTime: '2026-11-02T09:00',
});
const at10 = (date: string, quantity: string, price: string): Row => ({ quantity, price, fee: '0.00', time: `${date}T10:00` });

export const BREN: Fixture = {
  symbol: 'BREN',
  contract: 'BREN Nov 20 $100 Call',
  plan: { option: free('BREN', '100', 'Long Call', '4', '1.61', '', ''), stopOption: '0.80', targetOption: '4.00' },
  entry: at10('2026-11-02', '4', '1.61'),
  changes: [{ kind: 'sell', row: at10('2026-11-12', '2', '4.00') }],
  series: R_BREN_U,
};
export const BREN_SOLD_OUT: Fixture = {
  ...BREN,
  changes: [...BREN.changes, { kind: 'sell', row: at10('2026-11-13', '2', '4.91'), closes: true }],
  series: K_SALE,
};
export const CORV: Fixture = {
  symbol: 'CORV',
  contract: 'CORV Nov 20 $80 Put',
  plan: { option: free('CORV', '80', 'Long Put', '3', '2.11', '', ''), stopOption: '1.05', targetOption: '5.00' },
  entry: at10('2026-11-02', '3', '2.11'),
  changes: [],
  series: R_CORV_D,
};
export const AXIO: Fixture = {
  symbol: 'AXIO',
  plan: { stock: { symbol: 'AXIO', quantity: '200', entry: '50', stop: '47', target: '56', thesis: 'Breakout.', invalidation: 'Below 47.' } },
  entry: at10('2026-11-02', '200', '50.00'),
  changes: [{ kind: 'sell', row: at10('2026-11-09', '100', '45.60') }],
  series: R_AXIO_D,
};
export const DALE: Fixture = {
  symbol: 'DALE',
  contract: 'DALE Nov 20 $57.50 Put',
  plan: { option: free('DALE', '57.5', 'Cash-Secured Put', '6', '0.94', '54.00', ''), targetOption: '0.20' },
  entry: at10('2026-11-02', '6', '0.94'),
  changes: [{ kind: 'expiration' }],
  series: R_DALE_U,
};
export const DALE_HOLD: Fixture = { ...DALE, changes: [] };

// Fills and confirms the Trade's Plan (dated Mon 11-02 09:00), ending on its Trade Detail.
async function confirmPlan(page: Page, fixture: Fixture): Promise<TradeRef> {
  if ('stock' in fixture.plan) {
    await page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'New Plan' }).click();
    await fillPlan(page, fixture.plan.stock);
    await page.getByLabel('Plan time').fill('2026-11-02T09:00');
    await page.getByRole('button', { name: 'Confirm Plan' }).click();
  } else {
    await fillOptionPlan(page, fixture.plan.option);
    if (fixture.plan.stopOption !== undefined) await page.getByLabel(/^Stop \(option price at or/).fill(fixture.plan.stopOption);
    if (fixture.plan.targetOption !== undefined) await page.getByLabel(/^Target \(option price at or/).fill(fixture.plan.targetOption);
    await page.getByRole('button', { name: 'Confirm Plan' }).click();
  }
  await expect(detail.heading(page, fixture.symbol)).toBeVisible(READY);
  return { symbol: fixture.symbol, tradeId: await currentTradeId(page), label: fixture.symbol };
}

// A Planned Trade: the Plan confirmed and nothing entered, on a fresh profile, ending on its Trade Detail.
export async function buildPlanned(profile: Parameters<typeof onboardedAt>[0], fixture: Fixture, clock: string): Promise<{ context: BrowserContext; page: Page; trade: TradeRef }> {
  const { context, page } = await onboardedAt(profile, clock);
  return { context, page, trade: await confirmPlan(page, fixture) };
}

// Plans and enters the Trade and saves every Mark of sessions 0..through, all at the clock the context was launched with, ending on the Trade's Detail.
// A Position Change is recorded only when its date is on or before the last session (`changes` limits which, by index).
export async function build(
  profile: Parameters<typeof onboardedAt>[0],
  fixture: Fixture,
  clock: string,
  through: number,
  recorded: number = fixture.changes.length,
): Promise<{ context: BrowserContext; page: Page; trade: TradeRef }> {
  const { context, page } = await onboardedAt(profile, clock);
  const trade = await confirmPlan(page, fixture);
  if ('stock' in fixture.plan) await recordEntry(page, [{ ...fixture.entry, fee: '0.00' }]);
  else await recordOptionEntry(page, [fixture.entry]);
  // The Review lists only an Open Trade's missed sessions, so the Marks are saved before a closing sale or an Expiration is recorded.
  const wanted = fixture.changes.slice(0, recorded);
  const closing = (change: Fixture['changes'][number]): boolean => change.kind === 'expiration' || change.closes === true;
  for (const change of [...wanted.filter((c) => !closing(c)), 'marks' as const, ...wanted.filter(closing)]) {
    if (change === 'marks') {
      await saveMarks(page, trade, fixture, through);
      continue;
    }
    await page.goto(`/trades/${trade.tradeId}`);
    await expect(detail.heading(page, fixture.symbol)).toBeVisible(READY);
    if (change.kind === 'expiration') {
      await detail.recordExpirationLink(page).click();
      await recordExpiration(page);
      continue;
    }
    await openExitForm(page);
    if ('stock' in fixture.plan) await fillRows(page, [change.row]);
    else await fillOptionRows(page, [change.row]);
    if (change.closes) await closeTheTrade(page, 'later');
    else await answerIn(exitReflection(page));
    await page.getByRole('button', { name: 'Save exit' }).click();
    await expect(page.getByRole('heading', { name: 'Exit recorded', level: 1 })).toBeVisible(READY);
  }
  await page.goto(`/trades/${trade.tradeId}`);
  await expect(detail.heading(page, fixture.symbol)).toBeVisible(READY);
  return { context, page, trade };
}

// Fills each Mark row of sessions 0..through in the Review's Marks panel, then presses Save Marks once.
async function saveMarks(page: Page, trade: TradeRef, fixture: Fixture, through: number): Promise<void> {
  await page.goto('/');
  await openReview(page);
  const panel = await reachPanel(page, trade, 'Marks');
  let count = 0;
  for (const [i, date] of REPLAY_SESSION_DATES.slice(0, through + 1).entries()) {
    const when = label(date);
    const stock = fixture.series.underlying[i];
    const held = fixture.series.held[i];
    if (stock !== null && stock !== undefined) {
      await panel.getByRole('region', { name: `${fixture.symbol} Mark, ${when}`, exact: true }).getByLabel('Price').fill(stock);
      count += 1;
    }
    if (fixture.contract !== undefined && held !== null && held !== undefined) {
      await panel.getByRole('region', { name: `${fixture.contract} Mark, ${when}`, exact: true }).getByLabel('Price').fill(held);
      count += 1;
    }
  }
  await panel.getByRole('button', { name: `Save Marks (${count})`, exact: true }).click();
  // The card moves on to its next panel once the Marks are saved, so the Marks panel's own button is read inside the card.
  await expect(tradeCard(page, trade).locator('section[aria-label="Marks"] button', { hasText: /^Save Marks/ })).toHaveText('Save Marks (0)', READY);
}

// ---- Reads of the replay (the Detail's Replay drawer; the Review card's section reads the same, given its own scope) -------------------------------

// T9AR.8: the replay is an overlay over the whole page, named "Replay, BREN"; the Detail's "Replay" button opens it.
export const replay = (page: Page): Locator => page.getByRole('dialog', { name: /^Replay, / });
// A drawer by its tab; "Replay" is the button beside the tabs, which opens the overlay (and does nothing when it is already open).
export async function openDrawer(page: Page, name: Parameters<typeof openDetailDrawer>[1] | 'Replay'): Promise<void> {
  if (name !== 'Replay') return openDetailDrawer(page, name);
  if ((await replay(page).count()) === 0) await page.locator('.trade-detail').getByRole('button', { name: 'Replay', exact: true }).click();
  await replay(page).waitFor();
}
// T9AR.9: the Review card's "Replay" button, in its Action panel directly above the Action form; the overlay it opens is the Detail's, read with `replay(page)`.
export const cardReplayButton = (page: Page, card: TradeRef): Locator => tradeCard(page, card).locator('button.review-card-replay');
export async function openCardReplay(page: Page, card: TradeRef): Promise<Locator> {
  if ((await replay(page).count()) === 0) await cardReplayButton(page, card).click();
  await replay(page).waitFor();
  return replay(page);
}
export const headline = (scope: Locator): Locator => scope.getByTestId('headline');
export const going = (scope: Locator): Locator => scope.locator('.replay-going');
export const stake = (scope: Locator): Locator => scope.locator('.replay-stake');
export const slider = (scope: Locator): Locator => scope.getByRole('slider', { name: 'Session' });
export const sliderValue = (scope: Locator): Locator => scope.locator('.replay-slider-value');
export const hits = (scope: Locator): Locator => scope.locator('div.replay-hits[role=group][aria-label=Sessions]');
export const priceStrip = (scope: Locator): Locator => scope.locator('svg.price-strip');
export const pnlChart = (scope: Locator): Locator => scope.locator('svg.pnl-chart');
export const chartText = (chart: Locator): Promise<string[]> => chart.locator('text').allTextContents();
// A readout row's value, by its name ("Trade P&L", "Banked", "Open", "At Stop" ...): a list row's value, or the "From here" cell of a stake grid row.
export const readoutValue = (scope: Locator, row: string): Locator => scope.locator(`.replay-readout [data-row="${row}"] .replay-value`);
// A stake grid row's "R" cell ("At Stop", "At Worst case", "At Target", "At Max reward").
export const readoutR = (scope: Locator, row: string): Locator => scope.locator(`.replay-readout [data-row="${row}"] .replay-r`);
// A stake grid row's "P&L if hit" cell: where the Trade would end there.
export const readoutPnl = (scope: Locator, row: string): Locator => scope.locator(`.replay-readout [data-row="${row}"] .replay-pnl-value`);
// The one row above the grid's two headings when the Trade is past a line ("Past the Stop by $300.00 (0.50R) · at Stop −$740.00").
export const pastLine = (scope: Locator): Locator => scope.locator('.replay-readout .replay-past-line');
// A dash named "No Mark" inside a readout value or grid cell (W61).
export const noMarkDash = (cell: Locator): Locator => cell.getByRole('img', { name: 'No Mark' });
// The folded "Session by session" table: opened on first use, then a row's cells (every column after the Session) by its date.
export async function openTable(scope: Locator): Promise<Locator> {
  const details = scope.locator('details.replay-table');
  if ((await details.getAttribute('open')) === null) await details.locator('summary').click();
  return details.locator('table');
}
export const tableRow = (table: Locator, date: string): Locator => table.locator('tbody tr').filter({ has: table.page().getByRole('rowheader', { name: date, exact: true }) });

// The slider's keys, from its focus: one session per arrow, the first or the last by Home and End.
export async function seek(page: Page, scope: Locator, key: 'ArrowLeft' | 'ArrowRight' | 'Home' | 'End', times = 1): Promise<void> {
  await slider(scope).focus();
  for (let i = 0; i < times; i += 1) await page.keyboard.press(key);
}

// The Replay drawer's own session labels from the first to `through` (an index of REPLAY_SESSION_DATES).
export const sessionLabels = (through: number): string[] => REPLAY_SESSION_DATES.slice(0, through + 1).map(label);

// A resize to a viewport of the given size, then two frames, so no measure reads the old layout.
export async function setViewport(page: Page, width: number, height: number): Promise<void> {
  await page.setViewportSize({ width, height });
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
}

export { test };
