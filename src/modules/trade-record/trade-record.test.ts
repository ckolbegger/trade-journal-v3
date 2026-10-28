import { describe, expect, it } from 'vitest';
import { beginSemanticTransaction, NotInSemanticTransaction } from '../../persistence/index.ts';
import { emptyWorkspace, sequentialIds } from '../../../tests/support/workspace.ts';
import { createTradeRecord, type ConfirmPlanChange, type TradeSummary } from './index.ts';

const change: ConfirmPlanChange = {
  kind: 'ConfirmPlan',
  accountId: 'account-1',
  strategyId: 'strategy-1',
  plan: {
    economicTime: '2026-10-12T13:30:00Z',
    underlying: 'XYZ',
    thesis: 'Breakout.',
    invalidation: 'Below 48.',
    legs: [{ side: 'Long', instrument: { kind: 'Stock', symbol: 'XYZ' }, quantity: '100', intendedEntry: '50' }],
    stops: [{ kind: 'UnderlyingPrice', price: '47.5' }],
    targets: [{ kind: 'UnderlyingPrice', price: '56' }],
  },
};

async function tradeRecord() {
  const { persistence } = await emptyWorkspace();
  const ids = sequentialIds('t');
  let drawn = 0;
  const counted = { next: () => (drawn++, ids.next()) };
  return { record: createTradeRecord({ persistence, ids: counted }), persistence, drawn: () => drawn };
}

async function dump(persistence: Awaited<ReturnType<typeof tradeRecord>>['persistence']) {
  return persistence.readSnapshot(['trades', 'meta'], async (tx) => ({ trades: await tx.getAll('trades'), meta: await tx.getAll('meta') }));
}

describe('prepareChange: ConfirmPlan', () => {
  it('should build a candidate Trade with a Plan fact, one Planned Leg fact, and Stop and Target condition facts, each a candidate fact identity holding a single-version list', async () => {
    const { record } = await tradeRecord();
    const prepared = await record.prepareChange(change);
    if (prepared.kind !== 'Prepared') throw new Error('expected Prepared');
    expect(prepared.candidate.facts.map((f) => [f.factId, f.kind, f.versions.length])).toEqual([
      ['candidate:plan', 'Plan', 1],
      ['candidate:leg-1', 'PlannedLeg', 1],
      ['candidate:stop-1', 'Stop', 1],
      ['candidate:target-1', 'Target', 1],
    ]);
    expect(prepared.candidate.tradeId).toBe('candidate:trade');
  });

  it('should assign Recorded Sequence in submitted order and stored lifecycle Planned, and return the candidate AnalysisInput plus a canonical digest', async () => {
    const { record } = await tradeRecord();
    const prepared = await record.prepareChange(change);
    if (prepared.kind !== 'Prepared') throw new Error('expected Prepared');
    expect(prepared.candidate.facts.map((f) => f.recordedSequence)).toEqual([1, 2, 3, 4]);
    expect(prepared.candidate.lifecycle).toBe('Planned');
    expect(prepared.analysisInput).toEqual({
      tradeId: 'candidate:trade',
      factRevision: 1,
      storedLifecycle: 'Planned',
      plan: {
        economicTime: '2026-10-12T13:30:00Z',
        underlying: 'XYZ',
        thesis: 'Breakout.',
        invalidation: 'Below 48.',
        legs: [{ factId: 'candidate:leg-1', side: 'Long', instrument: { kind: 'Stock', symbol: 'XYZ' }, quantity: '100', intendedEntry: '50' }],
        stops: [{ factId: 'candidate:stop-1', kind: 'UnderlyingPrice', price: '47.5' }],
        targets: [{ factId: 'candidate:target-1', kind: 'UnderlyingPrice', price: '56' }],
      },
      positionChanges: [],
    });
    expect(prepared.digest).toMatch(/^[0-9a-f]{64}$/);
    const again = await record.prepareChange(change);
    expect(again.kind === 'Prepared' && again.digest).toBe(prepared.digest);
  });

  it('should write nothing and assign no durable identity', async () => {
    const { record, persistence, drawn } = await tradeRecord();
    const before = await dump(persistence);
    const prepared = await record.prepareChange(change);
    expect(await dump(persistence)).toEqual(before);
    expect(drawn()).toBe(0);
    // A confirmation creates a new Trade, so there is no before-record (Trade Record, prepareChange).
    expect(prepared.kind === 'Prepared' && prepared.before).toBeNull();
  });

  it('should reject a change with no Planned Leg with a typed IncoherentChange', async () => {
    const { record } = await tradeRecord();
    expect(await record.prepareChange({ ...change, plan: { ...change.plan, legs: [] } })).toEqual({
      kind: 'IncoherentChange',
      reason: 'NoPlannedLeg',
    });
  });
});

describe('applyPreparedChange', () => {
  async function prepared() {
    const setup = await tradeRecord();
    const result = await setup.record.prepareChange(change);
    if (result.kind !== 'Prepared') throw new Error('expected Prepared');
    return { ...setup, prepared: result };
  }

  it('should reject a reconciliation whose candidate digest or expected lifecycle does not match the prepared change', async () => {
    const { record, prepared: p } = await prepared();
    const tx = beginSemanticTransaction();
    expect(record.applyPreparedChange(tx, p, { candidateDigest: 'f'.repeat(64), expectedLifecycle: 'Planned', exposureStart: null })).toEqual({
      kind: 'ReconciliationMismatch',
    });
    expect(record.applyPreparedChange(tx, p, { candidateDigest: p.digest, expectedLifecycle: 'Open', exposureStart: null })).toEqual({
      kind: 'ReconciliationMismatch',
    });
    expect(tx.close().writes).toEqual([]);
  });

  it('should assign durable identities, stage the Trade document and its lifecycle-index membership, and return the identity mapping and staged projection', async () => {
    const { record, persistence, prepared: p } = await prepared();
    const tx = beginSemanticTransaction();
    const result = record.applyPreparedChange(tx, p, { candidateDigest: p.digest, expectedLifecycle: 'Planned', exposureStart: null });
    expect(result).toEqual({
      kind: 'Staged',
      mapping: {
        'candidate:trade': 't-0001',
        'candidate:plan': 't-0002',
        'candidate:leg-1': 't-0003',
        'candidate:stop-1': 't-0004',
        'candidate:target-1': 't-0005',
      },
      projection: expect.objectContaining({
        tradeId: 't-0001',
        factRevision: 1,
        storedLifecycle: 'Planned',
        plan: expect.objectContaining({ legs: [expect.objectContaining({ factId: 't-0003' })] }) as unknown,
      }) as unknown,
    });
    expect((await persistence.commit(tx.close())).kind).toBe('Committed');
    const indexed = await persistence.readSnapshot(['trades'], (t) =>
      t.getAllFromIndex('trades', 'byLifecycle', IDBKeyRange.bound(['Planned'], ['Planned', []])),
    );
    expect(indexed.value).toEqual([
      expect.objectContaining({ tradeId: 't-0001', lifecycle: 'Planned', planTime: '2026-10-12T13:30:00Z' }),
    ]);
  });

  it('should refuse to run outside a semantic transaction', async () => {
    const { record, prepared: p, drawn } = await prepared();
    const closed = beginSemanticTransaction();
    closed.close();
    let thrown: unknown;
    try {
      record.applyPreparedChange(closed, p, { candidateDigest: p.digest, expectedLifecycle: 'Planned', exposureStart: null });
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(NotInSemanticTransaction);
    expect(drawn()).toBe(0);
  });
});

// Confirms Plans through prepare, apply, and one commit, as a coordinator would.
async function confirmed(record: Awaited<ReturnType<typeof tradeRecord>>['record'], persistence: Awaited<ReturnType<typeof tradeRecord>>['persistence'], planTime: string) {
  const prepared = await record.prepareChange({ ...change, plan: { ...change.plan, economicTime: planTime } });
  if (prepared.kind !== 'Prepared') throw new Error('expected Prepared');
  const tx = beginSemanticTransaction();
  const staged = record.applyPreparedChange(tx, prepared, { candidateDigest: prepared.digest, expectedLifecycle: 'Planned', exposureStart: null });
  if (staged.kind !== 'Staged') throw new Error('expected Staged');
  await persistence.commit(tx.close());
  return staged.projection.tradeId;
}

describe('getRecord', () => {
  it('should return Summary or AnalysisInput at its FactRevision, and NotFound for an unknown Trade', async () => {
    const { record, persistence } = await tradeRecord();
    const tradeId = await confirmed(record, persistence, '2026-10-12T13:30:00Z');
    expect(await record.getRecord({ tradeId, projection: 'Summary' })).toEqual({
      kind: 'Found',
      factRevision: 1,
      projection: {
        tradeId,
        accountId: 'account-1',
        strategyId: 'strategy-1',
        underlying: 'XYZ',
        lifecycle: 'Planned',
        planTime: '2026-10-12T13:30:00Z',
      },
    });
    const analysis = await record.getRecord({ tradeId, projection: 'AnalysisInput' });
    expect(analysis).toEqual({
      kind: 'Found',
      factRevision: 1,
      projection: expect.objectContaining({ tradeId, storedLifecycle: 'Planned' }) as unknown,
    });
    expect(await record.getRecord({ tradeId: 'no-such-trade', projection: 'Summary' })).toEqual({ kind: 'NotFound' });
  });
});

describe('queryRecords: CurrentState', () => {
  async function three() {
    const setup = await tradeRecord();
    const early = await confirmed(setup.record, setup.persistence, '2026-10-10T13:30:00Z');
    const lateA = await confirmed(setup.record, setup.persistence, '2026-10-12T13:30:00Z');
    const lateB = await confirmed(setup.record, setup.persistence, '2026-10-12T13:30:00Z');
    return { ...setup, early, lateA, lateB };
  }

  it('should select Planned Trades from the lifecycle index, ordered by Plan Time descending then Trade identity', async () => {
    const { record, early, lateA, lateB } = await three();
    const page = await record.queryRecords({ lifecycle: 'Planned', projection: 'Summary' });
    if (page.kind !== 'Page') throw new Error('expected a page');
    expect(page.items.map((i) => (i as TradeSummary).tradeId)).toEqual([lateA, lateB, early]);
  });

  it('should return AnalysisInput for a whole page from one read snapshot', async () => {
    const { record, persistence, early, lateA, lateB } = await three();
    const page = await record.queryRecords({ lifecycle: 'Planned', projection: 'AnalysisInput' });
    if (page.kind !== 'Page') throw new Error('expected a page');
    expect(page.items).toEqual([lateA, lateB, early].map((tradeId) => expect.objectContaining({ tradeId, storedLifecycle: 'Planned', positionChanges: [] }) as unknown));
    const current = await persistence.readSnapshot(['meta'], () => Promise.resolve(null));
    expect(page.binding).toEqual(current.binding);
  });

  it('should reject a cursor with CursorExpired after any Trade commit', async () => {
    const { record, persistence, early, lateA, lateB } = await three();
    const first = await record.queryRecords({ lifecycle: 'Planned', projection: 'Summary', pageSize: 2 });
    if (first.kind !== 'Page' || !first.nextCursor) throw new Error('expected a next page');
    expect(first.items.map((i) => (i as TradeSummary).tradeId)).toEqual([lateA, lateB]);
    const second = await record.queryRecords({ lifecycle: 'Planned', projection: 'Summary', pageSize: 2, cursor: first.nextCursor });
    expect(second.kind === 'Page' && second.items.map((i) => (i as TradeSummary).tradeId)).toEqual([early]);

    await confirmed(record, persistence, '2026-10-11T13:30:00Z');
    expect(await record.queryRecords({ lifecycle: 'Planned', projection: 'Summary', pageSize: 2, cursor: first.nextCursor })).toEqual({
      kind: 'CursorExpired',
    });
  });
});
