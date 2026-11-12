// Trade Detail fixtures for D7's option reference Trades (breakdown, section 4: O-C the Long Call on XYZ, O-S the
// Cash-Secured Put on MNO), derived by Trade Analysis so every figure is the one Trade Views would give. The UI
// tests may not import the domain or the coordinators, so the assembly lives here.
import type { ClosedTradeDetail, OpenTradeDetail, PlannedTradeDetail, PositionChangeFact, RecordedDeviation } from '../../src/app/types.ts';
import { payoffOf } from '../../src/coordinators/settlement.ts';
import { feeReconciliationOf, lotMatchViews } from '../../src/coordinators/trade-views/index.ts';
import { derive, evaluate, type TradeAnalysisRecord } from '../../src/domain/trade-analysis/index.ts';
import { ocRecord, os2Record, osRecord, OC_CONTRACT, OS_CONTRACT, OS2_CONTRACT } from '../../src/domain/trade-analysis/option-trade.ts';
import { optionSummary } from '../../src/domain/trade-summary.ts';
import { Rational } from '../../src/domain/values/index.ts';
import type { OptionInstrument } from '../../src/domain/instrument/index.ts';

export type OptionTradeName = 'O-C' | 'O-S' | 'O-S2';

// Friday 2026-11-20 16:00 New York, the close of the expiration session.
const SETTLEMENT_TIME = { kind: 'Value', value: '2026-11-20T21:00:00Z' } as const;

const contractOf = (which: OptionTradeName): OptionInstrument => (which === 'O-C' ? OC_CONTRACT : which === 'O-S2' ? OS2_CONTRACT : OS_CONTRACT);

export interface OptionDetailOptions {
  readonly recordedDeviations?: readonly RecordedDeviation[];
}

function recordOf(
  which: OptionTradeName,
  positionChanges: readonly PositionChangeFact[],
  storedLifecycle: TradeAnalysisRecord['storedLifecycle'],
  options: OptionDetailOptions = {},
): TradeAnalysisRecord {
  const record = which === 'O-C' ? ocRecord(positionChanges) : which === 'O-S2' ? os2Record(positionChanges) : osRecord(positionChanges);
  // O-C is a long option, which carries an Exercise Intent (A100); the Cash-Secured Put carries none.
  const plan = which === 'O-C' ? { ...record.plan, exerciseIntent: 'NotAuthorized' as const } : record.plan;
  return { ...record, storedLifecycle, plan, ...(options.recordedDeviations && { recordedDeviations: options.recordedDeviations }) };
}

// The Entry Size (Excess) occurrence a third contract bought on O-C (PC3) causes: 1 contract above the planned 2.
export const ocExcess: RecordedDeviation = {
  occurrenceId: 'dev-1',
  versions: [
    {
      fingerprint: { tradeId: 'trade-o', plannedLegId: 'leg-oc', positionChangeId: 'pc-3' },
      type: 'EntrySize',
      form: 'Excess',
      quantityAbovePlan: '1',
      causingPositionChangeId: 'pc-3',
      economicTime: '2026-10-12T16:00:00Z',
      status: 'Active',
    },
  ],
};

const magnitude = (value: Rational) => (value.compare(Rational.of(0n)) < 0 ? Rational.of(0n).sub(value) : value);
const sum = (values: readonly Rational[]) => values.reduce((a, b) => a.add(b), Rational.of(0n));
const decimal = (text: string) => {
  const [whole = '0', fraction = ''] = text.replace('-', '').split('.');
  const value = Rational.of(BigInt(whole + fraction), 10n ** BigInt(fraction.length));
  return text.startsWith('-') ? Rational.of(0n).sub(value) : value;
};

const LABELS = {
  'O-C': { strategy: 'Long Call', account: 'Roth IRA', institution: 'Fidelity' },
  'O-S': { strategy: 'Cash-Secured Put', account: 'Roth IRA', institution: 'Fidelity' },
  'O-S2': { strategy: 'Cash-Secured Put', account: 'Roth IRA', institution: 'Fidelity' },
} as const;

function plannedPart(which: OptionTradeName, record: TradeAnalysisRecord, valuationDate?: string) {
  const derived = derive(valuationDate === undefined ? { record } : { record, valuationDate });
  if (derived.kind !== 'Derived') throw new Error('incoherent fixture');
  const { plan } = record;
  const planned: Omit<PlannedTradeDetail, 'journal'> = {
    tradeId: 'trade-1',
    factRevision: record.factRevision,
    plan: {
      underlying: plan.underlying,
      planTime: plan.economicTime,
      thesis: plan.thesis,
      invalidation: plan.invalidation,
      ...(plan.exerciseIntent && { exerciseIntent: plan.exerciseIntent }),
      legs: plan.legs,
      stops: plan.stops,
      targets: plan.targets,
    },
    lifecycle: { stored: record.storedLifecycle, agreement: derived.agreement },
    baseline: derived.baseline,
    labels: LABELS[which],
    payoff: payoffOf(record, derived),
  };
  return { derived, planned };
}

// A Planned option Trade: the Plan's contracts at the intended entry, its Planned payoff, no Current payoff.
export function optionPlannedDetail(which: OptionTradeName): PlannedTradeDetail {
  const record = recordOf(which, [], 'Planned');
  const { planned } = plannedPart(which, record);
  const leg = record.plan.legs[0]!;
  return { ...planned, summary: optionSummary(contractOf(which), leg.side, magnitude(sum(record.plan.legs.map((l) => decimal(l.quantity))))), journal: [] };
}

export interface OptionFrames {
  readonly tradingDate: string;
  readonly closeInstant: string;
  // The contract's and the Underlying's exact Mark; absent is Missing.
  readonly contractMark?: string;
  readonly underlyingMark?: string;
}

const frameOf = (instrument: OptionInstrument | { readonly kind: 'Stock'; readonly symbol: string }, frames: OptionFrames, price: string | undefined) => ({
  instrument,
  tradingDate: frames.tradingDate,
  closeInstant: frames.closeInstant,
  resolution: price === undefined ? ({ kind: 'Missing' } as const) : ({ kind: 'Available', mark: { revisionId: `mark-${instrument.symbol}`, revisionNumber: 1, price } } as const),
});

// An Open option Trade valued at the frames' close, with its Settlement Due items once the expiration date has come.
export function optionOpenDetail(which: OptionTradeName, positionChanges: readonly PositionChangeFact[], frames: OptionFrames, options: OptionDetailOptions = {}): OpenTradeDetail {
  const record = recordOf(which, positionChanges, 'Open', options);
  const { derived, planned } = plannedPart(which, record, frames.tradingDate);
  const contract = contractOf(which);
  const evaluation = evaluate({
    state: derived,
    frame: frameOf(contract, frames, frames.contractMark),
    underlyingFrame: frameOf({ kind: 'Stock', symbol: record.plan.underlying }, frames, frames.underlyingMark),
  });
  const lots = derived.positions.flatMap((p) => p.openLots);
  const held = sum(lots.map((l) => l.quantity));
  return {
    ...planned,
    summary: held.compare(Rational.of(0n)) === 0 ? undefined : optionSummary(contract, held.compare(Rational.of(0n)) < 0 ? 'Short' : 'Long', magnitude(held)),
    positions: derived.positions,
    heldQuantity: sum(derived.positions.map((p) => p.quantity)),
    lotMatches: lotMatchViews(derived),
    realizedToDate: derived.realizedToDate,
    feeReconciliation: feeReconciliationOf(derived),
    fees: derived.fees,
    netCost: derived.netCost,
    lastActivity: positionChanges.at(-1)?.economicTime ?? record.plan.economicTime,
    settlement: evaluation.settlement
      .filter((item) => item.status === 'Due')
      .map(({ instrument, quantity, expiration }) => ({ tradeId: 'trade-1', instrument, quantity, expiration, settlementTime: SETTLEMENT_TIME })),
    positionChanges,
    entryStatus: derived.entryResolution.kind === 'Resolved' ? 'Resolved' : 'Entering',
    entryResolution: derived.entryResolution,
    entryQuality: derived.entryQuality,
    legFulfillment: derived.legFulfillment,
    deviations: record.recordedDeviations ?? [],
    findings: derived.findings,
    journal: [],
    ...(evaluation.settlement.every((item) => item.status !== 'Due') && { contractExpiration: { status: 'Expires' as const, date: contract.expiration } }),
    current: {
      expectedMarkDate: frames.tradingDate,
      markResolution:
        frames.contractMark === undefined
          ? { kind: 'Missing' }
          : { kind: 'Available', mark: { source: 'Manual', revisionId: `mark-${contract.symbol}`, revisionNumber: 1, price: frames.contractMark, savedAt: frames.closeInstant } },
      ...(frames.contractMark !== undefined && {
        mark: { source: 'Manual' as const, revisionId: `mark-${contract.symbol}`, revisionNumber: 1, price: frames.contractMark, savedAt: frames.closeInstant },
      }),
      ...(frames.underlyingMark !== undefined && {
        underlyingMark: { source: 'Manual' as const, revisionId: `mark-${record.plan.underlying}`, revisionNumber: 1, price: frames.underlyingMark, savedAt: frames.closeInstant },
      }),
      coverage: [{ instrument: evaluation.observation.instrument, coverage: evaluation.coverage }],
      evaluation,
    },
  };
}

// A Closed option Trade: no Mark, no current figure, Terminal Disposition and Option Disposition Timing from the facts.
export function optionClosedDetail(which: OptionTradeName, positionChanges: readonly PositionChangeFact[], closeReason?: ClosedTradeDetail['closeReason']): ClosedTradeDetail {
  const record = recordOf(which, positionChanges, 'Closed');
  const undated = plannedPart(which, record);
  if (undated.derived.terminalTime === null) throw new Error('incoherent fixture');
  const date = undated.derived.terminalTime.slice(0, 10);
  const { derived, planned } = plannedPart(which, record, date);
  const contract = contractOf(which);
  const evaluation = evaluate({ state: derived, frame: { instrument: contract, date }, underlyingFrame: { instrument: { kind: 'Stock', symbol: record.plan.underlying }, date } });
  const leg = record.plan.legs[0]!;
  const entered = sum(derived.facts.filter((fact) => fact.action === (leg.side === 'Long' ? 'Buy' : 'Sell')).map((fact) => decimal(fact.quantity)));
  return {
    ...planned,
    summary: optionSummary(contract, leg.side, entered),
    positions: derived.positions,
    heldQuantity: sum(derived.positions.map((p) => p.quantity)),
    lotMatches: lotMatchViews(derived),
    realizedToDate: derived.realizedToDate,
    feeReconciliation: feeReconciliationOf(derived),
    fees: derived.fees,
    netCost: derived.netCost,
    lastActivity: positionChanges.at(-1)?.economicTime ?? record.plan.economicTime,
    settlement: [],
    positionChanges,
    entryStatus: derived.entryResolution.kind === 'Resolved' ? 'Resolved' : 'Entering',
    entryResolution: derived.entryResolution,
    entryQuality: derived.entryQuality,
    legFulfillment: derived.legFulfillment,
    deviations: record.recordedDeviations ?? [],
    findings: derived.findings,
    journal: [],
    ...(derived.terminalDisposition.kind === 'Value' &&
      derived.terminalDisposition.value.some(({ mechanism }) => mechanism === 'Expiration') && { contractExpiration: { status: 'Expired' as const, date: contract.expiration } }),
    current: { coverage: [{ instrument: evaluation.observation.instrument, coverage: evaluation.coverage }], evaluation },
    terminalDisposition: derived.terminalDisposition,
    optionDispositionTiming: derived.optionDispositionTiming,
    ...(closeReason && { closeReason }),
    terminalTime: undated.derived.terminalTime,
    realizedR: derived.realizedR,
  };
}
