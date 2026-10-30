// Open Trade Detail fixtures for the UI tests: D2's reference Trade (breakdown, section 4), derived by
// Trade Analysis so every figure is the one the coordinator would show.
import type {
  IncoherentFactFinding,
  IncoherentTradeDetail,
  NarrativeItem,
  OpenTradeDetail,
  TradeDetailNarrativeItem,
  PositionChangeFact,
  RecordedDeviation,
} from '../../src/app/types.ts';
import { Rational } from '../../src/domain/values/index.ts';
import { derive, evaluate, type TradeAnalysisRecord } from '../../src/domain/trade-analysis/index.ts';
import { LEG_ID, referenceRecord } from '../../src/domain/trade-analysis/reference-trade.ts';
import { plannedDetail } from './views-fixtures.ts';
import { datedLineOf, observationFrame } from '../../src/coordinators/valuation.ts';
import type { MarkFrame } from '../../src/modules/market-data/index.ts';

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

// The open quantity at its quantity-weighted Open Lot price, as Trade Views builds it.
function openSummary(positions: OpenTradeDetail['positions']): OpenTradeDetail['summary'] {
  const lots = positions.flatMap((p) => p.openLots);
  const total = lots.reduce((sum, l) => sum.add(l.quantity), Rational.of(0n));
  const cost = lots.reduce((sum, l) => sum.add(l.quantity.mul(l.price)), Rational.of(0n));
  if (total.compare(Rational.of(0n)) === 0) return undefined;
  return { kind: 'Stock', direction: 'Long', quantity: total, price: cost.div(total) };
}

export interface OpenDetailOptions {
  readonly storedLifecycle?: TradeAnalysisRecord['storedLifecycle'];
  readonly recordedDeviations?: readonly RecordedDeviation[];
  readonly journal?: readonly TradeDetailNarrativeItem[];
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
    summary: openSummary(derived.positions),
    positions: derived.positions,
    netCost: derived.netCost,
    lastActivity: positionChanges.at(-1)?.economicTime ?? record.plan.economicTime,
    fees: derived.fees,
    positionChanges,
    entryStatus: derived.entryResolution.kind === 'Resolved' ? 'Resolved' : 'Entering',
    entryResolution: derived.entryResolution,
    entryQuality: derived.entryQuality,
    legFulfillment: derived.legFulfillment,
    deviations: record.recordedDeviations ?? [],
    findings: derived.findings,
    journal: options.journal ?? [],
    // No Mark is entered for the fixture's Expected Mark Date, so every current figure is Unavailable.
    current: {
      expectedMarkDate: '2026-10-12',
      markResolution: { kind: 'Missing' },
      coverage: [{ instrument: { kind: 'Stock', symbol: record.plan.underlying }, coverage: { kind: 'Missing' } }],
      evaluation: evaluate({
        state: derived,
        frame: { instrument: { kind: 'Stock', symbol: record.plan.underlying }, tradingDate: '2026-10-12', closeInstant: '2026-10-12T20:00:00Z', resolution: { kind: 'Missing' } },
      }),
    },
  };
}

// The Open Detail valued at a Mark frame, as Trade Views assembles its current evaluation: the
// provenance of an exact Mark, the evaluation, and the dated line when the figures need one.
export function openDetailAt(positionChanges: readonly PositionChangeFact[], frame: MarkFrame, options: OpenDetailOptions = {}): OpenTradeDetail {
  const base = openDetailOf(positionChanges, options);
  const record = referenceRecord(positionChanges, options.storedLifecycle ?? 'Open');
  const derived = derive({ record });
  if (derived.kind !== 'Derived') throw new Error('incoherent fixture');
  const evaluation = evaluate({ state: derived, frame: observationFrame(frame) });
  const datedLine = datedLineOf(record, frame, evaluation);
  const { resolution } = frame;
  const mark =
    resolution.kind === 'Available'
      ? { source: 'Manual' as const, revisionId: resolution.mark.revisionId, revisionNumber: resolution.mark.revisionNumber, price: resolution.mark.price, savedAt: resolution.mark.savedAt, ...(resolution.mark.correctionReason !== undefined && { correctionReason: resolution.mark.correctionReason }) }
      : undefined;
  return {
    ...base,
    current: {
      expectedMarkDate: frame.tradingDate,
      markResolution: resolution,
      ...(mark && { mark }),
      coverage: [{ instrument: evaluation.observation.instrument, coverage: evaluation.coverage }],
      evaluation,
      ...(datedLine && { datedLine }),
    },
  };
}

// The Open Detail when the as-of date lies outside session-policy coverage: no Expected Mark Date, no frame (decision 54).
export function openDetailUncovered(positionChanges: readonly PositionChangeFact[], date: string, options: OpenDetailOptions = {}): OpenTradeDetail {
  const derived = derive({ record: referenceRecord(positionChanges, options.storedLifecycle ?? 'Open') });
  if (derived.kind !== 'Derived') throw new Error('incoherent fixture');
  const instrument = { kind: 'Stock', symbol: 'XYZ' } as const;
  const evaluation = evaluate({ state: derived, frame: { instrument, date } });
  return { ...openDetailOf(positionChanges, options), current: { coverage: [{ instrument, coverage: evaluation.coverage }], evaluation } };
}

// The Detail of a Trade whose recorded facts cannot be replayed: only stored values and the findings.
export function incoherentDetailOf(
  positionChanges: readonly PositionChangeFact[],
  findings: readonly IncoherentFactFinding[],
  journal: readonly TradeDetailNarrativeItem[] = [],
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
  positionChangeId: 'pc-1',
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
  positionChangeId: 'pc-2',
  reason: 'Same plan, second fill.',
};
