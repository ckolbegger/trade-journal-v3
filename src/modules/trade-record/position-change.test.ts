import { IDBIndex as FakeIDBIndex, IDBObjectStore as FakeIDBObjectStore } from 'fake-indexeddb';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DeviationAction, DeviationFingerprint, IntegrityFinding, RecordedDeviation, TradeAnalysisRecord } from '../../domain/trade-analysis/index.ts';
import { Rational } from '../../domain/values/index.ts';
import { beginSemanticTransaction, NotInSemanticTransaction, rebuildPrivateState, type Persistence } from '../../persistence/index.ts';
import { emptyWorkspace, sequentialIds } from '../../../tests/support/workspace.ts';
import { createTradeRecord, type ExecutionFactValue, type TradeRecord, type TradeSummary, type PositionChangeChange, type TradeDocument, type TradeFact } from './index.ts';

// D2's reference Trade (breakdown, section 4): 100 shares, entry 50, Stop 47.50, Target 56,
// confirmed 2026-10-12 09:00 America/New_York.
const PLAN_TIME = '2026-10-12T13:00:00Z';

function plannedDocument(tradeId = 'trade-1'): TradeDocument {
  return {
    tradeId,
    accountId: 'account-1',
    strategyId: 'strategy-1',
    lifecycle: 'Planned',
    planTime: PLAN_TIME,
    underlying: 'XYZ',
    factRevision: 1,
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
    ],
  };
}

// The reference Trade after PC1, as an earlier commit stored it.
function openDocument(tradeId = 'trade-1'): TradeDocument {
  const planned = plannedDocument(tradeId);
  return {
    ...planned,
    lifecycle: 'Open',
    factRevision: 2,
    recordedSequenceCounter: 6,
    lastActivity: '2026-10-12T14:00:00Z',
    facts: [
      ...planned.facts,
      {
        factId: `${tradeId}:pc-1`,
        kind: 'PositionChange',
        recordedSequence: 5,
        versions: [
          {
            versionNumber: 1,
            value: { economicTime: '2026-10-12T14:00:00Z', originTradeId: tradeId, participatingTradeIds: [tradeId], memberIds: [`${tradeId}:ex-1`] },
          },
        ],
      },
      { factId: `${tradeId}:ex-1`, kind: 'Execution', recordedSequence: 6, versions: [{ versionNumber: 1, value: buy('2026-10-12T14:00:00Z', '60', '50.10', tradeId) }] },
    ],
  };
}

// The reference Trade after the given Position Changes, with the recorded Deviation occurrences
// and stored lifecycle an earlier commit left.
function documentWith(
  positionChanges: readonly (readonly ExecutionFactValue[])[],
  deviations: readonly RecordedDeviation[] = [],
  lifecycle: TradeDocument['lifecycle'] = 'Open',
): TradeDocument {
  const planned = plannedDocument();
  let sequence = 4;
  const facts = positionChanges.flatMap((executions, i): TradeFact[] => {
    const memberIds = executions.map((_, j) => `trade-1:ex-${i + 1}-${j + 1}`);
    return [
      {
        factId: `trade-1:pc-${i + 1}`,
        kind: 'PositionChange',
        recordedSequence: ++sequence,
        versions: [
          {
            versionNumber: 1,
            value: { economicTime: executions[0]!.economicTime, originTradeId: 'trade-1', participatingTradeIds: ['trade-1'], memberIds },
          },
        ],
      },
      ...executions.map((value, j): TradeFact => ({ factId: memberIds[j]!, kind: 'Execution', recordedSequence: ++sequence, versions: [{ versionNumber: 1, value }] })),
    ];
  });
  return {
    ...planned,
    lifecycle,
    factRevision: 2 + positionChanges.length,
    recordedSequenceCounter: sequence,
    lastActivity: positionChanges.at(-1)![0]!.economicTime,
    facts: [...planned.facts, ...facts],
    deviations,
  };
}

const fingerprint = (positionChangeId: string): DeviationFingerprint => ({ tradeId: 'trade-1', plannedLegId: 'trade-1:leg', positionChangeId });

function occurrence(occurrenceId: string, positionChangeId: string, quantityAbovePlan: string, economicTime: string): RecordedDeviation {
  return {
    occurrenceId,
    versions: [
      {
        fingerprint: fingerprint(positionChangeId),
        type: 'EntrySize',
        form: 'Excess',
        quantityAbovePlan,
        causingPositionChangeId: positionChangeId,
        economicTime,
        status: 'Active',
      },
    ],
  };
}

function expected(positionChangeId: string, quantityAbovePlan: bigint, economicTime: string) {
  return {
    fingerprint: fingerprint(positionChangeId),
    type: 'EntrySize' as const,
    form: 'Excess' as const,
    quantityAbovePlan: Rational.of(quantityAbovePlan),
    causingPositionChangeId: positionChangeId,
    economicTime,
  };
}

function buy(economicTime: string, quantity: string, price: string, tradeId = 'trade-1', fee = '1.00'): ExecutionFactValue {
  return {
    economicTime,
    action: 'Buy',
    instrument: { kind: 'Stock', symbol: 'XYZ' },
    quantity,
    price,
    fee,
    intent: { kind: 'ServesPlannedLeg', plannedLegId: `${tradeId}:leg` },
  };
}

// PC1 10:00 60 @ 50.10; PC2 11:00 40 @ 50.30; PC3 14:00 20 @ 51.00 (America/New_York).
const PC1 = [buy('2026-10-12T14:00:00Z', '60', '50.10')];
const PC2 = [buy('2026-10-12T15:00:00Z', '40', '50.30')];
const PC3 = [buy('2026-10-12T18:00:00Z', '20', '51.00')];

function change(executions: readonly ExecutionFactValue[], expectedFactRevision = 1, tradeId = 'trade-1'): PositionChangeChange {
  return { kind: 'PositionChange', tradeId, expectedFactRevision, executions };
}

// Writes stored Trade documents directly, as earlier commits would have left them.
async function seed(persistence: Persistence, documents: readonly TradeDocument[]) {
  const result = await persistence.commit({
    checks: [],
    writes: documents.map((d) => ({ op: 'put' as const, store: 'trades' as const, value: { ...d } })),
  });
  if (result.kind !== 'Committed') throw new Error(result.kind);
}

async function tradeRecord(documents: readonly TradeDocument[] = [plannedDocument()]) {
  const { persistence, factory } = await emptyWorkspace();
  await seed(persistence, documents);
  const ids = sequentialIds('d');
  let drawn = 0;
  const counted = { next: () => (drawn++, ids.next()) };
  return { record: createTradeRecord({ persistence, ids: counted }), persistence, factory, drawn: () => drawn };
}

describe('prepareChange: PositionChange', () => {
  it('should build a candidate with one Position Change fact and its Execution facts, each a candidate fact identity holding a single-version list, plus Planned-Leg intent per Execution', async () => {
    const { record } = await tradeRecord();
    const executions = [buy('2026-10-12T14:00:00Z', '60', '50.10'), buy('2026-10-12T14:05:00Z', '40', '50.30')];
    const prepared = await record.prepareChange(change(executions));
    if (prepared.kind !== 'Prepared') throw new Error(`expected Prepared, got ${prepared.kind}`);
    const added = prepared.candidate.facts.slice(4);
    expect(added.map((f) => [f.factId, f.kind, f.versions.length])).toEqual([
      ['candidate:pc-1', 'PositionChange', 1],
      ['candidate:execution-1', 'Execution', 1],
      ['candidate:execution-2', 'Execution', 1],
    ]);
    expect(added[0]!.versions[0]!.value).toEqual({
      economicTime: '2026-10-12T14:00:00Z',
      originTradeId: 'trade-1',
      participatingTradeIds: ['trade-1'],
      memberIds: ['candidate:execution-1', 'candidate:execution-2'],
    });
    expect(added.slice(1).map((f) => f.versions[0]!.value)).toEqual(executions);
    expect(added.slice(1).map((f) => (f.versions[0]!.value as ExecutionFactValue).intent)).toEqual([
      { kind: 'ServesPlannedLeg', plannedLegId: 'trade-1:leg' },
      { kind: 'ServesPlannedLeg', plannedLegId: 'trade-1:leg' },
    ]);
    expect(prepared.candidate.tradeId).toBe('trade-1');
    expect(prepared.candidate.facts.slice(0, 4)).toEqual(plannedDocument().facts);
  });
});

describe('prepareChange: PositionChange, sequences', () => {
  it('should assign Recorded Sequences from the Trade counter, the Position Change first and then members in submitted order, and set Last Activity to the latest Economic Time', async () => {
    const { record } = await tradeRecord([openDocument()]);
    // Submitted out of time order: the Position Change takes its earliest member's time, 14:30.
    const later = await record.prepareChange(change([buy('2026-10-12T15:00:00Z', '30', '50.30'), buy('2026-10-12T14:30:00Z', '10', '50.20')], 2));
    if (later.kind !== 'Prepared') throw new Error(`expected Prepared, got ${later.kind}`);
    expect(later.candidate.facts.slice(6).map((f) => [f.factId, f.recordedSequence])).toEqual([
      ['candidate:pc-1', 7],
      ['candidate:execution-1', 8],
      ['candidate:execution-2', 9],
    ]);
    expect(later.candidate.recordedSequenceCounter).toBe(9);
    expect(later.candidate.lastActivity).toBe('2026-10-12T14:30:00Z');

    // An earlier-dated Position Change leaves Last Activity at the latest one (P5).
    const earlier = await record.prepareChange(change([buy('2026-10-12T13:30:00Z', '10', '50.00')], 2));
    expect(earlier.kind === 'Prepared' && earlier.candidate.lastActivity).toBe('2026-10-12T14:00:00Z');

    // A Trade stored before the counter existed continues after its highest Recorded Sequence.
    const { record: planned } = await tradeRecord();
    const first = await planned.prepareChange(change(PC1));
    if (first.kind !== 'Prepared') throw new Error(`expected Prepared, got ${first.kind}`);
    expect(first.candidate.facts.slice(4).map((f) => f.recordedSequence)).toEqual([5, 6]);
    expect(first.candidate.lastActivity).toBe('2026-10-12T14:00:00Z');
  });
});

describe('prepareChange: PositionChange, no write', () => {
  it('should return before and candidate AnalysisInput with a canonical digest, write nothing, and reserve no identity', async () => {
    const { record, persistence, drawn } = await tradeRecord([openDocument()]);
    const dump = () => persistence.readSnapshot(['trades', 'meta'], async (tx) => ({ trades: await tx.getAll('trades'), meta: await tx.getAll('meta') }));
    const stored = await dump();
    const prepared = await record.prepareChange(change(PC2, 2));
    if (prepared.kind !== 'Prepared') throw new Error(`expected Prepared, got ${prepared.kind}`);
    const pc1 = {
      factId: 'trade-1:pc-1',
      economicTime: '2026-10-12T14:00:00Z',
      recordedSequence: 5,
      executions: [{ factId: 'trade-1:ex-1', recordedSequence: 6, ...PC1[0]! }],
    };
    expect(prepared.beforeAnalysisInput).toEqual({
      tradeId: 'trade-1',
      factRevision: 2,
      storedLifecycle: 'Open',
      plan: {
        economicTime: PLAN_TIME,
        underlying: 'XYZ',
        thesis: 'Breakout.',
        invalidation: 'Below 48.',
        legs: [{ factId: 'trade-1:leg', side: 'Long', instrument: { kind: 'Stock', symbol: 'XYZ' }, quantity: '100', intendedEntry: '50' }],
        stops: [{ factId: 'trade-1:stop', kind: 'UnderlyingPrice', price: '47.5' }],
        targets: [{ factId: 'trade-1:target', kind: 'UnderlyingPrice', price: '56' }],
      },
      positionChanges: [pc1],
    });
    // The candidate keeps the stored lifecycle and recorded Deviations until it is applied.
    expect(prepared.analysisInput).toEqual({
      ...prepared.beforeAnalysisInput,
      factRevision: 3,
      positionChanges: [
        pc1,
        {
          factId: 'candidate:pc-1',
          economicTime: '2026-10-12T15:00:00Z',
          recordedSequence: 7,
          executions: [{ factId: 'candidate:execution-1', recordedSequence: 8, ...PC2[0]! }],
        },
      ],
    });
    expect(prepared.digest).toMatch(/^[0-9a-f]{64}$/);
    const again = await record.prepareChange(change(PC2, 2));
    expect(again.kind === 'Prepared' && again.digest).toBe(prepared.digest);
    const other = await record.prepareChange(change(PC3, 2));
    expect(other.kind === 'Prepared' && other.digest).not.toBe(prepared.digest);
    expect(await dump()).toEqual(stored);
    expect(drawn()).toBe(0);
  });
});

describe('prepareChange: PositionChange, rejections', () => {
  it('should return Conflict naming the Trade when the expected FactRevision is stale', async () => {
    const { record, drawn } = await tradeRecord([openDocument()]);
    expect(await record.prepareChange(change(PC2, 1))).toEqual({ kind: 'Conflict', tradeId: 'trade-1' });
    expect(drawn()).toBe(0);
  });

  it('should return NotFound for an unknown Trade', async () => {
    const { record } = await tradeRecord();
    expect(await record.prepareChange(change(PC1, 1, 'no-such-trade'))).toEqual({ kind: 'NotFound', tradeId: 'no-such-trade' });
  });
});

describe('applyPreparedChange: PositionChange', () => {
  // PC1, PC2, and PC3 recorded, with PC3's Entry Size occurrence; PC4 adds 10 more at 15:30.
  const PC4 = [buy('2026-10-12T19:30:00Z', '10', '51.20')];
  const pc3Excess = occurrence('occ-1', 'trade-1:pc-3', '20', '2026-10-12T18:00:00Z');

  async function preparedPc4() {
    const setup = await tradeRecord([documentWith([PC1, PC2, PC3], [pc3Excess])]);
    const prepared = await setup.record.prepareChange(change(PC4, 5));
    if (prepared.kind !== 'Prepared') throw new Error(`expected Prepared, got ${prepared.kind}`);
    return { ...setup, prepared };
  }

  const retainPc3: DeviationAction = { kind: 'Retain', occurrenceId: 'occ-1', fingerprint: fingerprint('trade-1:pc-3') };
  const createPc4: DeviationAction = { kind: 'Create', occurrence: expected('candidate:pc-1', 10n, '2026-10-12T19:30:00Z') };

  it('should reject a reconciliation whose digest, expected lifecycle, or Deviation actions do not match the prepared change', async () => {
    const { record, prepared, drawn } = await preparedPc4();
    const valid = { candidateDigest: prepared.digest, expectedLifecycle: 'Open' as const, deviationActions: [retainPc3, createPc4], repairs: [], exposureStart: null };
    const mismatches = [
      { ...valid, candidateDigest: 'f'.repeat(64) },
      { ...valid, expectedLifecycle: 'Planned' as const },
      // The recorded occurrence must be accounted for exactly once.
      { ...valid, deviationActions: [createPc4] },
      { ...valid, deviationActions: [retainPc3, retainPc3, createPc4] },
      // Actions may name only recorded occurrences, and Position Changes and legs of this candidate.
      { ...valid, deviationActions: [retainPc3, createPc4, { ...retainPc3, occurrenceId: 'occ-9' }] },
      { ...valid, deviationActions: [retainPc3, { kind: 'Create' as const, occurrence: expected('trade-1:pc-9', 10n, '2026-10-12T19:30:00Z') }] },
      {
        ...valid,
        deviationActions: [retainPc3, { kind: 'Create' as const, occurrence: { ...expected('candidate:pc-1', 10n, '2026-10-12T19:30:00Z'), fingerprint: { ...fingerprint('candidate:pc-1'), tradeId: 'trade-2' } } }],
      },
    ];
    const tx = beginSemanticTransaction();
    for (const reconciliation of mismatches) {
      expect(record.applyPreparedChange(tx, prepared, reconciliation)).toEqual({ kind: 'ReconciliationMismatch' });
    }
    expect(tx.close()).toEqual({ checks: [], writes: [] });
    expect(drawn()).toBe(0);
  });

  it('should assign durable identities, stage the Trade document, move lifecycle-index membership from Planned to Open, and apply every Deviation action, returning the identity mapping and staged projection', async () => {
    // A Planned Trade's first Position Change moves it from the Planned to the Open index.
    const { record, persistence } = await tradeRecord();
    const prepared = await record.prepareChange(change(PC1));
    if (prepared.kind !== 'Prepared') throw new Error(`expected Prepared, got ${prepared.kind}`);
    const tx = beginSemanticTransaction();
    const staged = record.applyPreparedChange(tx, prepared, { candidateDigest: prepared.digest, expectedLifecycle: 'Open', deviationActions: [], repairs: [], exposureStart: null });
    if (staged.kind !== 'Staged') throw new Error(`expected Staged, got ${staged.kind}`);
    expect(staged.mapping).toEqual({ 'candidate:pc-1': 'd-0001', 'candidate:execution-1': 'd-0002' });
    expect(staged.projection).toEqual({
      ...prepared.analysisInput,
      storedLifecycle: 'Open',
      recordedDeviations: [],
      positionChanges: [
        {
          factId: 'd-0001',
          economicTime: '2026-10-12T14:00:00Z',
          recordedSequence: 5,
          executions: [{ factId: 'd-0002', recordedSequence: 6, ...PC1[0]! }],
        },
      ],
    });
    const writes = tx.close();
    expect((await persistence.commit(writes)).kind).toBe('Committed');
    const { value: indexed } = await persistence.readSnapshot(['trades'], async (t) => ({
      planned: await t.getAllFromIndex('trades', 'byLifecycle', IDBKeyRange.bound(['Planned'], ['Planned', []])),
      open: await t.getAllFromIndex('trades', 'byLifecycleActivity', IDBKeyRange.bound(['Open'], ['Open', []])),
      stored: await t.get('trades', 'trade-1'),
    }));
    expect(indexed.planned).toEqual([]);
    expect(indexed.open.map((d) => d['tradeId'])).toEqual(['trade-1']);
    expect(indexed.stored).toEqual(
      expect.objectContaining({
        lifecycle: 'Open',
        factRevision: 2,
        lastActivity: '2026-10-12T14:00:00Z',
        recordedSequenceCounter: 6,
        facts: [
          ...plannedDocument().facts,
          expect.objectContaining({ factId: 'd-0001', kind: 'PositionChange', versions: [expect.objectContaining({ value: expect.objectContaining({ memberIds: ['d-0002'] }) as unknown })] }),
          expect.objectContaining({ factId: 'd-0002', kind: 'Execution' }),
        ],
      }),
    );
    // The base FactRevision is rechecked at commit: a Trade changed since prepare conflicts.
    expect(await persistence.commit(writes)).toEqual({ kind: 'Conflict', binding: 'trade:trade-1' });

    // Every Deviation action is applied to the recorded occurrences, by occurrence identity.
    const pc2Excess = occurrence('occ-2', 'trade-1:pc-2', '5', '2026-10-12T15:00:00Z');
    const pc1Excess = occurrence('occ-3', 'trade-1:pc-1', '3', '2026-10-12T14:00:00Z');
    const open = await tradeRecord([documentWith([PC1, PC2, PC3], [pc3Excess, pc2Excess, pc1Excess])]);
    const pc4 = await open.record.prepareChange(change(PC4, 5));
    if (pc4.kind !== 'Prepared') throw new Error(`expected Prepared, got ${pc4.kind}`);
    const tx4 = beginSemanticTransaction();
    const actions: DeviationAction[] = [
      retainPc3,
      { kind: 'NewVersion', occurrenceId: 'occ-2', occurrence: expected('trade-1:pc-2', 7n, '2026-10-12T15:00:00Z') },
      { kind: 'Supersede', occurrenceId: 'occ-3', fingerprint: fingerprint('trade-1:pc-1'), reason: 'NoLongerExpected' },
      createPc4,
    ];
    const staged4 = open.record.applyPreparedChange(tx4, pc4, { candidateDigest: pc4.digest, expectedLifecycle: 'Open', deviationActions: actions, repairs: [], exposureStart: null });
    expect(staged4.kind).toBe('Staged');
    expect((await open.persistence.commit(tx4.close())).kind).toBe('Committed');
    const stored = await open.persistence.readSnapshot(['trades'], (t) => t.get('trades', 'trade-1'));
    expect(stored.value?.['deviations']).toEqual([
      pc3Excess,
      { occurrenceId: 'occ-2', versions: [pc2Excess.versions[0], { ...pc2Excess.versions[0], quantityAbovePlan: '7' }] },
      { occurrenceId: 'occ-3', versions: [pc1Excess.versions[0], { ...pc1Excess.versions[0], status: 'Superseded', reason: 'NoLongerExpected' }] },
      occurrence('d-0003', 'd-0001', '10', '2026-10-12T19:30:00Z'),
    ]);
  });

  it('should stage a repair listed in the reconciliation exactly as listed P7', async () => {
    // Stored lifecycle Planned although PC1 is recorded, and an occurrence the facts do not imply.
    const unexpected = occurrence('occ-3', 'trade-1:pc-1', '3', '2026-10-12T14:00:00Z');
    const { record, persistence } = await tradeRecord([documentWith([PC1], [unexpected], 'Planned')]);
    const prepared = await record.prepareChange(change(PC2, 3));
    if (prepared.kind !== 'Prepared') throw new Error(`expected Prepared, got ${prepared.kind}`);
    const repairs: IntegrityFinding[] = [
      { kind: 'LifecycleDisagreement', stored: 'Planned', expected: 'Open' },
      { kind: 'DeviationUnexpected', fingerprint: fingerprint('trade-1:pc-1'), occurrenceId: 'occ-3' },
    ];
    const tx = beginSemanticTransaction();
    const staged = record.applyPreparedChange(tx, prepared, {
      candidateDigest: prepared.digest,
      expectedLifecycle: 'Open',
      deviationActions: [{ kind: 'Supersede', occurrenceId: 'occ-3', fingerprint: fingerprint('trade-1:pc-1'), reason: 'NoLongerExpected' }],
      repairs,
      exposureStart: null,
    });
    if (staged.kind !== 'Staged') throw new Error(`expected Staged, got ${staged.kind}`);
    // The apply result carries the repairs it staged, for the receipt to disclose.
    expect(staged.repairs).toEqual(repairs);
    expect(staged.projection.storedLifecycle).toBe('Open');
    expect((await persistence.commit(tx.close())).kind).toBe('Committed');
    const stored = await persistence.readSnapshot(['trades'], (t) => t.get('trades', 'trade-1'));
    expect(stored.value).toEqual(
      expect.objectContaining({
        lifecycle: 'Open',
        deviations: [{ occurrenceId: 'occ-3', versions: [unexpected.versions[0], { ...unexpected.versions[0], status: 'Superseded', reason: 'NoLongerExpected' }] }],
      }),
    );
  });

  it('should refuse to run outside a semantic transaction', async () => {
    const { record, prepared, drawn } = await preparedPc4();
    const closed = beginSemanticTransaction();
    closed.close();
    expect(() =>
      record.applyPreparedChange(closed, prepared, { candidateDigest: prepared.digest, expectedLifecycle: 'Open', deviationActions: [retainPc3, createPc4], repairs: [], exposureStart: null }),
    ).toThrow(NotInSemanticTransaction);
    expect(drawn()).toBe(0);
  });
});

// Records one Position Change on each named Trade through prepare, apply, and one commit.
async function recordEntries(
  record: TradeRecord,
  persistence: Persistence,
  entries: readonly { tradeId: string; executions: readonly ExecutionFactValue[]; exposureStart?: string }[],
) {
  const tx = beginSemanticTransaction();
  for (const { tradeId, executions, exposureStart } of entries) {
    const current = await record.getRecord({ tradeId, projection: 'AnalysisInput' });
    if (current.kind !== 'Found') throw new Error(`unknown Trade ${tradeId}`);
    const prepared = await record.prepareChange(change(executions, current.factRevision, tradeId));
    if (prepared.kind !== 'Prepared') throw new Error(`expected Prepared, got ${prepared.kind}`);
    const staged = record.applyPreparedChange(tx, prepared, { candidateDigest: prepared.digest, expectedLifecycle: 'Open', deviationActions: [], repairs: [], exposureStart: exposureStart ?? null });
    if (staged.kind !== 'Staged') throw new Error(`expected Staged, got ${staged.kind}`);
  }
  const committed = await persistence.commit(tx.close());
  if (committed.kind !== 'Committed') throw new Error(committed.kind);
}

const ids = (page: Awaited<ReturnType<TradeRecord['queryRecords']>>) => {
  if (page.kind !== 'Page') throw new Error(`expected a page, got ${page.kind}`);
  return page.items.map((item) => (item as TradeSummary).tradeId);
};

describe('queryRecords: CurrentState Open', () => {
  it('should select Open Trades ordered by Last Activity descending then Trade identity', async () => {
    const tradeIds = ['trade-a', 'trade-b', 'trade-c', 'trade-d'];
    const { record, persistence, factory } = await tradeRecord(tradeIds.map(plannedDocument));
    await recordEntries(record, persistence, [
      { tradeId: 'trade-a', executions: [buy('2026-10-12T14:00:00Z', '60', '50.10', 'trade-a')] },
      { tradeId: 'trade-b', executions: [buy('2026-10-12T15:00:00Z', '60', '50.10', 'trade-b')] },
      { tradeId: 'trade-c', executions: [buy('2026-10-12T15:00:00Z', '60', '50.10', 'trade-c')] },
    ]);
    // An earlier-dated entry leaves trade-a's Last Activity at 10:00; trade-d stays Planned.
    await recordEntries(record, persistence, [{ tradeId: 'trade-a', executions: [buy('2026-10-12T13:30:00Z', '10', '50.00', 'trade-a')] }]);
    expect(ids(await record.queryRecords({ lifecycle: 'Open', projection: 'Summary' }))).toEqual(['trade-b', 'trade-c', 'trade-a']);

    // The sort key is private: rebuilding private state recomputes it from Last Activity alone.
    const read = () => persistence.readSnapshot(['trades'], (t) => t.getAll('trades'));
    const before = await read();
    await persistence.commit({
      checks: [],
      writes: before.value.map((stored) => {
        const value = { ...stored };
        delete value['activityDesc'];
        return { op: 'put' as const, store: 'trades' as const, value };
      }),
    });
    expect(ids(await record.queryRecords({ lifecycle: 'Open', projection: 'Summary' }))).toEqual([]);
    persistence.close();
    await rebuildPrivateState(factory, before.binding.databaseName);
    expect(ids(await record.queryRecords({ lifecycle: 'Open', projection: 'Summary' }))).toEqual(['trade-b', 'trade-c', 'trade-a']);
    expect((await read()).value.map((t) => t['activityDesc'])).toEqual(before.value.map((t) => t['activityDesc']));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function threeOpen() {
    const setup = await tradeRecord(['trade-a', 'trade-b', 'trade-c', 'trade-d'].map(plannedDocument));
    await recordEntries(setup.record, setup.persistence, [
      { tradeId: 'trade-a', executions: [buy('2026-10-12T14:00:00Z', '60', '50.10', 'trade-a')] },
      { tradeId: 'trade-b', executions: [buy('2026-10-12T16:00:00Z', '100', '50.10', 'trade-b')] },
      { tradeId: 'trade-c', executions: [buy('2026-10-12T15:00:00Z', '40', '50.10', 'trade-c')] },
    ]);
    return setup;
  }

  it('should read each page with exactly one index getAll request, returning Summary or AnalysisInput for the whole page from one read snapshot', async () => {
    const { record, persistence } = await threeOpen();
    const indexGetAll = vi.spyOn(FakeIDBIndex.prototype, 'getAll');
    const otherReads = [
      vi.spyOn(FakeIDBIndex.prototype, 'get'),
      vi.spyOn(FakeIDBIndex.prototype, 'openCursor'),
      vi.spyOn(FakeIDBObjectStore.prototype, 'getAll'),
      vi.spyOn(FakeIDBObjectStore.prototype, 'openCursor'),
    ];
    const storeGet = vi.spyOn(FakeIDBObjectStore.prototype, 'get');

    const summaries = await record.queryRecords({ lifecycle: 'Open', projection: 'Summary' });
    expect(indexGetAll).toHaveBeenCalledTimes(1);
    // No per-Trade loads: the only other reads are the snapshot's own meta records.
    expect(storeGet.mock.contexts.map((store) => (store as IDBObjectStore).name)).toEqual(storeGet.mock.calls.map(() => 'meta'));
    for (const spy of otherReads) expect(spy).not.toHaveBeenCalled();
    if (summaries.kind !== 'Page') throw new Error(`expected a page, got ${summaries.kind}`);
    expect(summaries.items).toEqual(
      [
        ['trade-b', '2026-10-12T16:00:00Z'],
        ['trade-c', '2026-10-12T15:00:00Z'],
        ['trade-a', '2026-10-12T14:00:00Z'],
      ].map(([tradeId, lastActivity]) => ({
        tradeId,
        accountId: 'account-1',
        strategyId: 'strategy-1',
        underlying: 'XYZ',
        lifecycle: 'Open',
        planTime: PLAN_TIME,
        lastActivity,
      })),
    );

    indexGetAll.mockClear();
    const analysis = await record.queryRecords({ lifecycle: 'Open', projection: 'AnalysisInput' });
    expect(indexGetAll).toHaveBeenCalledTimes(1);
    if (analysis.kind !== 'Page') throw new Error(`expected a page, got ${analysis.kind}`);
    vi.restoreAllMocks();
    const each = await Promise.all(['trade-b', 'trade-c', 'trade-a'].map((tradeId) => record.getRecord({ tradeId, projection: 'AnalysisInput' })));
    expect(analysis.items).toEqual(each.map((r) => r.kind === 'Found' && r.projection));
    const current = await persistence.readSnapshot(['meta'], () => Promise.resolve(null));
    expect(summaries.binding).toEqual(current.binding);
    expect(analysis.binding).toEqual(current.binding);
  });

  it('should return pages of up to 200 with a cursor that fails with CursorExpired after any Trade commit', async () => {
    const tradeIds = Array.from({ length: 205 }, (_, i) => `trade-${String(i).padStart(3, '0')}`);
    const { record, persistence } = await tradeRecord(tradeIds.map(plannedDocument));
    // trade-000 has the earliest Last Activity, so the list runs from trade-204 down.
    const minutes = (i: number) => `2026-10-12T${String(14 + Math.floor(i / 60)).padStart(2, '0')}:${String(i % 60).padStart(2, '0')}:00Z`;
    await recordEntries(
      record,
      persistence,
      tradeIds.map((tradeId, i) => ({ tradeId, executions: [buy(minutes(i), '10', '50.10', tradeId)] })),
    );
    const newestFirst = [...tradeIds].reverse();

    const first = await record.queryRecords({ lifecycle: 'Open', projection: 'Summary' });
    if (first.kind !== 'Page' || !first.nextCursor) throw new Error('expected a first page with a cursor');
    expect(ids(first)).toEqual(newestFirst.slice(0, 200));
    // A larger requested page is still bounded at 200.
    expect(ids(await record.queryRecords({ lifecycle: 'Open', projection: 'Summary', pageSize: 500 }))).toEqual(newestFirst.slice(0, 200));
    const second = await record.queryRecords({ lifecycle: 'Open', projection: 'Summary', cursor: first.nextCursor });
    expect(ids(second)).toEqual(newestFirst.slice(200));
    expect(second.kind === 'Page' && second.nextCursor).toBeUndefined();

    // A commit that touches no Trade leaves the cursor usable.
    const unrelated = await persistence.commit({ checks: [], writes: [{ op: 'put', store: 'journalEntries', value: { id: 'entry-1', obligationKey: 'k-1', anchorTradeId: 'trade-x' } }] });
    expect(unrelated.kind).toBe('Committed');
    expect(ids(await record.queryRecords({ lifecycle: 'Open', projection: 'Summary', cursor: first.nextCursor }))).toEqual(newestFirst.slice(200));

    await recordEntries(record, persistence, [{ tradeId: 'trade-000', executions: [buy('2026-10-12T13:30:00Z', '10', '50.00', 'trade-000')] }]);
    expect(await record.queryRecords({ lifecycle: 'Open', projection: 'Summary', cursor: first.nextCursor })).toEqual({ kind: 'CursorExpired' });
  });
});

describe('getRecord: Position Changes', () => {
  it('should return Position Changes, Executions, and recorded Deviation occurrences with their version lists in AnalysisInput', async () => {
    const pc3Excess = occurrence('occ-1', 'trade-1:pc-3', '20', '2026-10-12T18:00:00Z');
    const superseded = occurrence('occ-2', 'trade-1:pc-2', '5', '2026-10-12T15:00:00Z');
    const withHistory: RecordedDeviation = {
      occurrenceId: 'occ-2',
      versions: [superseded.versions[0]!, { ...superseded.versions[0]!, status: 'Superseded', reason: 'NoLongerExpected' }],
    };
    const { record } = await tradeRecord([documentWith([PC1, PC2, PC3], [pc3Excess, withHistory])]);
    const found = await record.getRecord({ tradeId: 'trade-1', projection: 'AnalysisInput' });
    if (found.kind !== 'Found') throw new Error(`expected Found, got ${found.kind}`);
    expect(found.factRevision).toBe(5);
    const analysis = found.projection as TradeAnalysisRecord;
    expect(analysis.positionChanges).toEqual(
      [PC1, PC2, PC3].map((executions, i) => ({
        factId: `trade-1:pc-${i + 1}`,
        economicTime: executions[0]!.economicTime,
        recordedSequence: 5 + 2 * i,
        executions: [{ factId: `trade-1:ex-${i + 1}-1`, recordedSequence: 6 + 2 * i, ...executions[0]! }],
      })),
    );
    expect(analysis.recordedDeviations).toEqual([pc3Excess, withHistory]);
  });
});

describe('exposure start', () => {
  it('should store exposureStart in the Trade document at each Position Change commit, as supplied by the reconciliation, moving it earlier for an earlier-dated Position Change P5', async () => {
    const { record, persistence } = await tradeRecord();
    const commitChange = async (executions: readonly ExecutionFactValue[], exposureStart: string) => {
      const current = await record.getRecord({ tradeId: 'trade-1', projection: 'AnalysisInput' });
      if (current.kind !== 'Found') throw new Error('unknown Trade');
      const prepared = await record.prepareChange(change(executions, current.factRevision));
      if (prepared.kind !== 'Prepared') throw new Error(`expected Prepared, got ${prepared.kind}`);
      // The private field never enters the candidate, so it cannot leak into the digest or the next write.
      expect(prepared.before).not.toHaveProperty('exposureStart');
      expect(prepared.candidate).not.toHaveProperty('exposureStart');
      const tx = beginSemanticTransaction();
      const staged = record.applyPreparedChange(tx, prepared, { candidateDigest: prepared.digest, expectedLifecycle: 'Open', deviationActions: [], repairs: [], exposureStart });
      if (staged.kind !== 'Staged') throw new Error(`expected Staged, got ${staged.kind}`);
      expect((await persistence.commit(tx.close())).kind).toBe('Committed');
      return (await persistence.readSnapshot(['trades'], (t) => t.get('trades', 'trade-1'))).value!['exposureStart'];
    };
    expect(await commitChange(PC2, '2026-10-12T15:00:00Z')).toBe('2026-10-12T15:00:00Z');
    expect(await commitChange(PC3, '2026-10-12T15:00:00Z')).toBe('2026-10-12T15:00:00Z');
    // An earlier-dated Position Change moves exposure start earlier (P5).
    expect(await commitChange(PC1, '2026-10-12T14:00:00Z')).toBe('2026-10-12T14:00:00Z');
  });
});

describe('queryRecords: StateAtEconomicCutoff Open (A55)', () => {
  it('should return Open Trades whose exposure started at or before the cutoff, excluding an Open Trade whose first fill is after it and every Planned Trade', async () => {
    const tradeIds = ['trade-a', 'trade-b', 'trade-c', 'trade-d'];
    const { record, persistence } = await tradeRecord(tradeIds.map(plannedDocument));
    const at = (tradeId: string, time: string) => ({ tradeId, executions: [buy(time, '10', '50.10', tradeId)], exposureStart: time });
    // trade-a starts exactly at the cutoff, trade-b before it, trade-c after it; trade-d stays Planned.
    await recordEntries(record, persistence, [at('trade-a', '2026-10-12T15:00:00Z'), at('trade-b', '2026-10-12T14:00:00Z'), at('trade-c', '2026-10-12T15:00:01Z')]);
    const cutoff = '2026-10-12T15:00:00Z';
    expect(ids(await record.queryRecords({ lifecycle: 'Open', projection: 'Summary', cutoff }))).toEqual(['trade-a', 'trade-b']);
    // An earlier-dated Position Change moves exposure start before the cutoff and makes trade-c eligible (P5).
    await recordEntries(record, persistence, [at('trade-c', '2026-10-12T13:00:00Z')]);
    expect(ids(await record.queryRecords({ lifecycle: 'Open', projection: 'Summary', cutoff }))).toEqual(['trade-c', 'trade-a', 'trade-b']);
  });

  it('should return CursorExpired when a cursor is reused with a different cutoff or without one', async () => {
    const tradeIds = ['trade-a', 'trade-b', 'trade-c'];
    const { record, persistence } = await tradeRecord(tradeIds.map(plannedDocument));
    const at = (tradeId: string, time: string) => ({ tradeId, executions: [buy(time, '10', '50.10', tradeId)], exposureStart: time });
    await recordEntries(record, persistence, [at('trade-a', '2026-10-12T14:00:00Z'), at('trade-b', '2026-10-12T15:00:00Z'), at('trade-c', '2026-10-12T16:00:00Z')]);
    const cutoff = '2026-10-12T15:00:00Z';
    const base = { lifecycle: 'Open', projection: 'Summary', pageSize: 1 } as const;
    const withCutoff = await record.queryRecords({ ...base, cutoff });
    if (withCutoff.kind !== 'Page' || !withCutoff.nextCursor) throw new Error('expected a first page with a cursor');
    const without = await record.queryRecords(base);
    if (without.kind !== 'Page' || !without.nextCursor) throw new Error('expected a first page with a cursor');
    expect(await record.queryRecords({ ...base, cutoff: '2026-10-12T16:00:00Z', cursor: withCutoff.nextCursor })).toEqual({ kind: 'CursorExpired' });
    expect(await record.queryRecords({ ...base, cursor: withCutoff.nextCursor })).toEqual({ kind: 'CursorExpired' });
    expect(await record.queryRecords({ ...base, cutoff, cursor: without.nextCursor })).toEqual({ kind: 'CursorExpired' });
    // The same cutoff keeps the cursor usable.
    expect((await record.queryRecords({ ...base, cutoff, cursor: withCutoff.nextCursor })).kind).toBe('Page');
  });

  it('should read each page with one lifecycle-index getAll and return AnalysisInput for the page from one read snapshot', async () => {
    const tradeIds = ['trade-a', 'trade-b', 'trade-c'];
    const { record, persistence } = await tradeRecord(tradeIds.map(plannedDocument));
    const at = (tradeId: string, time: string) => ({ tradeId, executions: [buy(time, '10', '50.10', tradeId)], exposureStart: time });
    await recordEntries(record, persistence, [at('trade-a', '2026-10-12T14:00:00Z'), at('trade-b', '2026-10-12T15:00:00Z'), at('trade-c', '2026-10-12T16:00:00Z')]);
    const indexGetAll = vi.spyOn(FakeIDBIndex.prototype, 'getAll');
    const otherReads = [
      vi.spyOn(FakeIDBIndex.prototype, 'get'),
      vi.spyOn(FakeIDBIndex.prototype, 'openCursor'),
      vi.spyOn(FakeIDBObjectStore.prototype, 'getAll'),
      vi.spyOn(FakeIDBObjectStore.prototype, 'openCursor'),
    ];
    const storeGet = vi.spyOn(FakeIDBObjectStore.prototype, 'get');
    const page = await record.queryRecords({ lifecycle: 'Open', projection: 'AnalysisInput', cutoff: '2026-10-12T15:00:00Z' });
    expect(indexGetAll).toHaveBeenCalledTimes(1);
    expect(storeGet.mock.contexts.map((store) => (store as IDBObjectStore).name)).toEqual(storeGet.mock.calls.map(() => 'meta'));
    for (const spy of otherReads) expect(spy).not.toHaveBeenCalled();
    vi.restoreAllMocks();
    if (page.kind !== 'Page') throw new Error(`expected a page, got ${page.kind}`);
    const each = await Promise.all(['trade-b', 'trade-a'].map((tradeId) => record.getRecord({ tradeId, projection: 'AnalysisInput' })));
    expect(page.items).toEqual(each.map((r) => r.kind === 'Found' && r.projection));
    const current = await persistence.readSnapshot(['meta'], () => Promise.resolve(null));
    expect(page.binding).toEqual(current.binding);
  });
});
