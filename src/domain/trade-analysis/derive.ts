import { Temporal } from 'temporal-polyfill';
import type { Instant } from '../time/index.ts';
import { parseDecimal, Rational } from '../values/index.ts';
import { frozenBaseline, type ConditionInput, type PlanBaseline, type PlannedLegInput } from './plan.ts';

export type LifecycleState = 'Planned' | 'Open' | 'Closed' | 'Abandoned';

// One effective fill. D2 records Buys of the Plan's Stock serving its Planned Leg (D2 A18).
export interface ExecutionFact {
  readonly factId: string;
  readonly economicTime: Instant;
  readonly recordedSequence: number;
  readonly action: 'Buy';
  readonly instrument: { readonly kind: 'Stock'; readonly symbol: string };
  readonly quantity: string;
  readonly price: string;
  readonly fee: string;
  readonly intent: { readonly kind: 'ServesPlannedLeg'; readonly plannedLegId: string };
}

// One decision grouping its member Executions; its Economic Time is its earliest member's (A19).
export interface PositionChangeFact {
  readonly factId: string;
  readonly economicTime: Instant;
  readonly recordedSequence: number;
  readonly executions: readonly ExecutionFact[];
}

// Trade Record's AnalysisInput projection: the complete effective facts of one Trade at one
// FactRevision.
export interface TradeAnalysisRecord {
  readonly tradeId: string;
  readonly factRevision: number;
  readonly storedLifecycle: LifecycleState;
  readonly plan: {
    readonly economicTime: Instant;
    readonly underlying: string;
    readonly thesis: string;
    readonly invalidation: string;
    readonly legs: readonly (PlannedLegInput & { readonly factId: string })[];
    readonly stops: readonly (ConditionInput & { readonly factId: string })[];
    readonly targets: readonly (ConditionInput & { readonly factId: string })[];
  };
  readonly positionChanges: readonly PositionChangeFact[];
}

export interface TradeDerivationInput {
  readonly record: TradeAnalysisRecord;
}

// Agreement between stored and expected Lifecycle State; a disagreement is reported, never repaired.
export type LifecycleAgreement =
  | { readonly kind: 'Agrees' }
  | { readonly kind: 'LifecycleDisagreement'; readonly stored: LifecycleState; readonly expected: LifecycleState };

// The unmatched portion of one opening Execution, with its basis and unconsumed opening fee.
export interface OpenLot {
  readonly openingExecutionId: string;
  readonly quantity: Rational;
  readonly price: Rational;
  readonly unconsumedOpeningFee: Rational;
}

// Derived signed net quantity and Open Lots for one exact Instrument within the Trade.
export interface InstrumentPosition {
  readonly instrument: ExecutionFact['instrument'];
  readonly quantity: Rational;
  readonly openLots: readonly OpenLot[];
}

export interface DerivedTradeState {
  readonly kind: 'Derived';
  readonly tradeId: string;
  readonly factRevision: number;
  readonly expectedLifecycle: LifecycleState;
  readonly agreement: LifecycleAgreement;
  // Effective Executions in Fact Order, each with its Position Change.
  readonly facts: readonly (ExecutionFact & { readonly positionChangeId: string })[];
  readonly positions: readonly InstrumentPosition[];
  // Every opening Execution's actual fee, each counted once.
  readonly fees: { readonly incurredOpening: Rational };
  readonly baseline: PlanBaseline;
}

// Facts that cannot be replayed are a typed rejection naming each fact, never a number.
export interface IncoherentFacts {
  readonly kind: 'IncoherentFacts';
  readonly findings: readonly {
    readonly factId: string;
    readonly reason: 'UnknownPlannedLeg' | 'NonpositiveQuantity' | 'DuplicateFactId';
  }[];
}

export type DerivationResult = DerivedTradeState | IncoherentFacts;

function incoherence(record: TradeAnalysisRecord): IncoherentFacts['findings'] {
  const findings: { factId: string; reason: IncoherentFacts['findings'][number]['reason'] }[] = [];
  const legs = new Set(record.plan.legs.map((l) => l.factId));
  const seen = new Set<string>();
  for (const pc of record.positionChanges) {
    for (const fact of [pc, ...pc.executions]) {
      if (seen.has(fact.factId)) findings.push({ factId: fact.factId, reason: 'DuplicateFactId' });
      seen.add(fact.factId);
    }
    for (const e of pc.executions) {
      if (!legs.has(e.intent.plannedLegId)) findings.push({ factId: e.factId, reason: 'UnknownPlannedLeg' });
      if (!parseDecimal(e.quantity, { positive: true }).ok) findings.push({ factId: e.factId, reason: 'NonpositiveQuantity' });
    }
  }
  return findings;
}

// Facts reaching analysis were validated when recorded, so their decimals parse.
function decimal(text: string): Rational {
  const parsed = parseDecimal(text);
  if (!parsed.ok) throw new Error(`Invalid stored decimal: ${text}`);
  return parsed.value;
}

// Each opening Execution creates one Open Lot holding its whole fee (D2 A22).
function positionsOf(facts: readonly ExecutionFact[]): InstrumentPosition[] {
  const lots = facts.map((e): OpenLot => ({
    openingExecutionId: e.factId,
    quantity: decimal(e.quantity),
    price: decimal(e.price),
    unconsumedOpeningFee: decimal(e.fee),
  }));
  if (lots.length === 0) return [];
  return [
    {
      instrument: facts[0]!.instrument,
      quantity: lots.reduce((sum, l) => sum.add(l.quantity), Rational.of(0n)),
      openLots: lots,
    },
  ];
}

// FactOrder: Economic Time, then the stable Recorded Sequence for ties.
type Ordered = Pick<ExecutionFact, 'economicTime' | 'recordedSequence'>;
function factOrder(a: Ordered, b: Ordered): number {
  return Temporal.Instant.compare(a.economicTime, b.economicTime) || a.recordedSequence - b.recordedSequence;
}

export function derive(input: TradeDerivationInput): DerivationResult {
  const { record } = input;
  const findings = incoherence(record);
  if (findings.length > 0) return { kind: 'IncoherentFacts', findings };
  const facts = record.positionChanges
    // Nested values are copied so the inert output never aliases the caller's input.
    .flatMap((pc) =>
      pc.executions.map((e) => ({ ...e, instrument: { ...e.instrument }, intent: { ...e.intent }, positionChangeId: pc.factId })),
    )
    .sort(factOrder);
  const positions = positionsOf(facts);
  // Effective facts that leave nonzero exposure make the Trade Open; none leave it Planned.
  const expectedLifecycle: LifecycleState = positions.length > 0 ? 'Open' : 'Planned';
  return {
    kind: 'Derived',
    tradeId: record.tradeId,
    factRevision: record.factRevision,
    expectedLifecycle,
    agreement:
      record.storedLifecycle === expectedLifecycle
        ? { kind: 'Agrees' }
        : { kind: 'LifecycleDisagreement', stored: record.storedLifecycle, expected: expectedLifecycle },
    facts,
    positions,
    fees: { incurredOpening: facts.reduce((sum, e) => sum.add(decimal(e.fee)), Rational.of(0n)) },
    baseline: frozenBaseline(record.plan),
  };
}
