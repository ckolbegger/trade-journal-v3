import { IDBIndex as FakeIDBIndex, IDBObjectStore as FakeIDBObjectStore } from 'fake-indexeddb';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TradeAnalysisRecord } from '../../domain/trade-analysis/index.ts';
import { activityDescOf, beginSemanticTransaction, rebuildPrivateState, type Persistence } from '../../persistence/index.ts';
import { emptyWorkspace, sequentialIds } from '../../../tests/support/workspace.ts';
import { createTradeRecord, type ExecutionFactValue, type PositionChangeChange, type TradeDocument, type TradeFact, type TradeRecord, type TradeSummary } from './index.ts';

// D6's Reference Trade T-A (breakdown, section 4): 100 shares of XYZ, PC1 Monday 10:00 60 @ 50.10
// and PC2 11:00 40 @ 50.30, then the exits X1 (Tuesday 10:00, 30 @ 52.00) and X2 (Tuesday 14:00,
// X2a 50 and X2b 20 @ 53.00). Times are UTC for America/New_York.
const PLAN_TIME = '2026-10-12T13:00:00Z';
const CLOSE_REASON = 'catalog:close-reason-target-reached';

function fill(action: 'Buy' | 'Sell', economicTime: string, quantity: string, price: string, fee: string, tradeId = 'trade-1'): ExecutionFactValue {
  return {
    economicTime,
    action,
    instrument: { kind: 'Stock', symbol: 'XYZ' },
    quantity,
    price,
    fee,
    intent: { kind: 'ServesPlannedLeg', plannedLegId: `${tradeId}:leg` },
  };
}

const PC1 = [fill('Buy', '2026-10-12T14:00:00Z', '60', '50.10', '1.00')];
const PC2 = [fill('Buy', '2026-10-12T15:00:00Z', '40', '50.30', '1.00')];
const X1 = [fill('Sell', '2026-10-13T14:00:00Z', '30', '52.00', '0.60')];
const X2 = [fill('Sell', '2026-10-13T18:00:00Z', '50', '53.00', '1.00'), fill('Sell', '2026-10-13T18:00:00Z', '20', '53.00', '0.40')];

// The Trade after the given Position Changes (all opening Buys so far), as earlier commits left it.
function tradeAfter(tradeId: string, positionChanges: readonly (readonly ExecutionFactValue[])[], lifecycle: TradeDocument['lifecycle'] = 'Open'): TradeDocument {
  let sequence = 4;
  const facts = positionChanges.flatMap((executions, i): TradeFact[] => {
    const memberIds = executions.map((_, j) => `${tradeId}:ex-${i + 1}-${j + 1}`);
    return [
      {
        factId: `${tradeId}:pc-${i + 1}`,
        kind: 'PositionChange',
        recordedSequence: ++sequence,
        versions: [
          { versionNumber: 1, value: { economicTime: executions[0]!.economicTime, originTradeId: tradeId, participatingTradeIds: [tradeId], memberIds } },
        ],
      },
      ...executions.map((value, j): TradeFact => ({ factId: memberIds[j]!, kind: 'Execution', recordedSequence: ++sequence, versions: [{ versionNumber: 1, value }] })),
    ];
  });
  return {
    tradeId,
    accountId: 'account-1',
    strategyId: 'strategy-1',
    lifecycle,
    planTime: PLAN_TIME,
    underlying: 'XYZ',
    factRevision: 2 + positionChanges.length,
    recordedSequenceCounter: sequence,
    lastActivity: positionChanges.at(-1)![0]!.economicTime,
    facts: [
      {
        factId: `${tradeId}:plan`,
        kind: 'Plan',
        recordedSequence: 1,
        versions: [{ versionNumber: 1, value: { economicTime: PLAN_TIME, underlying: 'XYZ', thesis: 'Breakout.', invalidation: 'Below 48.' } }],
      },
      {
        factId: `${tradeId}:leg`,
        kind: 'PlannedLeg',
        recordedSequence: 2,
        versions: [{ versionNumber: 1, value: { side: 'Long', instrument: { kind: 'Stock', symbol: 'XYZ' }, quantity: '100', intendedEntry: '50' } }],
      },
      { factId: `${tradeId}:stop`, kind: 'Stop', recordedSequence: 3, versions: [{ versionNumber: 1, value: { kind: 'UnderlyingPrice', price: '47.5' } }] },
      { factId: `${tradeId}:target`, kind: 'Target', recordedSequence: 4, versions: [{ versionNumber: 1, value: { kind: 'UnderlyingPrice', price: '56' } }] },
      ...facts,
    ],
    deviations: [],
  };
}

// Writes stored Trades with the private fields an earlier commit would have left.
async function seed(persistence: Persistence, documents: readonly TradeDocument[]) {
  const stored = (d: TradeDocument) => {
    const opening = d.facts.flatMap((f) => (f.kind === 'Execution' ? [f.versions[0]!.value.economicTime] : [])).sort();
    return { ...d, activityDesc: activityDescOf(d.lastActivity!), exposureStart: opening[0] };
  };
  const result = await persistence.commit({ checks: [], writes: documents.map((d) => ({ op: 'put' as const, store: 'trades' as const, value: stored(d) })) });
  if (result.kind !== 'Committed') throw new Error(result.kind);
}

async function tradeRecord(documents: readonly TradeDocument[]) {
  const { persistence, factory } = await emptyWorkspace();
  await seed(persistence, documents);
  return { record: createTradeRecord({ persistence, ids: sequentialIds('d') }), persistence, factory };
}

function sell(executions: readonly ExecutionFactValue[], expectedFactRevision: number, closeReasonId?: string, tradeId = 'trade-1'): PositionChangeChange {
  return { kind: 'PositionChange', tradeId, expectedFactRevision, executions, ...(closeReasonId && { closeReasonId }) };
}

describe('prepareChange: PositionChange with Sell members', () => {
  it('should build a candidate with the Sell Executions and, for a terminal change, one Close Reason fact naming the Catalog identity and the terminal Position Change, sequenced after the members A85', async () => {
    const { record } = await tradeRecord([tradeAfter('trade-1', [PC1, PC2])]);

    // X2 closes the Trade: the Position Change, then X2a and X2b, then the Close Reason fact.
    const terminal = await record.prepareChange(sell(X2, 4, CLOSE_REASON));
    if (terminal.kind !== 'Prepared') throw new Error(`expected Prepared, got ${terminal.kind}`);
    const added = terminal.candidate.facts.slice(8);
    expect(added.map((f) => [f.factId, f.kind, f.recordedSequence])).toEqual([
      ['candidate:pc-1', 'PositionChange', 9],
      ['candidate:execution-1', 'Execution', 10],
      ['candidate:execution-2', 'Execution', 11],
    ]);
    expect(added.slice(1).map((f) => f.versions[0]!.value)).toEqual(X2);
    expect(terminal.candidate.closeReasonFacts).toEqual([
      {
        factId: 'candidate:close-reason-1',
        kind: 'CloseReason',
        recordedSequence: 12,
        versions: [{ versionNumber: 1, value: { closeReasonId: CLOSE_REASON, terminalPositionChangeId: 'candidate:pc-1' } }],
      },
    ]);
    expect(terminal.candidate.recordedSequenceCounter).toBe(12);
    // The Close Reason fact is not a Position Change or Execution fact.
    expect(terminal.candidate.facts.some((f) => (f.kind as string) === 'CloseReason')).toBe(false);

    // A reducing change names no Close Reason, so it adds no such fact.
    const reducing = await record.prepareChange(sell(X1, 4));
    if (reducing.kind !== 'Prepared') throw new Error(`expected Prepared, got ${reducing.kind}`);
    expect(reducing.candidate.closeReasonFacts ?? []).toEqual([]);
    expect(reducing.candidate.recordedSequenceCounter).toBe(10);
  });
});

// Closes each named Trade with one terminal Sell at the given time through prepare, apply, and one
// commit, as a workflow would.
async function closeTrades(record: TradeRecord, persistence: Persistence, closes: readonly { tradeId: string; time: string; exposureStart?: string }[]) {
  const tx = beginSemanticTransaction();
  for (const { tradeId, time, exposureStart = PC1[0]!.economicTime } of closes) {
    const current = await record.getRecord({ tradeId, projection: 'AnalysisInput' });
    if (current.kind !== 'Found') throw new Error(`unknown Trade ${tradeId}`);
    const prepared = await record.prepareChange(sell([fill('Sell', time, '100', '53.00', '1.00', tradeId)], current.factRevision, CLOSE_REASON, tradeId));
    if (prepared.kind !== 'Prepared') throw new Error(`expected Prepared, got ${prepared.kind}`);
    const staged = record.applyPreparedChange(tx, prepared, { candidateDigest: prepared.digest, expectedLifecycle: 'Closed', deviationActions: [], repairs: [], exposureStart, terminalPositionChangeId: 'candidate:pc-1' });
    if (staged.kind !== 'Staged') throw new Error(`expected Staged, got ${staged.kind}`);
  }
  const committed = await persistence.commit(tx.close());
  if (committed.kind !== 'Committed') throw new Error(committed.kind);
}

const idsOf = (page: Awaited<ReturnType<TradeRecord['queryRecords']>>) => {
  if (page.kind !== 'Page') throw new Error(`expected a page, got ${page.kind}`);
  return page.items.map((item) => (item as TradeSummary).tradeId);
};

const range = (lifecycle: string) => IDBKeyRange.bound([lifecycle], [lifecycle, []]);

describe('applyPreparedChange', () => {
  it('should move lifecycle-index membership from Open to Closed and set terminalTime and its byLifecycleTerminal key in the same staged write when the reconciliation expects Closed, storing no Lot-Match record P23', async () => {
    const { record, persistence } = await tradeRecord([tradeAfter('trade-1', [PC1, PC2])]);
    const read = async () =>
      (
        await persistence.readSnapshot(['trades'], async (t) => ({
          open: await t.getAllFromIndex('trades', 'byLifecycleActivity', range('Open')),
          closed: await t.getAllFromIndex('trades', 'byLifecycleTerminal', range('Closed')),
          stored: await t.get('trades', 'trade-1'),
        }))
      ).value;
    const apply = async (executions: readonly ExecutionFactValue[], expectedLifecycle: 'Open' | 'Closed', closeReasonId?: string) => {
      const current = await record.getRecord({ tradeId: 'trade-1', projection: 'AnalysisInput' });
      if (current.kind !== 'Found') throw new Error('unknown Trade');
      const prepared = await record.prepareChange(sell(executions, current.factRevision, closeReasonId));
      if (prepared.kind !== 'Prepared') throw new Error(`expected Prepared, got ${prepared.kind}`);
      // The private fields never enter a candidate, so they cannot leak into its digest.
      expect(prepared.candidate).not.toHaveProperty('terminalTime');
      expect(prepared.candidate).not.toHaveProperty('terminalDesc');
      const tx = beginSemanticTransaction();
      const staged = record.applyPreparedChange(tx, prepared, { candidateDigest: prepared.digest, deviationActions: [], repairs: [], exposureStart: PC1[0]!.economicTime, ...(expectedLifecycle === 'Closed' ? { expectedLifecycle, terminalPositionChangeId: 'candidate:pc-1' } : { expectedLifecycle }) });
      if (staged.kind !== 'Staged') throw new Error(`expected Staged, got ${staged.kind}`);
      const writes = tx.close();
      expect((await persistence.commit(writes)).kind).toBe('Committed');
      return { staged, writes };
    };

    // X1 reduces the Position: the Trade stays Open and holds no terminal key.
    await apply(X1, 'Open');
    const afterX1 = await read();
    expect(afterX1.open.map((d) => d['tradeId'])).toEqual(['trade-1']);
    expect(afterX1.closed).toEqual([]);
    expect(afterX1.stored).not.toHaveProperty('terminalTime');
    expect(afterX1.stored).not.toHaveProperty('terminalDesc');

    // X2 closes it: one staged write moves the Trade and sets both terminal fields.
    const { staged, writes } = await apply(X2, 'Closed', CLOSE_REASON);
    const afterX2 = await read();
    expect(afterX2.open).toEqual([]);
    expect(afterX2.closed.map((d) => d['tradeId'])).toEqual(['trade-1']);
    // Tuesday 14:00 New York is the terminal change's Economic Time; the key sorts descending.
    expect(afterX2.stored).toEqual(
      expect.objectContaining({
        lifecycle: 'Closed',
        terminalTime: '2026-10-13T18:00:00Z',
        terminalDesc: activityDescOf('2026-10-13T18:00:00Z'),
        closeReasonFacts: [
          expect.objectContaining({
            factId: staged.mapping['candidate:close-reason-1'],
            versions: [{ versionNumber: 1, value: { closeReasonId: CLOSE_REASON, terminalPositionChangeId: staged.mapping['candidate:pc-1'] } }],
          }),
        ],
      }),
    );
    expect(staged.mapping['candidate:close-reason-1']).toMatch(/^d-/);
    // The write touches only the Trade store and the Trade-section record: no Lot Match is stored.
    // The Trade put, its two vacated index keys (T6.25-B2) and the section record: the vacates are on the Trade store.
    expect([...new Set(writes.writes.map((w) => w.store))].sort()).toEqual(['meta', 'trades']);
    expect(Object.keys(afterX2.stored!).filter((key) => /lot|match/i.test(key))).toEqual([]);
  });

  it('should return ReconciliationMismatch when the reconciliation expects Open but the candidate adds a Close Reason fact', async () => {
    const { record } = await tradeRecord([tradeAfter('trade-1', [PC1, PC2])]);
    const prepared = await record.prepareChange(sell(X2, 4, CLOSE_REASON));
    if (prepared.kind !== 'Prepared') throw new Error(`expected Prepared, got ${prepared.kind}`);
    const tx = beginSemanticTransaction();

    const result = record.applyPreparedChange(tx, prepared, { candidateDigest: prepared.digest, expectedLifecycle: 'Open', deviationActions: [], repairs: [], exposureStart: PC1[0]!.economicTime });

    expect(result.kind).toBe('ReconciliationMismatch');
    expect(tx.close().writes).toEqual([]);
  });
});

describe('queryRecords: CurrentState Closed', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should select Closed Trades by Terminal Time descending then Trade identity, reading each page of 50 with one getAll on byLifecycleTerminal', async () => {
    // 55 Trades closed at 40 distinct minutes, so the later ones tie on Terminal Time. Plan Time and
    // Trade identity alone would give a different order.
    const closes = Array.from({ length: 55 }, (_, i) => ({
      tradeId: `trade-${String(i).padStart(3, '0')}`,
      time: `2026-10-13T18:${String((i * 7) % 40).padStart(2, '0')}:00Z`,
    }));
    const open = 'trade-open';
    const { record, persistence } = await tradeRecord([...closes.map((c) => tradeAfter(c.tradeId, [PC1, PC2])), tradeAfter(open, [PC1, PC2])]);
    await closeTrades(record, persistence, closes);
    const expected = [...closes].sort((a, b) => (a.time !== b.time ? (a.time < b.time ? 1 : -1) : a.tradeId < b.tradeId ? -1 : 1)).map((c) => c.tradeId);

    const indexGetAll = vi.spyOn(FakeIDBIndex.prototype, 'getAll');
    const otherReads = [
      vi.spyOn(FakeIDBIndex.prototype, 'get'),
      vi.spyOn(FakeIDBIndex.prototype, 'openCursor'),
      vi.spyOn(FakeIDBObjectStore.prototype, 'getAll'),
      vi.spyOn(FakeIDBObjectStore.prototype, 'openCursor'),
    ];
    const first = await record.queryRecords({ lifecycle: 'Closed', projection: 'Summary' });
    expect(indexGetAll).toHaveBeenCalledTimes(1);
    expect(indexGetAll.mock.contexts.map((index) => (index as IDBIndex).name)).toEqual(['byLifecycleTerminal']);
    for (const spy of otherReads) expect(spy).not.toHaveBeenCalled();
    if (first.kind !== 'Page' || !first.nextCursor) throw new Error('expected a first page with a cursor');
    expect(idsOf(first)).toEqual(expected.slice(0, 50));

    indexGetAll.mockClear();
    const second = await record.queryRecords({ lifecycle: 'Closed', projection: 'Summary', cursor: first.nextCursor });
    expect(indexGetAll).toHaveBeenCalledTimes(1);
    expect(indexGetAll.mock.contexts.map((index) => (index as IDBIndex).name)).toEqual(['byLifecycleTerminal']);
    expect(idsOf(second)).toEqual(expected.slice(50));
    expect(second.kind === 'Page' && second.nextCursor).toBeUndefined();
  });

  it('should read at most 50 Closed Trades per page even when a larger page size is requested', async () => {
    const closes = Array.from({ length: 55 }, (_, i) => ({ tradeId: `trade-${String(i).padStart(3, '0')}`, time: `2026-10-13T18:${String(i).padStart(2, '0')}:00Z` }));
    const { record, persistence } = await tradeRecord(closes.map((c) => tradeAfter(c.tradeId, [PC1, PC2])));
    await closeTrades(record, persistence, closes);

    const page = await record.queryRecords({ lifecycle: 'Closed', projection: 'Summary', pageSize: 500 });
    if (page.kind !== 'Page') throw new Error(`expected a page, got ${page.kind}`);
    expect(page.items).toHaveLength(50);
    expect(page.nextCursor).toBeDefined();
  });
});

describe('queryRecords: StateAtEconomicCutoff Open, extended (A88)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Tuesday 08:00 New York; every Trade below was exposed on Monday unless noted.
  const cutoff = '2026-10-13T12:00:00Z';

  async function fixture() {
    const late = [fill('Buy', '2026-10-13T13:00:00Z', '100', '50.10', '1.00', 'trade-late')];
    const { record, persistence } = await tradeRecord([
      ...['trade-open', 'trade-after', 'trade-at', 'trade-before'].map((tradeId) => tradeAfter(tradeId, [PC1, PC2])),
      tradeAfter('trade-late', [late]),
      tradeAfter('trade-planned', [PC1, PC2], 'Planned'),
    ]);
    await closeTrades(record, persistence, [
      { tradeId: 'trade-after', time: '2026-10-13T18:00:00Z' },
      { tradeId: 'trade-at', time: cutoff },
      { tradeId: 'trade-before', time: '2026-10-13T11:00:00Z' },
      // Exposed only after the cutoff, so closing later does not make it eligible either.
      { tradeId: 'trade-late', time: '2026-10-13T18:30:00Z', exposureStart: late[0]!.economicTime },
    ]);
    return { record, persistence };
  }

  it('should also return a Trade that is now Closed when its exposure started at or before the cutoff and its terminal time is after it, and exclude one that closed at or before the cutoff, adding one getAll on byLifecycleTerminal', async () => {
    const { record } = await fixture();
    const indexGetAll = vi.spyOn(FakeIDBIndex.prototype, 'getAll');

    const page = await record.queryRecords({ lifecycle: 'Open', projection: 'Summary', cutoff });
    // The open Trade last traded at 11:00 Monday; the Trade closed after the cutoff at 14:00.
    expect(idsOf(page)).toEqual(['trade-after', 'trade-open']);
    expect(indexGetAll.mock.contexts.map((index) => (index as IDBIndex).name)).toEqual(['byLifecycleActivity', 'byLifecycleTerminal']);
    // The extra read covers only terminal times strictly after the cutoff.
    const extra = indexGetAll.mock.calls[1]![0] as IDBKeyRange;
    expect(extra.upper).toEqual(['Closed', activityDescOf(cutoff)]);
    expect(extra.upperOpen).toBe(true);

    // The Closed Trade's AnalysisInput carries its facts, as Review derives at the cutoff.
    const analysis = await record.queryRecords({ lifecycle: 'Open', projection: 'AnalysisInput', cutoff });
    if (analysis.kind !== 'Page') throw new Error(`expected a page, got ${analysis.kind}`);
    expect(analysis.items.map((item) => (item as { tradeId: string }).tradeId)).toEqual(['trade-after', 'trade-open']);

    // Without a cutoff the query is CurrentState Open: one read, and no Closed Trade.
    indexGetAll.mockClear();
    expect(idsOf(await record.queryRecords({ lifecycle: 'Open', projection: 'Summary' }))).toEqual(['trade-open']);
    expect(indexGetAll).toHaveBeenCalledTimes(1);
  });
});

describe('getRecord', () => {
  it('should return the Close Reason fact and terminalTime in AnalysisInput', async () => {
    const { record, persistence } = await tradeRecord([tradeAfter('trade-1', [PC1, PC2]), tradeAfter('trade-2', [PC1, PC2])]);
    await closeTrades(record, persistence, [{ tradeId: 'trade-1', time: '2026-10-13T18:00:00Z' }]);

    const closed = await record.getRecord({ tradeId: 'trade-1', projection: 'AnalysisInput' });
    if (closed.kind !== 'Found') throw new Error(`expected Found, got ${closed.kind}`);
    const analysis = closed.projection as TradeAnalysisRecord;
    const stored = (await persistence.readSnapshot(['trades'], (t) => t.get('trades', 'trade-1'))).value as unknown as TradeDocument;
    // The Close Reason fact is one flat effective value with its durable identity and sequence, and
    // names the terminal Position Change, which is the last one in the projection.
    expect(analysis.closeReason).toEqual({
      factId: stored.closeReasonFacts![0]!.factId,
      recordedSequence: 11,
      closeReasonId: CLOSE_REASON,
      terminalPositionChangeId: analysis.positionChanges.at(-1)!.factId,
    });
    expect(analysis.terminalTime).toBe('2026-10-13T18:00:00Z');
    expect(analysis.storedLifecycle).toBe('Closed');

    // The Closed list returns the same projection, and an Open Trade has neither.
    const listed = await record.queryRecords({ lifecycle: 'Closed', projection: 'AnalysisInput' });
    if (listed.kind !== 'Page') throw new Error(`expected a page, got ${listed.kind}`);
    expect(listed.items).toEqual([analysis]);
    const open = await record.getRecord({ tradeId: 'trade-2', projection: 'AnalysisInput' });
    expect(open.kind === 'Found' && open.projection).not.toHaveProperty('closeReason');
    expect(open.kind === 'Found' && open.projection).not.toHaveProperty('terminalTime');
  });
});

describe('rebuildPrivateState: Terminal Time of a Closed Trade (T7.30-B1-R3)', () => {
  // X1 at 14:00, then one terminal decision of two Sells at 13:00 and 15:00: its Economic Time is its
  // earliest member's (13:00), earlier than X1's, though its last member is the last fact (D6 A87).
  const STRADDLE = [fill('Sell', '2026-10-13T13:00:00Z', '40', '53.00', '0.80'), fill('Sell', '2026-10-13T15:00:00Z', '30', '53.00', '0.60')];
  const closedStraddling = (tradeId: string) => tradeAfter(tradeId, [PC1, PC2, X1, STRADDLE], 'Closed');
  // A plain close at 13:30, between the straddling change's time and X1's.
  const closedAt1330 = (tradeId: string) => tradeAfter(tradeId, [PC1, PC2, [fill('Sell', '2026-10-13T13:30:00Z', '100', '53.00', '1.00', tradeId)]], 'Closed');

  async function rebuilt(documents: readonly TradeDocument[]) {
    const { record, persistence, factory } = await tradeRecord(documents);
    const trades = () => persistence.readSnapshot(['trades'], (t) => t.getAll('trades'));
    const { binding } = await trades();
    persistence.close();
    await rebuildPrivateState(factory, binding.databaseName);
    return { record, trades: async () => (await trades()).value };
  }

  it('should rebuild a Closed Trade terminalTime and its byLifecycleTerminal key from the Position Change holding the last fact, not the latest Economic Time', async () => {
    const { trades } = await rebuilt([closedStraddling('trade-a')]);
    const [stored] = await trades();
    expect(stored!['terminalTime']).toBe('2026-10-13T13:00:00Z');
    expect(stored!['terminalDesc']).toBe(activityDescOf('2026-10-13T13:00:00Z'));
  });

  it('should list Closed Trades by the rebuilt Terminal Time of the change holding the last fact', async () => {
    // The straddling Trade closed at 13:00 by its terminal change, so the 13:30 close is the later one.
    const { record } = await rebuilt([closedStraddling('trade-a'), closedAt1330('trade-b')]);
    expect(idsOf(await record.queryRecords({ lifecycle: 'Closed', projection: 'Summary' }))).toEqual(['trade-b', 'trade-a']);
  });
});
