// T5R.13 query-count proof (AC-PERF-001, P38): the revised Review reads only what D5's did. A Review `open`
// issues exactly D5's request counts, with the range position and gap Trades adding no request; a
// `SaveReviewMarks` of n entries is one read-only snapshot with n record reads, one read-write commit with
// n checks and n writes, then the post-save assembly a `SaveTradeAction` does, with no recovery and no gap
// scan. Counted as D5's T5.22 does: the real facade on fake-indexeddb behind the disclosed request counter
// (D2 section 6.0), which here also logs each transaction so the snapshot and the commit can be told apart.
import { describe, expect, it } from 'vitest';
import { createApplication, type Application } from '../../../src/app/compose.ts';
import { nyseSessionPolicy } from '../../../src/domain/session-policy/index.ts';
import { fixedClock } from '../../../src/domain/time/index.ts';
import type { MarketDataPrepareEntry } from '../../../src/modules/market-data/index.ts';
import { countRequests, type CountedRequest } from '../../support/request-counter.ts';
import { TEST_CAPACITY } from '../../support/stack.ts';
import { planCommand } from '../d1/support.ts';
import { complete, device, reflectionDefinitionId } from '../d5/support.ts';

// 2028-12-29 is the last session in the policy's coverage; 21:35Z is five minutes after its completion.
const AS_OF = '2028-12-29T21:35:00Z';
const REVIEW_DATE = '2028-12-29';
const SESSIONS = 100;
// As D5's test: two Instruments with a Mark on every session, one Missing on the Review date, one shared by two Trades.
const MARKED = ['AAA', 'BBB'];
const MISSING = ['MIS'];
const TRADES = ['AAA', 'BBB', 'MIS', 'AAA'];
// The Missing Instrument also lacks the two sessions before the Review date, so its Trade has a gap to walk.
const GAP_SESSIONS = 4;

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

const dates = sessionDates(SESSIONS);
const missingDates = dates.slice(0, GAP_SESSIONS);

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

// D5's stack: ten settled Debts across the Trades and one Outstanding Debt on the second.
async function setup() {
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

  // Marks written directly (a bulk seed), as D5's test does.
  const records = [...MARKED, ...MISSING].flatMap((instrumentKey) =>
    dates
      .filter((tradingDate) => !(MISSING.includes(instrumentKey) && missingDates.includes(tradingDate)))
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

  for (let n = 0; n < 10; n++) await deferFill(app, tradeIds[n % tradeIds.length]!, fillTime, true);
  await deferFill(app, tradeIds[1]!, fillTime, false);
  return { app, tradeIds };
}

const on = (requests: readonly CountedRequest[], ...stores: string[]) => requests.filter((r) => stores.includes(r.store));

// A save's requests grouped by transaction. The commit is the one read-write transaction on the Workspace's data
// (the write gate's own pointer and diagnostics transactions come before it); `after` is what follows it.
interface Tx {
  readonly mode: string;
  readonly stores: readonly string[];
  readonly requests: readonly CountedRequest[];
  // The transaction entry and its requests, as logged.
  readonly all: readonly CountedRequest[];
}
function parts(requests: readonly CountedRequest[]) {
  const txs: { head: CountedRequest; requests: CountedRequest[] }[] = [];
  for (const r of requests) {
    if (r.on === 'transaction') txs.push({ head: r, requests: [] });
    else txs.at(-1)!.requests.push(r);
  }
  const grouped: Tx[] = txs.map(({ head, requests: inner }) => ({ mode: head.method, stores: head.store.split(','), requests: inner, all: [head, ...inner] }));
  const commitAt = grouped.findIndex((tx) => tx.mode === 'readwrite' && !tx.stores.some((s) => s === 'pointer' || s === 'diagnostics'));
  if (commitAt < 0) throw new Error('no commit transaction');
  return { before: grouped.slice(0, commitAt), commit: grouped[commitAt]!, after: grouped.slice(commitAt + 1) };
}

describe('T5R.13 query count: the Review open and the Marks save', () => {
  it('should issue D5 counts for a Review open, with the range position and the gap Trades adding no request', { timeout: 600_000 }, async () => {
    const { app } = await setup();
    const review = await countRequests(() => app.DailyReview.open({ date: { kind: 'LatestCompleted' }, asOf: AS_OF }));
    if (review.result.kind !== 'Ready') throw new Error(review.result.kind);
    const instruments = MARKED.length + MISSING.length;

    // D5's reads, unchanged (the same lists as T5.22's first case).
    expect(on(review.requests, 'trades', 'observations', 'journalObligations')).toEqual([
      { on: 'index', store: 'trades', index: 'byLifecycleActivity', method: 'getAll', count: 201 },
      { on: 'store', store: 'observations', method: 'getAll' },
      ...MISSING.map(() => ({ on: 'index', store: 'observations', index: 'byInstrumentDate', method: 'openCursor' })),
      ...Array.from({ length: instruments }, () => ({ on: 'index', store: 'observations', index: 'byInstrumentDate', method: 'getAll' })),
      { on: 'store', store: 'journalObligations', method: 'getAll' },
    ]);
    expect(on(review.requests, 'journalDebts')).toEqual([{ on: 'index', store: 'journalDebts', index: 'byOutstandingDue', method: 'getAll' }]);

    // The data does exercise the additions: a placed range position, and the Missing Instrument's earlier gap.
    const families = review.result.families;
    const walked = families.flatMap((f) => (f.family === 'Trades' ? f.trades : []));
    expect(walked.some((t) => t.rangePosition.kind === 'Placed')).toBe(true);
    const gaps = families.flatMap((f) => (f.family === 'Marks' ? f.earlier : []));
    expect(gaps.map((g) => ({ instrumentKey: g.instrumentKey, missing: g.missing.length }))).toEqual([{ instrumentKey: 'MIS', missing: GAP_SESSIONS - 1 }]);
  });

  it.each([1, 3])('should save %i Marks in one read-only snapshot and one read-write commit, then assemble as a Trade Action save does', { timeout: 600_000 }, async (n) => {
    const { app, tradeIds } = await setup();
    const open = async () => {
      const opened = await app.DailyReview.open({ date: { kind: 'LatestCompleted' }, asOf: AS_OF });
      if (opened.kind !== 'Ready') throw new Error(opened.kind);
      return opened;
    };
    const initial = (tradingDate: string): MarketDataPrepareEntry => ({
      key: { instrumentKey: 'MIS', tradingDate },
      expectedRevision: 'None',
      intention: { kind: 'RecordInitialManualMark', price: '51' },
    });
    // The Missing Review-date Mark first, so the Action save below reaches a Trade as its next step.
    const filled = await app.DailyReview.save({ kind: 'SaveReviewMarks', reviewDate: REVIEW_DATE, tradeId: tradeIds[2]!, binding: (await open()).binding, entries: [initial(REVIEW_DATE)] });
    expect(filled.kind).toBe('MarksSaved');
    // A Trade Action save, counted; the Review now holds an Action, as it does for the Marks save after it. It is saved on
    // the Trade with the Outstanding Debt, so the next Trade it reads back has none, as the Marks card has none: a Debt
    // adds a read of its definition to a card, which would be a difference of data, not of assembly.
    const card = await app.DailyReview.getTrade({ reviewDate: REVIEW_DATE, tradeId: tradeIds[1]!, binding: (await open()).binding });
    if (card.kind !== 'Ready') throw new Error(card.kind);
    const action = await countRequests(() => app.DailyReview.save({ kind: 'SaveTradeAction', binding: card.trade.saveBinding, action: 'Hold' }), { transactions: true });
    expect(action.result.kind).toBe('Saved');

    // n earlier sessions of the Missing Instrument, saved from its Trade's card.
    const entries = missingDates.slice(1, 1 + n).map(initial);
    const { binding } = await open();
    const marks = await countRequests(() => app.DailyReview.save({ kind: 'SaveReviewMarks', reviewDate: REVIEW_DATE, tradeId: tradeIds[2]!, binding, entries }), { transactions: true });
    expect(marks.result.kind).toBe('MarksSaved');
    const saved = parts(marks.requests);

    // One read-only snapshot with n record reads: the only read-only transaction on observations before the commit.
    const snapshots = saved.before.filter((tx) => tx.mode === 'readonly' && tx.stores.includes('observations'));
    expect(snapshots).toHaveLength(1);
    expect(on(snapshots[0]!.requests, 'observations').map((r) => r.method)).toEqual(Array.from({ length: n }, () => 'get'));
    // One read-write commit with n checks (reads of the keys) and n writes.
    expect(saved.commit.requests.filter((r) => r.store === 'observations').map((r) => r.method)).toEqual([
      ...Array.from({ length: n }, () => 'get'),
      ...Array.from({ length: n }, () => 'put'),
    ]);
    // The same post-save assembly requests as a Trade Action save: nothing differs but the transaction ids.
    expect(saved.after.flatMap((tx) => tx.all)).toEqual(parts(action.requests).after.flatMap((tx) => tx.all));
    // And no recovery or gap scan in it: no cursor, no per-Instrument date index, no write.
    const assembled = saved.after.flatMap((tx) => tx.all);
    expect(assembled.filter((r) => r.on === 'cursor' || r.index === 'byInstrumentDate')).toEqual([]);
    expect(saved.after.filter((tx) => tx.mode === 'readwrite')).toEqual([]);
  });
});
