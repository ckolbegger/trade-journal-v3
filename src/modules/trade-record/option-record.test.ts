import { describe, expect, it } from 'vitest';
import type { OptionInstrument } from '../../domain/instrument/index.ts';
import { derive, type TradeAnalysisRecord } from '../../domain/trade-analysis/index.ts';
import { activityDescOf, beginSemanticTransaction } from '../../persistence/index.ts';
import { emptyWorkspace, sequentialIds } from '../../../tests/support/workspace.ts';
import { analysisInputOf, createTradeRecord, type ConfirmPlanChange, type ExecutionFactValue, type PositionChangeChange, type TradeDocument } from './index.ts';

// D7's reference option Trades (breakdown, section 1): O-C, a Long Call on XYZ with Exercise Intent
// NotAuthorized, and O-S, a Cash-Secured Put on MNO (plan -2 contracts), whose S1 is Monday 10:00
// New York and whose Expiration E-S settles Friday 2026-11-20 16:00 New York.
const PLAN_TIME = '2026-10-12T13:00:00Z';
const S1_TIME = '2026-10-12T14:00:00Z';
const E_S_TIME = '2026-11-20T21:00:00Z';

const XYZ_CALL: OptionInstrument = { kind: 'Option', symbol: 'XYZ', root: 'XYZ', expiration: '2026-11-20', strike: '55', right: 'Call', multiplier: 100 };
const MNO_PUT: OptionInstrument = { kind: 'Option', symbol: 'MNO', root: 'MNO', expiration: '2026-11-20', strike: '45', right: 'Put', multiplier: 100 };

const confirmOC: ConfirmPlanChange = {
  kind: 'ConfirmPlan',
  accountId: 'account-1',
  strategyId: 'strategy-long-call',
  plan: {
    economicTime: PLAN_TIME,
    underlying: 'XYZ',
    thesis: 'Breakout.',
    invalidation: 'Below 48.',
    exerciseIntent: 'NotAuthorized',
    legs: [{ side: 'Long', instrument: XYZ_CALL, quantity: '2', intendedEntry: '2.00' }],
    stops: [{ kind: 'UnderlyingPrice', price: '48' }],
    targets: [{ kind: 'UnderlyingPrice', price: '60' }],
  },
};

const confirmOS: ConfirmPlanChange = {
  kind: 'ConfirmPlan',
  accountId: 'account-1',
  strategyId: 'strategy-cash-secured-put',
  plan: {
    economicTime: PLAN_TIME,
    underlying: 'MNO',
    thesis: 'Collect premium.',
    invalidation: 'Below 42.',
    legs: [{ side: 'Short', instrument: MNO_PUT, quantity: '-2', intendedEntry: '1.20' }],
    stops: [{ kind: 'UnderlyingPrice', price: '42' }],
    targets: [{ kind: 'UnderlyingPrice', price: '50' }],
  },
};

const S1: ExecutionFactValue = {
  economicTime: S1_TIME,
  action: 'Sell',
  instrument: MNO_PUT,
  quantity: '2',
  price: '1.25',
  fee: '1.30',
  intent: { kind: 'ServesPlannedLeg', plannedLegId: 'trade-1:leg' },
};

// O-S after S1, as an earlier commit stored it.
function openOS(): TradeDocument {
  return {
    tradeId: 'trade-1',
    accountId: 'account-1',
    strategyId: 'strategy-cash-secured-put',
    lifecycle: 'Open',
    planTime: PLAN_TIME,
    underlying: 'MNO',
    factRevision: 2,
    recordedSequenceCounter: 6,
    lastActivity: S1_TIME,
    facts: [
      { factId: 'trade-1:plan', kind: 'Plan', recordedSequence: 1, versions: [{ versionNumber: 1, value: { economicTime: PLAN_TIME, underlying: 'MNO', thesis: 'Collect premium.', invalidation: 'Below 42.' } }] },
      { factId: 'trade-1:leg', kind: 'PlannedLeg', recordedSequence: 2, versions: [{ versionNumber: 1, value: { side: 'Short', instrument: MNO_PUT, quantity: '-2', intendedEntry: '1.20' } }] },
      { factId: 'trade-1:stop', kind: 'Stop', recordedSequence: 3, versions: [{ versionNumber: 1, value: { kind: 'UnderlyingPrice', price: '42' } }] },
      { factId: 'trade-1:target', kind: 'Target', recordedSequence: 4, versions: [{ versionNumber: 1, value: { kind: 'UnderlyingPrice', price: '50' } }] },
      {
        factId: 'trade-1:pc-1',
        kind: 'PositionChange',
        recordedSequence: 5,
        versions: [{ versionNumber: 1, value: { economicTime: S1_TIME, originTradeId: 'trade-1', participatingTradeIds: ['trade-1'], memberIds: ['trade-1:ex-1'] } }],
      },
      { factId: 'trade-1:ex-1', kind: 'Execution', recordedSequence: 6, versions: [{ versionNumber: 1, value: S1 }] },
    ],
    deviations: [],
  };
}

async function tradeRecord(documents: readonly TradeDocument[] = []) {
  const { persistence } = await emptyWorkspace();
  if (documents.length > 0) {
    const result = await persistence.commit({
      checks: [],
      writes: documents.map((d) => ({ op: 'put' as const, store: 'trades' as const, value: { ...d, activityDesc: activityDescOf(d.lastActivity!), exposureStart: S1_TIME } })),
    });
    if (result.kind !== 'Committed') throw new Error(result.kind);
  }
  return { record: createTradeRecord({ persistence, ids: sequentialIds('d') }), persistence };
}

const expire = (quantity = '2', economicTime = E_S_TIME): PositionChangeChange => ({
  kind: 'PositionChange',
  tradeId: 'trade-1',
  expectedFactRevision: 2,
  executions: [],
  expiration: { economicTime, instrument: MNO_PUT, quantity },
});

describe('prepareChange: ConfirmPlan for an option', () => {
  it('should build a candidate with the option Planned Leg, signed contracts, conditions holding only their Underlying triggers, and the Exercise Intent fact', async () => {
    const { record } = await tradeRecord();

    const call = await record.prepareChange(confirmOC);
    if (call.kind !== 'Prepared') throw new Error(`expected Prepared, got ${call.kind}`);
    expect(call.candidate.facts.map((f) => [f.factId, f.kind])).toEqual([
      ['candidate:plan', 'Plan'],
      ['candidate:leg-1', 'PlannedLeg'],
      ['candidate:stop-1', 'Stop'],
      ['candidate:target-1', 'Target'],
    ]);
    const [plan, leg, stop, target] = call.candidate.facts.map((f) => f.versions[0]!.value);
    expect(plan).toEqual(expect.objectContaining({ underlying: 'XYZ', exerciseIntent: 'NotAuthorized' }));
    expect(leg).toEqual({ side: 'Long', instrument: XYZ_CALL, quantity: '2', intendedEntry: '2.00' });
    // A condition holds only its Underlying trigger: no option price, no derived value at expiration.
    expect(stop).toEqual({ kind: 'UnderlyingPrice', price: '48' });
    expect(target).toEqual({ kind: 'UnderlyingPrice', price: '60' });
    expect(call.analysisInput.plan).toEqual(
      expect.objectContaining({
        exerciseIntent: 'NotAuthorized',
        legs: [{ factId: 'candidate:leg-1', side: 'Long', instrument: XYZ_CALL, quantity: '2', intendedEntry: '2.00' }],
        stops: [{ factId: 'candidate:stop-1', kind: 'UnderlyingPrice', price: '48' }],
        targets: [{ factId: 'candidate:target-1', kind: 'UnderlyingPrice', price: '60' }],
      }),
    );

    // The Cash-Secured Put keeps its signed negative contracts and carries no Exercise Intent.
    const put = await record.prepareChange(confirmOS);
    if (put.kind !== 'Prepared') throw new Error(`expected Prepared, got ${put.kind}`);
    expect(put.candidate.facts[1]!.versions[0]!.value).toEqual({ side: 'Short', instrument: MNO_PUT, quantity: '-2', intendedEntry: '1.20' });
    expect(put.candidate.facts[0]!.versions[0]!.value).not.toHaveProperty('exerciseIntent');
    expect(put.analysisInput.plan).not.toHaveProperty('exerciseIntent');
  });
});

describe('prepareChange and applyPreparedChange: Expiration', () => {
  it('should build a candidate Position Change with one Expiration settlement fact identity holding the Instrument, quantity, and settlement time and no price or fee, and on apply move the Trade from Open to Closed with terminalTime equal to the settlement time, storing no Lot-Match record', async () => {
    const { record, persistence } = await tradeRecord([openOS()]);

    const prepared = await record.prepareChange(expire());
    if (prepared.kind !== 'Prepared') throw new Error(`expected Prepared, got ${prepared.kind}`);
    // The Position Change, then its one settlement member, in the Trade's counter order (D2 A20).
    expect(prepared.candidate.facts.slice(6).map((f) => [f.factId, f.kind, f.recordedSequence, f.versions.length])).toEqual([
      ['candidate:pc-1', 'PositionChange', 7, 1],
      ['candidate:expiration-1', 'Expiration', 8, 1],
    ]);
    expect(prepared.candidate.facts[6]!.versions[0]!.value).toEqual({
      economicTime: E_S_TIME,
      originTradeId: 'trade-1',
      participatingTradeIds: ['trade-1'],
      memberIds: ['candidate:expiration-1'],
    });
    const settlement = prepared.candidate.facts[7]!.versions[0]!.value;
    expect(settlement).toEqual({ economicTime: E_S_TIME, instrument: MNO_PUT, quantity: '2' });
    expect(settlement).not.toHaveProperty('price');
    expect(settlement).not.toHaveProperty('fee');
    // An Expiration carries no trader agency, so no Close Reason fact is added (A107).
    expect(prepared.candidate.closeReasonFacts).toBeUndefined();
    expect(prepared.candidate.recordedSequenceCounter).toBe(8);
    expect(prepared.candidate.lastActivity).toBe(E_S_TIME);
    expect(prepared.candidate).not.toHaveProperty('terminalTime');

    const tx = beginSemanticTransaction();
    const staged = record.applyPreparedChange(tx, prepared, { candidateDigest: prepared.digest, expectedLifecycle: 'Closed', terminalPositionChangeId: 'candidate:pc-1', deviationActions: [], repairs: [], exposureStart: S1_TIME });
    if (staged.kind !== 'Staged') throw new Error(`expected Staged, got ${staged.kind}`);
    const writes = tx.close();
    expect((await persistence.commit(writes)).kind).toBe('Committed');

    const range = (lifecycle: string) => IDBKeyRange.bound([lifecycle], [lifecycle, []]);
    const { value } = await persistence.readSnapshot(['trades'], async (t) => ({
      openByActivity: await t.getAllFromIndex('trades', 'byLifecycleActivity', range('Open')),
      openByPlan: await t.getAllFromIndex('trades', 'byLifecycle', range('Open')),
      closedByPlan: await t.getAllFromIndex('trades', 'byLifecycle', range('Closed')),
      closedByTerminal: await t.getAllFromIndex('trades', 'byLifecycleTerminal', range('Closed')),
      stored: await t.get('trades', 'trade-1'),
    }));
    // The Open index entries were vacated, not left behind, and the Closed terminal range holds the Trade.
    expect(value.openByActivity).toEqual([]);
    expect(value.openByPlan).toEqual([]);
    expect(value.closedByPlan.map((d) => d['tradeId'])).toEqual(['trade-1']);
    expect(value.closedByTerminal.map((d) => d['tradeId'])).toEqual(['trade-1']);
    expect(writes.writes.filter((w) => w.op === 'vacateIndexKey').map((w) => (w as { index: string }).index).sort()).toEqual(['byLifecycle', 'byLifecycleActivity']);
    // The settlement time is the Terminal Time, with its descending key.
    expect(value.stored).toEqual(expect.objectContaining({ lifecycle: 'Closed', terminalTime: E_S_TIME, terminalDesc: activityDescOf(E_S_TIME) }));
    expect(Object.keys(value.stored!).filter((key) => /lot|match/i.test(key))).toEqual([]);
    expect([...new Set(writes.writes.map((w) => w.store))].sort()).toEqual(['meta', 'trades']);
    // The member's identity is durable and shared by the Position Change's member list.
    const durable = staged.mapping['candidate:expiration-1']!;
    expect(durable).toMatch(/^d-/);
    expect((value.stored as unknown as TradeDocument).facts.slice(6).map((f) => [f.kind, f.factId])).toEqual([
      ['PositionChange', staged.mapping['candidate:pc-1']],
      ['Expiration', durable],
    ]);
    expect((value.stored as unknown as TradeDocument).facts[6]!.versions[0]!.value).toEqual(expect.objectContaining({ memberIds: [durable] }));
  });
});

describe('getRecord', () => {
  it('should return the option facts and the Expiration member in AnalysisInput', async () => {
    const { record, persistence } = await tradeRecord([openOS()]);
    const prepared = await record.prepareChange(expire());
    if (prepared.kind !== 'Prepared') throw new Error(`expected Prepared, got ${prepared.kind}`);
    const tx = beginSemanticTransaction();
    const staged = record.applyPreparedChange(tx, prepared, { candidateDigest: prepared.digest, expectedLifecycle: 'Closed', terminalPositionChangeId: 'candidate:pc-1', deviationActions: [], repairs: [], exposureStart: S1_TIME });
    if (staged.kind !== 'Staged') throw new Error(`expected Staged, got ${staged.kind}`);
    expect((await persistence.commit(tx.close())).kind).toBe('Committed');

    const found = await record.getRecord({ tradeId: 'trade-1', projection: 'AnalysisInput' });
    if (found.kind !== 'Found') throw new Error('expected Found');
    const input = found.projection as TradeAnalysisRecord;
    expect(input.plan.legs).toEqual([{ factId: 'trade-1:leg', side: 'Short', instrument: MNO_PUT, quantity: '-2', intendedEntry: '1.20' }]);
    expect(input.plan.stops).toEqual([{ factId: 'trade-1:stop', kind: 'UnderlyingPrice', price: '42' }]);
    expect(input.positionChanges.map((pc) => [pc.economicTime, pc.executions.map((e) => e.factId), (pc.settlements ?? []).map((s) => s.quantity)])).toEqual([
      [S1_TIME, ['trade-1:ex-1'], []],
      [E_S_TIME, [], ['2']],
    ]);
    const expiration = input.positionChanges[1]!;
    expect(expiration.factId).toBe(staged.mapping['candidate:pc-1']);
    expect(expiration.settlements).toEqual([
      { factId: staged.mapping['candidate:expiration-1'], economicTime: E_S_TIME, recordedSequence: 8, instrument: MNO_PUT, quantity: '2' },
    ]);
    expect(input.terminalTime).toBe(E_S_TIME);
    expect(input.storedLifecycle).toBe('Closed');
    // Trade Analysis reads the stored record as it is: Closed, with the Expiration as the last fact.
    const derived = derive({ record: input });
    if (derived.kind !== 'Derived') throw new Error(`expected Derived, got ${derived.kind}`);
    expect(derived.expectedLifecycle).toBe('Closed');
  });
});

describe('analysisInputOf: a Position Change naming a missing member', () => {
  it('should refuse to build the analysis input rather than drop the missing member', () => {
    const stored = openOS();
    const document: TradeDocument = {
      ...stored,
      facts: stored.facts.map((fact) =>
        fact.kind === 'PositionChange'
          ? { ...fact, versions: [{ versionNumber: 1, value: { ...fact.versions[0]!.value, memberIds: [...fact.versions[0]!.value.memberIds, 'trade-1:missing'] } }] }
          : fact,
      ),
    };
    expect(() => analysisInputOf(document)).toThrow();
  });
});
