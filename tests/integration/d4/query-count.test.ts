// T4.31 query-count proof (AC-PERF-001, A47): the Open page and the Review `open` issue a number of
// IndexedDB requests that depends on the number of Instruments (and Missing Instruments), never on
// how many sessions of Marks each Instrument has. The real facade from createApplication on
// fake-indexeddb and NodeTestHost, with fake-indexeddb wrapped in the disclosed request counter
// (D2 section 6.0), which logs requests and changes no behavior.
import { describe, expect, it } from 'vitest';
import { createApplication, type Application } from '../../../src/app/compose.ts';
import { nyseSessionPolicy } from '../../../src/domain/session-policy/index.ts';
import { fixedClock } from '../../../src/domain/time/index.ts';
import { device, planCommand } from '../d1/support.ts';
import { TEST_CAPACITY } from '../../support/stack.ts';
import { countRequests, type CountedRequest } from '../../support/request-counter.ts';

// 2028-12-29 is the last session in the policy's coverage; 21:35Z is five minutes after its completion.
const AS_OF = '2028-12-29T21:35:00Z';
const REVIEW_DATE = '2028-12-29';
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

async function setup(sessions: number) {
  const d = await device();
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

  const dates = sessionDates(sessions);
  const first = dates.at(-1)!;
  // Every Trade opens on the first session of the history, so its Position spans all of it.
  const planTime = `${first}T13:30:00Z`;
  const fillTime = `${first}T14:00:00Z`;
  for (const symbol of TRADES) await openLong(app, symbol, planTime, fillTime);

  // Marks written directly (a bulk seed): every session for each Instrument, except the as-of date for the Missing one.
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
  return app;
}

async function openLong(app: Application, symbol: string, planTime: string, fillTime: string) {
  const command = await planCommand(app, { underlying: symbol, economicTime: planTime });
  const confirmed = await app.TradeWorkflows.confirmPlan(command);
  if (confirmed.kind !== 'Confirmed') throw new Error(`plan ${symbol}: ${confirmed.kind}`);
  const tradeId = confirmed.receipt.tradeId;
  const detail = await app.TradeViewsAndReporting.getTradeDetail({ tradeId });
  const definition = await app.Journal.getDefinitions({ latestFor: 'entry-type.position-change-reflection' });
  if (detail.kind !== 'Ready' || definition.kind !== 'Found') throw new Error('detail or definition missing');
  const leg = detail.view.plan.legs[0]!;
  const recorded = await app.TradeWorkflows.recordPositionChange({
    originTradeId: tradeId,
    trades: [{ tradeId, expectedFactRevision: detail.view.factRevision }],
    members: [
      {
        kind: 'Execution',
        tradeId,
        action: 'Buy',
        instrument: leg.instrument,
        intent: { kind: 'ServesPlannedLeg', plannedLegId: leg.factId },
        quantity: '100',
        price: '50.10',
        fee: '0.65',
        economicTime: fillTime,
      },
    ],
    reflection: { kind: 'Decline', definitionId: definition.definition.id },
  });
  if (recorded.kind !== 'Recorded') throw new Error(`open ${symbol}: ${JSON.stringify(recorded)}`);
}

const on = (requests: readonly CountedRequest[], ...stores: string[]) => requests.filter((r) => stores.includes(r.store));

async function measure(sessions: number) {
  const app = await setup(sessions);
  const page = await countRequests(() => app.TradeViewsAndReporting.browseTrades({ lifecycle: 'Open' }));
  if (page.result.kind !== 'Ready') throw new Error(page.result.kind);
  const review = await countRequests(() => app.DailyReview.open({ date: { kind: 'LatestCompleted' }, asOf: AS_OF }));
  if (review.result.kind !== 'Ready') throw new Error(review.result.kind);
  return { page, review };
}

describe('T4.31 query count: the Open page and the Review open', () => {
  it('should issue the same bounded requests whether each Instrument has 100 or 1,255 sessions of history', { timeout: 600_000 }, async () => {
    const small = await measure(100);
    const large = await measure(1_255);

    // The Open page: one getAll on trades, one on observations, one byInstrumentDate request per Missing Instrument.
    expect(small.page.result.kind === 'Ready' && small.page.result.view.items).toHaveLength(TRADES.length);
    const pageReads = on(small.page.requests, 'trades', 'observations');
    expect(pageReads).toEqual([
      { on: 'index', store: 'trades', index: 'byLifecycleActivity', method: 'getAll', count: 201 },
      { on: 'store', store: 'observations', method: 'getAll' },
      ...MISSING.map(() => ({ on: 'index', store: 'observations', index: 'byInstrumentDate', method: 'openCursor' })),
    ]);
    expect(on(large.page.requests, 'trades', 'observations')).toEqual(pageReads);

    
    const instruments = MARKED.length + MISSING.length;
    const reviewReads = on(small.review.requests, 'trades', 'observations', 'journalObligations');
    expect(reviewReads).toEqual([
      { on: 'index', store: 'trades', index: 'byLifecycleActivity', method: 'getAll', count: 201 },
      { on: 'store', store: 'observations', method: 'getAll' },
      ...MISSING.map(() => ({ on: 'index', store: 'observations', index: 'byInstrumentDate', method: 'openCursor' })),
      ...Array.from({ length: instruments }, () => ({ on: 'index', store: 'observations', index: 'byInstrumentDate', method: 'getAll' })),
      { on: 'store', store: 'journalObligations', method: 'getAll' },
    ]);
    expect(on(large.review.requests, 'trades', 'observations', 'journalObligations')).toEqual(reviewReads);
    expect(large.review.requests).toEqual(small.review.requests);

    console.log(`query-count: Open page ${JSON.stringify(pageReads)}`);
    console.log(`query-count: Review open ${JSON.stringify(reviewReads)}`);
  });
});
