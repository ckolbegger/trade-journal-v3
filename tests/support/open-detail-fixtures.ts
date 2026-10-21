// Open Trade Detail fixtures for the UI tests: D2's reference Trade (breakdown, section 4), derived by
// Trade Analysis so every figure is the one the coordinator would show.
import type {
  IncoherentFactFinding,
  IncoherentTradeDetail,
  NarrativeItem,
  OpenTradeDetail,
  PositionChangeFact,
  RecordedDeviation,
} from '../../src/app/types.ts';
import { derive, type TradeAnalysisRecord } from '../../src/domain/trade-analysis/index.ts';
import { LEG_ID, referenceRecord } from '../../src/domain/trade-analysis/reference-trade.ts';
import { plannedDetail } from './views-fixtures.ts';

export { execution, PC1, PC2, PC3, positionChange } from '../../src/domain/trade-analysis/reference-trade.ts';

// The recorded Entry Size (Excess) occurrence PC3 causes: 20 shares above the planned 100.
export const pc3Excess: RecordedDeviation = {
  occurrenceId: 'dev-1',
  versions: [
    {
      fingerprint: {
        tradeId: 'trade-1',
        plannedLegId: LEG_ID,
        positionChangeId: 'pc-3',
      },
      type: 'EntrySize',
      form: 'Excess',
      quantityAbovePlan: '20',
      causingPositionChangeId: 'pc-3',
      economicTime: '2026-10-12T18:00:00Z',
      status: 'Active',
    },
  ],
};

export interface OpenDetailOptions {
  readonly storedLifecycle?: TradeAnalysisRecord['storedLifecycle'];
  readonly recordedDeviations?: readonly RecordedDeviation[];
  readonly journal?: readonly NarrativeItem[];
}

export function openDetailOf(positionChanges: readonly PositionChangeFact[], options: OpenDetailOptions = {}): OpenTradeDetail {
  const record: TradeAnalysisRecord = {
    ...referenceRecord(positionChanges, options.storedLifecycle ?? 'Open'),
    recordedDeviations: options.recordedDeviations ?? [],
  };
  const derived = derive({ record });
  if (derived.kind !== 'Derived') throw new Error('incoherent fixture');
  return {
    ...plannedDetail,
    factRevision: record.factRevision,
    plan: {
      underlying: record.plan.underlying,
      planTime: record.plan.economicTime,
      thesis: record.plan.thesis,
      invalidation: record.plan.invalidation,
      legs: record.plan.legs,
      stops: record.plan.stops,
      targets: record.plan.targets,
    },
    lifecycle: { stored: record.storedLifecycle, agreement: derived.agreement },
    baseline: derived.baseline,
    positions: derived.positions,
    fees: derived.fees,
    positionChanges,
    entryStatus: derived.entryResolution.kind === 'Resolved' ? 'Resolved' : 'Entering',
    entryResolution: derived.entryResolution,
    entryQuality: derived.entryQuality,
    legFulfillment: derived.legFulfillment,
    deviations: record.recordedDeviations ?? [],
    findings: derived.findings,
    journal: options.journal ?? [],
  };
}

// The Detail of a Trade whose recorded facts cannot be replayed: only stored values and the findings.
export function incoherentDetailOf(
  positionChanges: readonly PositionChangeFact[],
  findings: readonly IncoherentFactFinding[],
  journal: readonly NarrativeItem[] = [],
): IncoherentTradeDetail {
  const open = openDetailOf([]);
  return {
    tradeId: open.tradeId,
    factRevision: open.factRevision,
    plan: open.plan,
    lifecycle: { stored: 'Open' },
    labels: open.labels,
    recordedPositionChanges: positionChanges,
    deviations: [],
    findings,
    journal,
  };
}

// A completed Position Change Reflection and a decline, as the Trade narrative returns them.
export const pc1Reflection: NarrativeItem = {
  kind: 'Entry',
  id: 'e-2',
  entryType: 'Position Change Reflection',
  source: 'Position Change',
  anchor: { kind: 'Trade', tradeId: 'trade-1' },
  momentTime: '2026-10-12T14:00:00Z',
  authoredTime: '2026-10-12T14:02:00Z',
  responses: [
    { prompt: 'Decision mode', answer: { kind: 'Option', label: 'Planned' } },
    { prompt: 'Primary emotion', answer: { kind: 'Option', label: 'Calm' } },
    { prompt: 'Decision confidence', answer: { kind: 'Scale', value: 4 } },
    { prompt: 'Note', answer: { kind: 'Unanswered' } },
  ],
};

export const pc2Decline: NarrativeItem = {
  kind: 'Decline',
  id: 'd-1',
  entryType: 'Position Change Reflection',
  source: 'Position Change',
  anchor: { kind: 'Trade', tradeId: 'trade-1' },
  momentTime: '2026-10-12T15:00:00Z',
  authoredTime: '2026-10-12T15:01:00Z',
  reason: 'Same plan, second fill.',
};
