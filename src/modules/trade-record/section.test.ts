import { describe, expect, it } from 'vitest';
import type { ExpectedDeviation, RecordedDeviation } from '../../domain/trade-analysis/index.ts';
import { Rational } from '../../domain/values/index.ts';
import { recordSourceOf } from '../../../tests/support/record-source.ts';
import { validateSection, type ExecutionFactValue, type TradeDocument, type TradeFact } from './index.ts';

// D2's reference Trade (breakdown, section 4): 100 shares, entry 50, Stop 47.50, Target 56,
// confirmed 2026-10-12 09:00 America/New_York.
const PLAN_TIME = '2026-10-12T13:00:00Z';

function buy(tradeId: string, economicTime: string, quantity: string, price: string): ExecutionFactValue {
  return {
    economicTime,
    action: 'Buy',
    instrument: { kind: 'Stock', symbol: 'XYZ' },
    quantity,
    price,
    fee: '1.00',
    intent: { kind: 'ServesPlannedLeg', plannedLegId: `${tradeId}:leg` },
  };
}

// PC1 10:00 60 @ 50.10; PC2 11:00 40 @ 50.30; PC3 14:00 20 @ 51.00 (America/New_York).
const PC1 = (tradeId: string) => [buy(tradeId, '2026-10-12T14:00:00Z', '60', '50.10')];
const PC2 = (tradeId: string) => [buy(tradeId, '2026-10-12T15:00:00Z', '40', '50.30')];
const PC3 = (tradeId: string) => [buy(tradeId, '2026-10-12T18:00:00Z', '20', '51.00')];

// A stored Trade document after the given Position Changes, each fact a single-version list.
function trade(
  tradeId: string,
  positionChanges: readonly (readonly ExecutionFactValue[])[] = [],
  stored: { lifecycle?: TradeDocument['lifecycle']; deviations?: readonly RecordedDeviation[]; accountId?: string } = {},
): TradeDocument {
  const plan: TradeFact[] = [
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
  ];
  let sequence = 4;
  const changes = positionChanges.flatMap((executions, i): TradeFact[] => {
    const memberIds = executions.map((_, j) => `${tradeId}:ex-${i + 1}-${j + 1}`);
    return [
      {
        factId: `${tradeId}:pc-${i + 1}`,
        kind: 'PositionChange',
        recordedSequence: ++sequence,
        versions: [
          {
            versionNumber: 1,
            value: { economicTime: executions[0]!.economicTime, originTradeId: tradeId, participatingTradeIds: [tradeId], memberIds },
          },
        ],
      },
      ...executions.map((value, j): TradeFact => ({ factId: memberIds[j]!, kind: 'Execution', recordedSequence: ++sequence, versions: [{ versionNumber: 1, value }] })),
    ];
  });
  const open = positionChanges.length > 0;
  return {
    tradeId,
    accountId: stored.accountId ?? 'acct-1',
    strategyId: 'strategy-1',
    lifecycle: stored.lifecycle ?? (open ? 'Open' : 'Planned'),
    planTime: PLAN_TIME,
    underlying: 'XYZ',
    factRevision: 1 + positionChanges.length,
    facts: [...plan, ...changes],
    ...(open && {
      recordedSequenceCounter: sequence,
      lastActivity: positionChanges.at(-1)![0]!.economicTime,
      deviations: stored.deviations ?? [],
    }),
  };
}

// The Entry Size (Excess) occurrence PC3 causes on the reference Trade: 20 shares above plan.
function pc3Excess(tradeId: string, quantityAbovePlan = '20'): RecordedDeviation {
  return {
    occurrenceId: `${tradeId}:dev-1`,
    versions: [
      {
        fingerprint: { tradeId, plannedLegId: `${tradeId}:leg`, positionChangeId: `${tradeId}:pc-3` },
        type: 'EntrySize',
        form: 'Excess',
        quantityAbovePlan,
        causingPositionChangeId: `${tradeId}:pc-3`,
        economicTime: '2026-10-12T18:00:00Z',
        status: 'Active',
      },
    ],
  };
}

const references = { accountIds: new Set(['acct-1', 'acct-2']), anchorTradeIds: new Set(['trade-1', 'trade-2', 'trade-3']) };

describe('Trade Record section', () => {
  it('should accept Planned and Open Trades with single-version fact lists', async () => {
    const trades = [
      trade('trade-1'),
      trade('trade-2', [PC1('trade-2')]),
      trade('trade-3', [PC1('trade-3'), PC2('trade-3'), PC3('trade-3')], { deviations: [pc3Excess('trade-3')] }),
    ];

    const result = await validateSection(recordSourceOf({ trades }), references);

    expect(result).toEqual({ issues: [], repairs: [] });
  });

  it('should report a Trade referencing an unknown Account, a fact identity used twice, and an Anchor naming an unknown Trade', async () => {
    const reused = trade('trade-2', [PC1('trade-2')]);
    // trade-3 reuses trade-2's Plan fact identity, in a later batch.
    const planned = trade('trade-3');
    const duplicate: TradeDocument = { ...planned, facts: [{ ...planned.facts[0]!, factId: 'trade-2:plan' }, ...planned.facts.slice(1)] };
    const trades = [trade('trade-1', [], { accountId: 'acct-missing' }), reused, duplicate];

    const result = await validateSection(recordSourceOf({ trades }), {
      accountIds: references.accountIds,
      anchorTradeIds: new Set(['trade-1', 'trade-2', 'trade-3', 'trade-gone']),
    });

    expect(result.issues).toEqual([
      { code: 'UnknownAccount', tradeId: 'trade-1', accountId: 'acct-missing' },
      { code: 'DuplicateFactIdentity', tradeId: 'trade-3', factId: 'trade-2:plan' },
      { code: 'UnknownAnchorTrade', tradeId: 'trade-gone' },
    ]);
    expect(result.repairs).toEqual([]);
  });

  it('should return a repair, not an issue, when stored lifecycle or recorded Deviations disagree with facts that derive coherently', async () => {
    const expectedExcess = (tradeId: string): ExpectedDeviation => ({
      fingerprint: { tradeId, plannedLegId: `${tradeId}:leg`, positionChangeId: `${tradeId}:pc-3` },
      type: 'EntrySize',
      form: 'Excess',
      quantityAbovePlan: Rational.of(20n),
      causingPositionChangeId: `${tradeId}:pc-3`,
      economicTime: '2026-10-12T18:00:00Z',
    });
    const trades = [
      // Stored Planned, but PC1 leaves exposure.
      trade('trade-1', [PC1('trade-1')], { lifecycle: 'Planned' }),
      // PC3's excess was never recorded.
      trade('trade-2', [PC1('trade-2'), PC2('trade-2'), PC3('trade-2')]),
      // PC3's excess recorded as 15 shares instead of 20.
      trade('trade-3', [PC1('trade-3'), PC2('trade-3'), PC3('trade-3')], { deviations: [pc3Excess('trade-3', '15')] }),
    ];

    const result = await validateSection(recordSourceOf({ trades }), references);

    expect(result.issues).toEqual([]);
    expect(result.repairs).toEqual([
      {
        code: 'StoredStateDisagreement',
        tradeId: 'trade-1',
        findings: [{ kind: 'LifecycleDisagreement', stored: 'Planned', expected: 'Open' }],
        expectedLifecycle: 'Open',
        deviationActions: [],
      },
      {
        code: 'StoredStateDisagreement',
        tradeId: 'trade-2',
        findings: [{ kind: 'DeviationMissing', fingerprint: expectedExcess('trade-2').fingerprint, expected: expectedExcess('trade-2') }],
        expectedLifecycle: 'Open',
        deviationActions: [{ kind: 'Create', occurrence: expectedExcess('trade-2') }],
      },
      {
        code: 'StoredStateDisagreement',
        tradeId: 'trade-3',
        findings: [
          {
            kind: 'DeviationQuantityDisagreement',
            fingerprint: expectedExcess('trade-3').fingerprint,
            occurrenceId: 'trade-3:dev-1',
            recorded: Rational.of(15n),
            expected: Rational.of(20n),
          },
        ],
        expectedLifecycle: 'Open',
        deviationActions: [{ kind: 'NewVersion', occurrenceId: 'trade-3:dev-1', occurrence: expectedExcess('trade-3') }],
      },
    ]);
  });

  it('should return an issue when a Trade facts are incoherent', async () => {
    // PC2's Execution serves a Planned Leg the Plan does not have; the stored lifecycle also
    // disagrees, but incoherent facts are never repaired.
    const stray = { ...PC2('trade-2')[0]!, intent: { kind: 'ServesPlannedLeg' as const, plannedLegId: 'trade-2:leg-unknown' } };
    const trades = [trade('trade-1'), trade('trade-2', [PC1('trade-2'), [stray]], { lifecycle: 'Planned' })];

    const result = await validateSection(recordSourceOf({ trades }), { ...references, anchorTradeIds: new Set(['trade-1', 'trade-2']) });

    expect(result.issues).toEqual([
      { code: 'IncoherentFacts', tradeId: 'trade-2', findings: [{ factId: 'trade-2:ex-2-1', reason: 'UnknownPlannedLeg' }] },
    ]);
    expect(result.repairs).toEqual([]);
  });
});
