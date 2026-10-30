// T5.22 query-count proof (AC-PERF-001, A63): D4's counts for the Review `open` stay as they are, the
// Review `open` adds exactly one getAll on journalDebts `byOutstandingDue`, and Trade Detail reads
// the Trade's Debt with exactly one getAll on `byAnchorTrade`; neither count moves with the number of
// settled Debts in history, because settled Debt leaves the sparse index. Counted as D4's T4.31 does:
// the real facade on fake-indexeddb wrapped in the disclosed request counter (D2 section 6.0).
import { describe, expect, it } from 'vitest';
import { createApplication, type Application } from '../../../src/app/compose.ts';
import { nyseSessionPolicy } from '../../../src/domain/session-policy/index.ts';
import { fixedClock } from '../../../src/domain/time/index.ts';
import { countRequests, type CountedRequest } from '../../support/request-counter.ts';
import { TEST_CAPACITY } from '../../support/stack.ts';
import { planCommand } from '../d1/support.ts';
import { complete, device, reflectionDefinitionId } from './support.ts';

// 2028-12-29 is the last session in the policy's coverage; 21:35Z is five minutes after its completion.
const AS_OF = '2028-12-29T21:35:00Z';
const REVIEW_DATE = '2028-12-29';
const SESSIONS = 100;
// Two Instruments with a Mark on every session, one whose as-of Mark is Missing, one Instrument shared by two Trades.
const MARKED = ['AAA', 'BBB'];
const MISSING = ['MIS'];
const TRADES = ['AAA', 'BBB', 'MIS', 'AAA'];

// The latest `count` session dates up to the as-of date, newest first.
function sessionDates(count: number): string[] {
  const dates: string[] = [];
  let date = REVIEW_DATE;
  for (let n = 0; n < count; n++) {
    dates.push(date);
    if (n === count - 1) break;
    const previous = nyseSessionPolicy.previousSession(date);
    if (!previous.ok) throw new Error('coverage');
    date = previous.value.date;
  }
  return dates;
}

// Defers one fill on the Trade, then settles it by answering the Debt (the Debt leaves byOutstandingDue).
// With `settle` false the Debt stays Outstanding.
async function deferFill(app: Application, tradeId: string, economicTime: string, settle: boolean) {
  const detail = await app.TradeViewsAndReporting.getTradeDetail({ tradeId });
  if (detail.kind !== 'Ready') throw new Error(`detail: ${detail.kind}`);
  const leg = detail.view.plan.legs[0]!;
  const recorded = await app.TradeWorkflows.recordPositionChange({
    originTradeId: tradeId,
    trades: [{ tradeId, expectedFactRevision: detail.view.factRevision }],
    members: [
      { kind: 'Execution', tradeId, action: 'Buy', instrument: leg.instrument, intent: { kind: 'ServesPlannedLeg', plannedLegId: leg.factId }, quantity: '1', price: '50.20', fee: '0.01', economicTime },
    ],
    reflection: { kind: 'Defer' },
  });
  if (recorded.kind !== 'Recorded') throw new Error(`defer: ${JSON.stringify(recorded)}`);
  if (!settle) return;
  const page = await app.Journal.query({ scope: 'OutstandingDebt' });
  if (!('debts' in page)) throw new Error(`query: ${page.kind}`);
  const debt = page.debts.find((d) => d.anchor.tradeId === tradeId && d.momentTime === economicTime && d.status === 'Outstanding');
  if (!debt) throw new Error('no Outstanding Debt to settle');
  const form = await complete(app);
  if (form.kind !== 'Complete') throw new Error('form');
  const saved = await app.Journal.save({ intention: 'ResolveDebt', debtId: debt.debtId, expectedDebtRevision: debt.revision, resolution: { kind: 'Answer', form: form.form } });
  if (saved.kind !== 'Saved') throw new Error(`resolve: ${saved.kind}`);
}

// `settled` Debts answered in history across the Trades, and one Outstanding Debt on the second Trade.
async function setup(settled: number) {
  const d = await device(undefined, AS_OF);
  const app = await createApplication({
    indexedDB: d.factory,
    host: d.testHost.host,
    clock: fixedClock(AS_OF),
    ids: d.ids,
    releaseId: d.testHost.releaseId,
    capacityRequirement: TEST_CAPACITY,
    locks: d.locks,
  });
  const initialized = await app.Workspace.initialize({ timeZone: 'America/New_York' });
  if (initialized.kind !== 'Opened') throw new Error(`initialize: ${initialized.kind}`);
  const institution = await app.ReferenceCatalog.save({ kind: 'CreateInstitution', label: 'Fidelity' });
  if (institution.kind !== 'Saved') throw new Error(`institution: ${institution.kind}`);
  const account = await app.ReferenceCatalog.save({ kind: 'CreateAccount', institutionId: institution.record.id, label: 'Roth IRA' });
  if (account.kind !== 'Saved') throw new Error(`account: ${account.kind}`);

  const dates = sessionDates(SESSIONS);
  const first = dates.at(-1)!;
  const planTime = `${first}T13:30:00Z`;
  const fillTime = `${first}T14:00:00Z`;
  const tradeIds: string[] = [];
  for (const symbol of TRADES) {
    const confirmed = await app.TradeWorkflows.confirmPlan(await planCommand(app, { underlying: symbol, economicTime: planTime }));
    if (confirmed.kind !== 'Confirmed') throw new Error(`plan ${symbol}: ${confirmed.kind}`);
    const detail = await app.TradeViewsAndReporting.getTradeDetail({ tradeId: confirmed.receipt.tradeId });
    if (detail.kind !== 'Ready') throw new Error(`detail: ${detail.kind}`);
    const leg = detail.view.plan.legs[0]!;
    const recorded = await app.TradeWorkflows.recordPositionChange({
      originTradeId: confirmed.receipt.tradeId,
      trades: [{ tradeId: confirmed.receipt.tradeId, expectedFactRevision: detail.view.factRevision }],
      members: [
        { kind: 'Execution', tradeId: confirmed.receipt.tradeId, action: 'Buy', instrument: leg.instrument, intent: { kind: 'ServesPlannedLeg', plannedLegId: leg.factId }, quantity: '100', price: '50.10', fee: '0.65', economicTime: fillTime },
      ],
      reflection: { kind: 'Decline', definitionId: await reflectionDefinitionId(app) },
    });
    if (recorded.kind !== 'Recorded') throw new Error(`open ${symbol}: ${JSON.stringify(recorded)}`);
    tradeIds.push(confirmed.receipt.tradeId);
  }

  // Marks written directly (a bulk seed), as D4's query-count test does.
  const records = [...MARKED, ...MISSING].flatMap((instrumentKey) =>
    dates
      .filter((tradingDate) => !(MISSING.includes(instrumentKey) && tradingDate === REVIEW_DATE))
      .map((tradingDate) => ({
        instrumentKey,
        tradingDate,
        resolutionRevision: 1,
        marks: [{ revisionId: `m-${instrumentKey}-${tradingDate}`, revisionNumber: 1, price: '51', source: 'Manual', intention: 'InitialManual', observedAt: AS_OF, savedAt: AS_OF }],
        effectiveMarkId: `m-${instrumentKey}-${tradingDate}`,
        acknowledgments: [],
        effectiveAcknowledgmentId: null,
      })),
  );
  const committed = await app.persistence.commit({ checks: [], writes: records.map((value) => ({ op: 'put' as const, store: 'observations' as const, value })) });
  if (committed.kind !== 'Committed') throw new Error('seed failed');

  for (let n = 0; n < settled; n++) await deferFill(app, tradeIds[n % tradeIds.length]!, fillTime, true);
  await deferFill(app, tradeIds[1]!, fillTime, false);
  return { app, outstandingTrade: tradeIds[1]! };
}

const on = (requests: readonly CountedRequest[], ...stores: string[]) => requests.filter((r) => stores.includes(r.store));

// The Review `open` and a Trade Detail (the Trade with the Outstanding Debt), each with its requests.
async function measure(settled: number) {
  const { app, outstandingTrade } = await setup(settled);
  const review = await countRequests(() => app.DailyReview.open({ date: { kind: 'LatestCompleted' }, asOf: AS_OF }));
  if (review.result.kind !== 'Ready') throw new Error(review.result.kind);
  const detail = await countRequests(() => app.TradeViewsAndReporting.getTradeDetail({ tradeId: outstandingTrade }));
  if (detail.result.kind !== 'Ready') throw new Error(detail.result.kind);
  return { review, detail };
}

const BY_OUTSTANDING_DUE = { on: 'index', store: 'journalDebts', index: 'byOutstandingDue', method: 'getAll' };
const BY_ANCHOR_TRADE = { on: 'index', store: 'journalDebts', index: 'byAnchorTrade', method: 'getAll' };

describe('T5.22 query count: the Review open and Trade Detail read Debt', () => {
  it('should add exactly one getAll on byOutstandingDue to D4 counts for a Review open', { timeout: 600_000 }, async () => {
    const { review } = await measure(10);
    const instruments = MARKED.length + MISSING.length;

    // D4's reads, unchanged (the same list as D4's query-count test).
    expect(on(review.requests, 'trades', 'observations', 'journalObligations')).toEqual([
      { on: 'index', store: 'trades', index: 'byLifecycleActivity', method: 'getAll', count: 201 },
      { on: 'store', store: 'observations', method: 'getAll' },
      ...MISSING.map(() => ({ on: 'index', store: 'observations', index: 'byInstrumentDate', method: 'openCursor' })),
      ...Array.from({ length: instruments }, () => ({ on: 'index', store: 'observations', index: 'byInstrumentDate', method: 'getAll' })),
      { on: 'store', store: 'journalObligations', method: 'getAll' },
    ]);
    // The addition: one Debt request, on the sparse index.
    expect(on(review.requests, 'journalDebts')).toEqual([BY_OUTSTANDING_DUE]);
    expect(review.result.kind === 'Ready' && review.result.families.flatMap((f) => (f.family === 'Trades' ? f.trades : [])).map((t) => t.reflections.due)).toContain(1);
  });

  it('should add exactly one getAll on byAnchorTrade for a Trade Detail', { timeout: 600_000 }, async () => {
    const { detail } = await measure(10);
    expect(on(detail.requests, 'journalDebts')).toEqual([BY_ANCHOR_TRADE]);
    expect(detail.result.kind === 'Ready' && detail.result.view.journal.filter((item) => 'kind' in item && item.kind === 'Debt')).toHaveLength(1);
  });

  it('should issue the same Debt requests whether history holds 10 or 2,000 settled Debts', { timeout: 1_800_000 }, async () => {
    const small = await measure(10);
    const large = await measure(2_000);
    expect(on(large.review.requests, 'journalDebts')).toEqual(on(small.review.requests, 'journalDebts'));
    expect(on(large.detail.requests, 'journalDebts')).toEqual(on(small.detail.requests, 'journalDebts'));
    expect(large.review.requests).toEqual(small.review.requests);
    console.log(`query-count: Review open Debt reads ${JSON.stringify(on(large.review.requests, 'journalDebts'))}`);
    console.log(`query-count: Trade Detail Debt reads ${JSON.stringify(on(large.detail.requests, 'journalDebts'))}`);
  });
});
